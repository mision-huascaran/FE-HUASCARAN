// Cola de envíos pendientes (RNF-001).
//
// Lo que exige el requerimiento y cómo se cumple:
//  - el guardado nunca bloquea la interfaz → la fila se da por guardada en local
//    apenas se encola, y el envío ocurre después;
//  - hasta 3 reintentos con espera creciente → 1s, 4s y 9s;
//  - sin duplicar → cada envío lleva una `idempotency_key` (`alumno-semana`) y
//    la cola guarda un solo elemento por clave: si el docente vuelve a editar la
//    misma fila, se reemplaza el pendiente en vez de agregar otro. Si el
//    servidor ya había aceptado un envío que el cliente creyó fallido, el
//    reintento llega con la misma clave y el servidor lo trata como el mismo
//    registro.
//
// La cola vive en IndexedDB para sobrevivir a un cierre del navegador en pleno
// corte de conexión. Si IndexedDB no está disponible, sigue funcionando en
// memoria: el objetivo es no perder el trabajo del docente, no la persistencia.
import { mensajeDeError, motivoDe } from '../api/client'
import { del, get, set } from 'idb-keyval'
import { avisarPendientes, consultarOperacion } from '../api/resources/sincronizacion'
import { idDeDispositivo } from './dispositivo'
import { nuevoUuid } from './uuid'
import { leerPayload } from '../auth/jwt'
import useSessionStore from '../store/sessionStore'
import useSyncStore from '../store/syncStore'
import useRechazosStore from '../store/rechazosStore'

const CLAVE_IDB = 'sicedu.cola-envios'
const ESPERAS_MS = [1000, 4000, 9000]
/** Tope del contrato para `POST /sincronizacion/pendientes`. */
const MAX_AVISOS_POR_LOTE = 500
export const MAX_INTENTOS = ESPERAS_MS.length

const enviadores = new Map()
/**
 * El MÓDULO del contrato al que pertenece cada tipo de envío.
 *
 * No se puede usar `item.tipo` tal cual: los nombres de aquí son los de la
 * interfaz —"asistencia", "actividad-cierre"— y el contrato tiene su propia
 * lista cerrada: `asistencias`, `lectura`, `rubrica`, `registro_vuelo`,
 * `alumnos`, `actividad`. Mandar el nombre de casa haría que el servidor
 * descartara el aviso por un valor inválido, y en silencio: el aviso no
 * interrumpe el envío, así que nadie se enteraría.
 */
const modulos = new Map()
/** Promesa de cada envío, por `idOperacion` (dos de la misma clave pueden convivir). */
const promesas = new Map()

let cola = []
let iniciada = false
let procesando = false
let temporizador = null
/** La operación que se está mandando ahora mismo: no se reemplaza ni se toca. */
let enVuelo = null

/**
 * Cada tipo de envío declara cómo se manda al servidor.
 *
 * @param modulo el del contrato, para el aviso de pendientes. Se declara aquí,
 *   junto al enviador, porque es la única parte que sabe a qué endpoint va.
 */
export function registrarEnviador(tipo, enviar, { modulo } = {}) {
  enviadores.set(tipo, enviar)
  if (modulo) modulos.set(tipo, modulo)
}

/**
 * La cuenta de la sesión actual, según su token; null si no se puede leer.
 *
 * D92 — Cada operación recuerda de quién es. CU007 dice que lo pendiente se
 * sincroniza "después de una nueva autenticación válida DEL USUARIO": si en el
 * mismo navegador entra otra cuenta, lo de la anterior no se manda con el
 * token de la nueva —el servidor lo atribuiría a quien no lo hizo— ni se
 * borra —CU007 lo prohíbe—. Espera a que vuelva su dueño.
 */
const usuarioActual = () => {
  const id = leerPayload(useSessionStore.getState().token)?.id_usuario
  return id == null ? null : String(id)
}

/** Sin dueño conocido (colas de antes de D92, token del mock) vale para cualquiera. */
const esDeLaSesion = (item, usuario = usuarioActual()) =>
  item.usuario == null || usuario == null || item.usuario === usuario

/** Lo que puede enviarse con la sesión actual, en el orden de la cola. */
const propias = () => {
  const usuario = usuarioActual()
  return cola.filter((item) => esDeLaSesion(item, usuario))
}

/** Saca de la cola una operación concreta, esté donde esté. */
function quitar(item) {
  const i = cola.indexOf(item)
  if (i >= 0) cola.splice(i, 1)
}

/**
 * ¿El servidor dijo que la SESIÓN ya no vale?
 *
 * Un 401 no habla de la operación sino del token: la sesión expiró (las 8
 * horas, a veces contadas por el servidor mientras el equipo estaba sin
 * señal) o se cerró. La operación sigue siendo buena y tiene que esperar a la
 * siguiente autenticación, no salir de la cola como un rechazo.
 */
const esSesionTerminada = (error) => error?.response?.status === 401

function publicarEstado() {
  // El panel de sincronización enseña lo de ESTA cuenta: lo de otra que espera
  // en el mismo navegador no es trabajo suyo.
  useSyncStore.getState().setPendientes(
    propias().map(({ clave, idOperacion, tipo, descripcion, intentos, error }) => ({ clave, idOperacion, tipo, descripcion, intentos, error })),
  )
}

async function persistir() {
  publicarEstado()
  try {
    await set(CLAVE_IDB, cola)
    return true
  } catch {
    // Sin IndexedDB (navegación privada, jsdom) la cola sigue en memoria. Para
    // el reporte semanal y la rúbrica eso basta: su pantalla ya avisa de los
    // pendientes y el docente tiene un botón de guardar al que volver.
    return false
  }
}

/** Error de un envío que exigía quedar guardado en local y no pudo. */
const errorDePersistencia = () => {
  const error = new Error('No se pudo guardar en el almacenamiento local')
  error.response = { status: 0, data: { motivo: 'persistencia_local' } }
  return error
}

function resolverPromesa(idOperacion, valor) {
  promesas.get(idOperacion)?.resolve(valor)
  promesas.delete(idOperacion)
}

function rechazarPromesa(idOperacion, error) {
  promesas.get(idOperacion)?.reject(error)
  promesas.delete(idOperacion)
}

/** Un 4xx no se arregla reintentando; un corte de red o un 5xx, sí. */
function esReintentable(error) {
  const estado = error?.response?.status
  if (estado == null) return true
  if (estado === 408 || estado === 429) return true
  return estado >= 500
}

/**
 * Saca de la cola todo lo que dependía de un envío que se descartó.
 *
 * Es recursivo porque una dependencia puede encadenarse, aunque hoy solo haya
 * un eslabón: el cierre de actividad depende de su inicio.
 */
function descartarDependientes(clave, error) {
  const dependientes = cola.filter((item) => item.dependeDe === clave)
  dependientes.forEach((item) => {
    const i = cola.indexOf(item)
    if (i >= 0) cola.splice(i, 1)
    rechazarPromesa(item.idOperacion, error)
    descartarDependientes(item.clave, error)
  })
}

/**
 * El identificador de la operación, que el servidor usa para no duplicarla.
 *
 * Se genera UNA vez, al encolar, y viaja igual en cada reintento: esa es toda
 * su gracia. Si se generara al enviar, dos intentos del mismo cambio serían
 * dos operaciones distintas para el servidor y se aplicarían las dos.
 */
const nuevoIdOperacion = nuevoUuid

/**
 * Un error sin respuesta: se mandó, pero no se supo si llegó.
 *
 * Es distinto de un 500: ahí el servidor contestó que falló. Aquí no contestó,
 * y la operación puede haberse aplicado igual. Por eso estos son los únicos
 * que vale la pena verificar antes de reintentar.
 */
const sinRespuesta = (error) => !error?.response

/**
 * Avisa al servidor de qué hay pendiente ANTES de mandarlo.
 *
 * Cierra el agujero de "el trabajo offline que nadie ve": mientras no se avisa,
 * un Docente que trabajó sin señal es invisible para el Supervisor. Nunca
 * interrumpe el envío: si el aviso falla, se manda el contenido igual, porque
 * perder el trabajo por no poder avisar sería absurdo.
 */
async function avisarDeLoPendiente() {
  const aviso = cola
    // Sin módulo del contrato no se avisa de esa operación: el servidor
    // rechazaría el lote entero por un valor que no está en su lista, y con él
    // el aviso de todas las demás.
    .filter((item) => modulos.has(item.tipo))
    .map((item) => ({
      id_operacion: item.idOperacion,
      id_dispositivo: idDeDispositivo(),
      modulo: modulos.get(item.tipo),
      realizado_en: item.creado,
      ...(item.idActividad ? { id_actividad: item.idActividad } : {}),
      /**
       * E2 — Los datos naturales del REGISTRO que la operación toca.
       *
       * Sin esto el backend cuenta un pendiente por `id_operacion`, así que
       * tres correcciones de la misma asistencia salían como tres registros
       * en riesgo y la Salud del Sistema bajaba sin motivo. Con `registro`
       * calcula la clave y cuenta UNA vez por registro.
       *
       * Va solo si el envío lo declaró: `alumnos` y `actividad` no lo
       * admiten, y un campo de más es un 422 del lote entero.
       */
      ...(item.registro ? { registro: item.registro } : {}),
    }))
    // El contrato admite 500 por lote. Es muchísimo más de lo que cabe en una
    // jornada, pero si alguna vez se pasara, el recorte deja pasar el aviso de
    // las 500 primeras en vez de perder el lote completo por exceder el límite.
    .slice(0, MAX_AVISOS_POR_LOTE)

  if (aviso.length === 0) return
  try {
    await avisarPendientes(aviso)
  } catch {
    // El aviso es un extra. Lo que no puede fallar es el envío.
  }
}

/**
 * ¿Hace falta reintentar este envío, o ya llegó?
 *
 * Solo se pregunta cuando el intento anterior se quedó sin respuesta. Si el
 * servidor dice que la vio, se da por resuelta: reintentar no duplicaría
 * —para eso está `id_operacion`— pero sí mentiría sobre lo que pasó.
 */
async function yaLlego(item) {
  if (!item.verificar) return null
  try {
    const resultado = await consultarOperacion(item.idOperacion)
    return resultado?.estado && resultado.estado !== 'desconocida' ? resultado : null
  } catch {
    // Si no se puede verificar, se reintenta: es lo que se hacía antes.
    return null
  }
}

function programar(ms) {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => procesar(), ms)
}

/** ¿Se puede vaciar la cola ahora? */
function sePuedeProcesar() {
  if (procesando || propias().length === 0) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSyncStore.getState().terminarSincronizacion(null)
    return false
  }
  // Sin sesión no se envía nada (CU007, CU008): recuperar la conexión en la
  // pantalla de login no debe sincronizar. Además, sin token cada envío daría
  // 401, que no es reintentable, y el pendiente se perdería. Se espera al
  // siguiente inicio de sesión (ver `iniciarCola`).
  return Boolean(useSessionStore.getState().token)
}

/** La operación ya había llegado: se cierra con lo que respondió entonces. */
async function resolverConocida(item, conocida) {
  quitar(item)
  item.verificar = false
  await persistir()
  if (conocida.estado === 'rechazada') {
    const error = new Error(conocida.motivo ?? 'rechazada')
    error.response = { status: 422, data: { detail: conocida.detail, motivo: conocida.motivo } }
    // Llegó y fue rechazada: también queda anotada (D69). Que el rechazo se
    // descubra al verificar y no al enviar no lo hace menos rechazo.
    anotarRechazo(item, error)
    descartarDependientes(item.clave, error)
    rechazarPromesa(item.idOperacion, error)
  } else {
    resolverPromesa(item.idOperacion, conocida.respuesta ?? conocida)
  }
}

/**
 * Deja constancia de un envío que el servidor rechazó.
 *
 * `clave` es la del item, que identifica el REGISTRO: un rechazo nuevo del
 * mismo alumno y la misma fila sustituye al anterior en vez de apilarse.
 */
function anotarRechazo(item, error) {
  const datos = error?.response?.data ?? {}
  useRechazosStore.getState().agregar({
    clave: item.clave,
    modulo: modulos.get(item.tipo) ?? item.tipo,
    nombre: item.descripcion ?? item.clave,
    idOperacion: item.idOperacion,
    motivo: datos.motivo ?? null,
    detail: datos.detail ?? mensajeDeError(error),
    registro: item.registro ?? null,
  })
}

/** Un envío falló. Devuelve si la cola sigue con el siguiente. */
async function trasFalloDeEnvio(item, error) {
  enVuelo = null
  const mensaje = mensajeDeError(error, error?.message ?? 'Error de envío')
  // Si no hubo respuesta, el próximo intento preguntará antes de mandar.
  item.verificar = sinRespuesta(error)

  /**
   * D92 — LA SESIÓN TERMINÓ: LA OPERACIÓN SE QUEDA.
   *
   * Antes un 401 se trataba como cualquier 4xx: la operación salía de la
   * cola. Era justo el caso de CP-ASI-06 y CP-LEC-07: el Docente registraba
   * sin señal, su sesión expiraba mientras tanto y, al volver la conexión,
   * el primer envío recibía 401. La cola se vaciaba, el login decía que lo
   * pendiente "se sincronizará al volver a entrar" y nunca llegaba.
   *
   * Ahora se detiene sin tocarla ni gastarle un intento: el interceptor cierra
   * la sesión y el siguiente inicio de sesión de la misma cuenta la envía.
   */
  if (esSesionTerminada(error)) {
    await persistir()
    useSyncStore.getState().terminarSincronizacion(null)
    return false
  }

  if (!esReintentable(error)) {
    quitar(item)
    /**
     * D69 — UN RECHAZO NO SE BORRA EN SILENCIO.
     *
     * Antes el envío se quitaba de la cola y solo se rechazaba su promesa.
     * Si la pantalla seguía abierta, se veía el aviso; si estaba cerrada
     * —y un envío hecho sin señal puede rechazarse horas después, con el
     * docente en otra cosa—, el dato desaparecía sin que nadie se enterara.
     *
     * Queda anotado con su motivo y su `detail`, y sigue en "Error" hasta que
     * el docente lo corrija o lo descarte. Es la diferencia entre "veo que mi
     * dato no subió" y "mi dato ya no está".
     */
    anotarRechazo(item, error)
    // Lo que dependía de este envío ya no tiene sentido: mandarlo solo
    // daría otro error y ensuciaría la cola con fallos encadenados.
    descartarDependientes(item.clave, error)
    await persistir()
    rechazarPromesa(item.idOperacion, error)
    return true
  }

  item.intentos += 1
  item.error = mensaje
  await persistir()

  if (item.intentos >= MAX_INTENTOS) {
    // Se agotaron los tres intentos: queda en la cola, visible en el
    // SyncBadge, esperando el "Reintentar ahora" del docente.
    useSyncStore.getState().terminarSincronizacion(mensaje)
    rechazarPromesa(item.idOperacion, error)
    return false
  }

  programar(ESPERAS_MS[item.intentos - 1])
  useSyncStore.getState().terminarSincronizacion(null)
  return false
}

/** Envía el primero de la cola. Devuelve si la cola sigue con el siguiente. */
async function procesarUno(item) {
  const enviar = enviadores.get(item.tipo)
  if (!enviar) {
    // Tipo desconocido: se descarta para no dejar la cola trabada.
    quitar(item)
    rechazarPromesa(item.idOperacion, new Error(`Sin enviador para "${item.tipo}"`))
    await persistir()
    return true
  }

  try {
    /**
     * Antes de reintentar algo que se quedó sin respuesta, se pregunta si
     * ya llegó. Evita un reintento inútil y, sobre todo, permite
     * distinguir "no llegó" de "llegó y fue rechazado".
     */
    const conocida = await yaLlego(item)
    if (conocida) {
      await resolverConocida(item, conocida)
      return true
    }

    enVuelo = item.idOperacion
    const respuesta = await enviar({
      ...item.payload,
      id_operacion: item.idOperacion,
      // El nombre antiguo sigue yendo: los endpoints que no se han
      // actualizado todavía lo esperan, y mandar uno de más no estorba.
      idempotency_key: item.clave,
    })
    enVuelo = null
    cola.splice(cola.indexOf(item), 1)
    await persistir()
    resolverPromesa(item.idOperacion, respuesta)
    return true
  } catch (error) {
    return trasFalloDeEnvio(item, error)
  }
}

async function procesar() {
  if (!sePuedeProcesar()) return

  procesando = true
  useSyncStore.getState().iniciarSincronizacion()

  /**
   * El aviso sale YA, sin esperarlo.
   *
   * Importa que salga cuanto antes, pero no que llegue antes: su valor está en
   * las operaciones que NO consigan subir. Una que sí sube deja al servidor
   * enterado igual, así que bloquear la cola detrás de este aviso solo
   * retrasaría el envío de verdad —y si el aviso fallara, lo pararía—.
   */
  avisarDeLoPendiente()

  try {
    let siguiente = propias()[0]
    while (siguiente) {
      const sigue = await procesarUno(siguiente)
      if (!sigue) return
      siguiente = propias()[0]
    }
    useSyncStore.getState().terminarSincronizacion(null)
  } finally {
    procesando = false
  }
}

/**
 * Agrega (o reemplaza) un envío. Devuelve una promesa que se resuelve cuando el
 * servidor lo acepta y se rechaza cuando se agotan los reintentos, para que la
 * fila pueda mostrar su estado sin saber nada de la cola.
 */
/**
 * @param dependeDe clave de otro envío que TIENE que llegar antes. Si aquel se
 *   descarta por un error definitivo, este se descarta con él en vez de salir
 *   solo. Lo necesita el cierre de una actividad: sin su inicio, el servidor
 *   responde 404 por una actividad que nunca llegó a existir.
 * @param exigePersistencia el envío no vale si no queda guardado en
 *   IndexedDB. Lo pide CU022: la asistencia se marca sin botón de guardar, así
 *   que si el apunte local falla hay que decirlo y deshacer el clic, o el
 *   docente creería registrada una asistencia que solo existe en la pantalla.
 * @param fusionar `(payloadPendiente, payloadNuevo) => payload`. Para los
 *   módulos que mandan SOLO lo que cambió (Lectura, Rúbrica, Vuelo): si la
 *   fila ya tenía un envío esperando, el nuevo lo sustituye sumándole los
 *   campos del anterior, o el primer cambio se perdería.
 */
export function encolar({
  clave,
  tipo,
  payload,
  descripcion,
  dependeDe = null,
  exigePersistencia = false,
  idActividad = null,
  /**
   * E2 — Los datos naturales del registro que esta operación crea o modifica.
   *
   * Lo declara quien encola, porque solo él sabe de qué registro se trata:
   * para una asistencia es (colegio, grado, sección, fecha, alumno); para una
   * fila de lectura, (colegio, grado, sección, subprograma, semana, alumno).
   * `alumnos` y `actividad` NO lo admiten: mandarlo ahí es un 422 del lote.
   */
  registro = null,
  fusionar = null,
}) {
  // Uno que ya está saliendo no se reemplaza: el nuevo va detrás, aparte.
  const usuario = usuarioActual()
  const anterior = cola.findIndex(
    (item) => item.clave === clave && item.idOperacion !== enVuelo && esDeLaSesion(item, usuario),
  )
  const item = {
    clave,
    tipo,
    // D92 — De quién es: solo su dueño puede enviarla (CU007).
    usuario,
    registro,
    payload: anterior >= 0 && fusionar ? fusionar(cola[anterior].payload, payload) : payload,
    descripcion,
    dependeDe,
    /**
     * Una edición que reemplaza a otra pendiente es una operación NUEVA, con
     * su propio id. Reutilizar el de la anterior haría que el servidor
     * descartara la corrección por idempotente, que es justo lo contrario de
     * lo que quiere quien acaba de corregir.
     */
    idOperacion: nuevoIdOperacion(),
    // A qué actividad de trabajo pertenece, para el aviso de pendientes.
    idActividad,
    intentos: 0,
    error: null,
    verificar: false,
    creado: new Date().toISOString(),
  }

  if (anterior >= 0) {
    // La edición más reciente reemplaza a la pendiente: nunca dos envíos de la
    // misma fila-semana en la cola.
    resolverPromesa(cola[anterior].idOperacion, { reemplazado: true })
    cola[anterior] = item
  } else {
    cola.push(item)
  }

  const promesa = new Promise((resolve, reject) => promesas.set(item.idOperacion, { resolve, reject }))
  persistir().then((guardado) => {
    if (!guardado && exigePersistencia) {
      // Fuera de la cola: dejarlo ahí prometería un reintento que no
      // sobrevivirá a cerrar la pestaña.
      cola = cola.filter((pendiente) => pendiente.idOperacion !== item.idOperacion)
      publicarEstado()
      rechazarPromesa(item.idOperacion, errorDePersistencia())
      return
    }
    procesar()
  })
  return promesa
}

/**
 * Qué pasó con MI operación dentro de un lote.
 *
 * Las escrituras de los cuatro módulos responden por ítem —`{id_operacion,
 * estado, motivo, detail, registro}`— y un mismo lote puede traer aceptados y
 * rechazados a la vez. Así que un 200 no significa "todo bien": hay que mirar
 * el ítem propio. Esto lo lee igual en los cuatro módulos, en vez de que cada
 * uno lo interprete a su manera.
 *
 * Si la respuesta no trae `registros` —un endpoint que todavía no se ha
 * actualizado—, se da por aceptada: era lo que significaba un 200 hasta ahora.
 */
export function resultadoDeLote(respuesta, idOperacion) {
  const registros = respuesta?.registros
  if (!Array.isArray(registros)) return { estado: 'aceptada', registro: respuesta }

  const mio = registros.find((r) => r.id_operacion === idOperacion) ?? registros[0]
  if (!mio) return { estado: 'aceptada', registro: respuesta }
  return {
    estado: mio.estado ?? 'aceptada',
    motivo: mio.motivo ?? null,
    detail: mio.detail ?? null,
    registro: mio.registro ?? mio,
  }
}

/**
 * ¿Es un choque de versiones?
 *
 * No es un fallo de red ni del servidor: alguien cambió ese registro mientras
 * esta persona lo miraba. No se reintenta —reintentar pisaría el cambio ajeno—
 * y la pantalla tiene que recargar y decirlo.
 */
export const esModificacionConcurrente = (error) => motivoDe(error) === 'modificacion_concurrente'

/**
 * Corrige los envíos que esperan (no el que está saliendo).
 *
 * Lo usa el control de versión: si una edición de la fila se aceptó y subió
 * la versión, la siguiente edición de esa misma fila, ya encolada con la
 * versión vieja, chocaría contra el propio cambio del docente.
 */
export function ajustarPendientes(transformar) {
  cola = cola.map((item) => (item.idOperacion === enVuelo ? item : transformar(item)))
  return persistir()
}

/** Reintento manual desde el panel del SyncBadge. */
export function reintentarAhora() {
  cola.forEach((item) => {
    item.intentos = 0
    item.error = null
  })
  clearTimeout(temporizador)
  return persistir().then(() => procesar())
}

/** Carga la cola guardada y se suscribe a la vuelta de la conexión. */
export async function iniciarCola() {
  if (iniciada) return
  iniciada = true

  try {
    const guardada = await get(CLAVE_IDB)
    if (Array.isArray(guardada) && guardada.length > 0) {
      cola = guardada
      publicarEstado()
    }
  } catch {
    // Sin IndexedDB no hay nada que recuperar.
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => procesar())
  }

  // Al iniciar sesión se envía lo que quedó pendiente de la sesión anterior
  // (por ejemplo, el cierre de una actividad hecho sin conexión).
  useSessionStore.subscribe((estado, previo) => {
    if (estado.token === previo.token) return
    // Otra cuenta ve otros pendientes (D92).
    publicarEstado()
    // `procesar` ya maneja sus errores: el catch solo cierra la promesa.
    if (estado.token) procesar().catch(() => null)
  })

  if (cola.length > 0) procesar().catch(() => null)
}

/** ¿Cuántos cambios quedan sin enviar? Lo consulta el cierre de sesión. */
export const hayPendientes = () => cola.length

/**
 * Limpia los datos locales al cerrar sesión — pero SOLO si no queda nada
 * pendiente.
 *
 * Son dos reglas que parecen contradecirse y no lo hacen: IndexedDB guarda
 * datos de menores y hay que borrarlo al salir, pero CU007 prohíbe que el
 * cierre de sesión elimine cambios que todavía no llegaron al servidor. Se
 * resuelve limpiando solo cuando la cola está vacía; si queda algo, se conserva
 * y se envía tras el siguiente inicio de sesión.
 *
 * @returns {Promise<boolean>} true si se limpió, false si había pendientes.
 */
export async function limpiarSiTodoSincronizado() {
  if (cola.length > 0) return false
  try {
    await del(CLAVE_IDB)
  } catch {
    // Sin IndexedDB disponible no hay nada que limpiar.
  }
  return true
}

/** Solo para los tests: deja la cola como recién abierta. */
export function _reiniciarCola() {
  cola = []
  promesas.clear()
  iniciada = false
  procesando = false
  enVuelo = null
  clearTimeout(temporizador)
  publicarEstado()
}
