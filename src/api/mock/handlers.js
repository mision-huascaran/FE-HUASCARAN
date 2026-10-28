// Resuelve cada endpoint contra `db.js` con un retardo de 300ms (§3), para que
// los estados de carga de la interfaz se vean como se verán con el backend real.
//
// Los errores imitan la forma de un error de axios (`error.response.status`), de
// modo que el resto de la aplicación trata igual al mock y a la API.
import * as db from './db'
import * as agregados from './consolidados'
import { esCorreoValido } from '../../lib/validacion'
import { sincronizarReloj } from '../../lib/relojServidor'

const RETARDO_MS = 300

// Textos que se repiten en varias respuestas del simulador.
const CLASE_PROGRAMADA = 'Clase programada'
const ALUMNO_NO_EXISTE = 'El alumno no existe'
const CORREO_REGISTRADO = 'Ese correo ya está registrado'

/** Permisos otorgados durante la sesión (CU028). Viven aquí, no en `db`. */
const PERMISOS_MOCK = {}

/**
 * Calendarios por `${anio}|general` o `${anio}|${idColegio}` (CU027).
 *
 * El año 2 —el vigente— arranca con su general ya configurado, que es el caso
 * normal. Los demás no tienen ninguno, para poder ver el 404 que la pantalla
 * traduce en "hay que crearlo".
 */
const CALENDARIOS_MOCK = {}

let ultimoIdCalendario = 1
const siguienteIdCalendario = () => (ultimoIdCalendario += 1)

/** El id de un PA se deduce de su número; el de un PR, del PA anterior. */
const conIdDePeriodo = (periodos = []) =>
  periodos.map((p) => ({ ...p, id_periodo_academico: p.id_periodo_academico ?? 30 + Number(p.numero) }))

/**
 * El estado de un permiso NO se guarda: se calcula con la hora.
 *
 * Por eso un permiso caduca solo, sin que nadie refresque nada, y por eso la
 * pantalla no puede fiarse de un campo guardado.
 */
function conEstado(permiso) {
  const ahora = Date.now()
  let estado = 'vigente'
  if (permiso.revocado_en) estado = 'revocado'
  else if (Date.parse(permiso.inicio) > ahora) estado = 'programado'
  else if (Date.parse(permiso.fin) <= ahora) estado = 'vencido'
  return { ...permiso, estado }
}

/**
 * Calendario del año lectivo del simulador (CU027): cuatro PA con su receso.
 *
 * Los ocho periodos van seguidos y sin huecos dentro del año, como en un
 * calendario real. Diciembre queda fuera a propósito, para tener a mano una
 * fecha "fuera de todo periodo" con la que probar ese borde.
 */
const CALENDARIO_MOCK = {
  id_calendario: 1,
  origen: 'general',
  version: 1,
  periodos: [
    { tipo: 'PA', numero: 1, id_periodo_academico: 31, fecha_inicio: '2026-03-02', fecha_fin: '2026-05-15' },
    { tipo: 'PR', numero: 1, id_periodo_academico: 91, fecha_inicio: '2026-05-16', fecha_fin: '2026-05-31' },
    { tipo: 'PA', numero: 2, id_periodo_academico: 32, fecha_inicio: '2026-06-01', fecha_fin: '2026-07-31' },
    { tipo: 'PR', numero: 2, id_periodo_academico: 92, fecha_inicio: '2026-08-01', fecha_fin: '2026-08-15' },
    { tipo: 'PA', numero: 3, id_periodo_academico: 33, fecha_inicio: '2026-08-16', fecha_fin: '2026-10-31' },
    { tipo: 'PR', numero: 3, id_periodo_academico: 93, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-08' },
    { tipo: 'PA', numero: 4, id_periodo_academico: 34, fecha_inicio: '2026-11-09', fecha_fin: '2026-11-30' },
    { tipo: 'PR', numero: 4, id_periodo_academico: 94, fecha_inicio: '2026-12-01', fecha_fin: '2026-12-15' },
  ],
  dias_no_lectivos: [
    { id: 1, motivo: 'Día de la Independencia', fecha_inicio: '2026-07-28', fecha_fin: '2026-07-29', origen: 'automatico' },
    { id: 2, motivo: 'Feriado', fecha_inicio: '2026-10-08', fecha_fin: '2026-10-08', origen: 'automatico' },
  ],
}

/**
 * El año vigente arranca con su calendario general ya configurado, que es el
 * caso normal. Los demás años no tienen ninguno, para poder ver el 404 que la
 * pantalla traduce en "hay que crearlo" —que no es un error, es un estado—.
 *
 * Se siembra aquí y no en la declaración de `CALENDARIOS_MOCK` porque esa va
 * antes en el archivo y leer `CALENDARIO_MOCK` desde ahí reventaría al cargar.
 */
CALENDARIOS_MOCK['2|general'] = {
  id_calendario: 1,
  id_anio_escolar: 2,
  origen: 'general',
  version: 1,
  periodos: CALENDARIO_MOCK.periodos,
  dias_no_lectivos: CALENDARIO_MOCK.dias_no_lectivos,
}

function copiar(datos) {
  return structuredClone(datos)
}

/**
 * Toda respuesta del simulador ancla el reloj, igual que la cabecera `Date` de
 * una respuesta real (ver `api/client.js`).
 *
 * No es un detalle de pruebas: sin esto, trabajar contra el simulador dejaría
 * la referencia temporal sin verificar para siempre y CU010 bloquearía todas
 * las escrituras. El simulador hace de servidor, y un servidor dice qué hora
 * es.
 */
function responder(datos, ms = RETARDO_MS) {
  return new Promise((resolver) =>
    setTimeout(() => {
      sincronizarReloj(new Date().toISOString())
      resolver(copiar(datos))
    }, ms),
  )
}

/**
 * Error con la MISMA forma que el de axios, para que las pantallas puedan
 * ramificar por `motivo` igual que contra el backend real.
 */
function errorMock(status, detail, motivo) {
  const error = new Error(detail)
  error.response = { status, data: { detail, motivo } }
  return error
}

const ACTIVIDADES_MOCK = {}

// Marcas de asistencia tomadas durante la sesion (CU022). Viven aqui y no en
// `db`, que se importa de solo lectura. Y viven POR CLASE, no por alumno: desde
// la tanda 6 la unicidad es (clase, alumno), no (alumno, fecha, subprograma).
/** Una clase: colegio, grado, seccion y fecha. El subprograma no entra. */
const claveDeClase = (idColegio, idGrado, idSeccion, fecha) => `${idColegio}|${idGrado}|${idSeccion}|${fecha}`

/** Clases creadas durante la sesion, con su lista congelada y sus marcas. */
const CLASES_MOCK = {}

// ── Programacion de clases y reprogramaciones (CU013) ───────────────────────
//
// Una clase es colegio x grado x seccion x fecha VIGENTE. Reprogramar no crea
// otra: cambia su fecha vigente y deja la original en el historial.
const REPROGRAMACIONES_MOCK = {}
let ultimoIdReprogramacion = 700

/** El dia habitual de clase de cada grado, tal como lo configura CU013. */
const DIA_HABITUAL = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 1 }

const claveDeProgramacion = (idColegio, idGrado, idSeccion, fechaOriginal) =>
  `${idColegio}|${idGrado}|${idSeccion}|${fechaOriginal}`

/**
 * Las clases HABITUALES de un rango, segun el dia de clase de cada grado.
 *
 * Solo dentro de los PA y excluyendo los dias no lectivos: es lo que hace el
 * backend al cruzar el dia habitual con el calendario del colegio.
 */
function clasesHabituales({ idColegio, idGrado, idSeccion, desde, hasta }) {
  const salida = []
  const inicio = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)
  const grados = db.GRADOS.filter((g) => !idGrado || Number(g.id_grado) === Number(idGrado))

  for (const grado of grados) {
    const diaDeClase = DIA_HABITUAL[grado.id_grado] ?? 1
    for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== diaDeClase) continue
      const fecha = d.toISOString().slice(0, 10)
      if (!esDiaLectivo(fecha)) continue

      const seccion = Number(idSeccion) || 2
      const clave = claveDeProgramacion(idColegio, grado.id_grado, seccion, fecha)
      const traslado = REPROGRAMACIONES_MOCK[clave]
      const vigente = traslado?.fecha_nueva ?? fecha
      const guardada = CLASES_MOCK[claveDeClase(idColegio, grado.id_grado, seccion, vigente)]

      // Los subprogramas salen de los ALUMNOS de la clase en su fecha
      // vigente: de la lista congelada si ya tiene asistencias, y si no, de
      // quienes pertenecen hoy. Puede quedar vacio.
      const alumnos = guardada?.lista ?? db.alumnosDe({ colegio: Number(idColegio), grado: grado.id_grado })
      const ids = [...new Set(alumnos.map((a) => Number(a.id_programa)))].sort((x, y) => x - y)
      const subprogramas = ids
        .map((id) => db.PROGRAMAS.find((pr) => pr.id_programa === id))
        .filter(Boolean)
        .map((pr) => ({ id: pr.id_programa, nombre: pr.nombre }))

      salida.push({
        id_clase: guardada?.id_clase ?? null,
        id_grado: grado.id_grado,
        grado: { id: grado.id_grado, nombre: grado.nombre },
        id_seccion: seccion,
        seccion: { id: seccion, nombre: 'Unica' },
        fecha_original: fecha,
        fecha: vigente,
        tipo: 'habitual',
        reprogramada: Boolean(traslado),
        tiene_asistencias: Boolean(guardada && Object.keys(guardada.marcas ?? {}).length),
        id_periodo_academico: 2,
        version: traslado?.version ?? null,
        subprogramas,
      })
    }
  }

  // El orden del contrato: fecha vigente, grado y seccion.
  return salida.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.id_grado - b.id_grado || a.id_seccion - b.id_seccion,
  )
}

// ── Tablas de lectura semanal (CU023 a CU026) ───────────────────────────────
//
// La tabla es grupo x subprograma x semana, y su MES es el de su clase de
// referencia: una semana partida entre dos meses va entera en el mes de su
// clase. Por eso el mes forma parte de la clave y no se deduce de la semana.
const TABLAS_LECTURA = {}
let ultimoIdTabla = 300
const siguienteIdTabla = () => ++ultimoIdTabla

const claveDeTabla = ({ idColegio, idPrograma, idGrado, idSeccion, mes, idSemana }) =>
  `${idColegio}|${idGrado}|${idSeccion}|${idPrograma}|${mes}|${idSemana}`

const porIdDeTabla = (id) => {
  const tabla = Object.values(TABLAS_LECTURA).find((t) => Number(t.id) === Number(id))
  if (!tabla) throw errorMock(404, 'La tabla de lectura no se encuentra disponible.', 'tabla_no_encontrada')
  return tabla
}

/**
 * La version que se leyo tiene que seguir siendo la vigente.
 *
 * Sin esto, dos docentes editando la misma tabla se pisaban sin enterarse: el
 * segundo guardaba encima y el primero nunca sabia que su cambio se perdio.
 */
function exigirVersionDeTabla(tabla, version) {
  if (version != null && Number(version) !== Number(tabla.version)) {
    throw errorMock(
      409,
      'La tabla fue modificada por otro usuario. Vuelve a consultarla e intentalo de nuevo.',
      'modificacion_concurrente',
    )
  }
}

/** Datos de LECTURA. Una observacion NO cuenta: el contrato lo dice aparte. */
const conDatosDeLectura = (d) =>
  d != null && [d.lsn_titulo, d.lsn_nota, d.lsn_maximo, d.cantidad_lsl].some((v) => v != null)

/** Un envio que solo BORRA (todo en null): se admite incluso con ausente. */
const soloBorra = (f) =>
  ['lsn_titulo', 'lsn_nota', 'lsn_maximo', 'cantidad_lsl'].every((c) => !(c in f) || f[c] === null)

/**
 * La clase de referencia que se propone para una semana.
 *
 * La habitual o reprogramada; `null` si la semana solo tiene adicionales, y
 * entonces el docente tiene que elegir una. En el simulador se toma el lunes,
 * que es la habitual, y se marca `id_clase: null` si todavia no tiene fila:
 * para elegirla se usa su fecha.
 */
function claseSugeridaDe(semana) {
  if (!esDiaLectivo(semana.inicio)) return null
  const claveDelLunes = Object.keys(CLASES_MOCK).find((k) => k.endsWith(`|${semana.inicio}`))
  return {
    id_clase: CLASES_MOCK[claveDelLunes]?.id_clase ?? null,
    fecha: semana.inicio,
    tipo: 'habitual',
    reprogramada: false,
  }
}

/** La asistencia de un alumno en la clase de referencia de la tabla. */
const asistenciaEnReferencia = (tabla, idAlumno) =>
  CLASES_MOCK[tabla.clave_clase]?.marcas?.[idAlumno]?.estado ?? null

const asistioALaReferencia = (tabla, idAlumno) =>
  ['presente', 'tardanza'].includes(asistenciaEnReferencia(tabla, idAlumno))

/**
 * Una fila de la tabla: el alumno, su asistencia y sus libros.
 *
 * `total_libros` se CALCULA —(1 si hay LSN) + los LSL— y no es editable: es un
 * dato derivado, y dejar que el cliente lo mandara seria admitir que cuadre
 * mal. `cantidad_lsl: null` NO es cero: es "no registrado", y de ahi que la
 * fila siga pendiente en vez de darse por completada con cero libros.
 */
function filaDe(tabla, idAlumno) {
  const clase = CLASES_MOCK[tabla.clave_clase]
  const alumno = (clase?.lista ?? []).find(
    (a) => Number(a.id_alumno) === Number(idAlumno) && Number(a.id_programa) === Number(tabla.id_programa),
  )
  if (!alumno) return null

  const d = tabla.datos[idAlumno] ?? {}
  const asistencia = asistenciaEnReferencia(tabla, idAlumno)
  const presente = ['presente', 'tardanza'].includes(asistencia)
  const hayLsn = d.lsn_titulo != null
  const lsl = d.cantidad_lsl ?? null

  const noAplica = tabla.estado === 'no_realizada' || asistencia === 'ausente'
  let estadoFila = 'pendiente'
  if (noAplica) estadoFila = 'no_aplica'
  else if (presente && lsl != null) estadoFila = 'completada'

  return {
    id_alumno: alumno.id_alumno,
    nombre: `${alumno.apellidos}, ${alumno.nombres}`,
    inactivo: alumno.activo === false,
    asistencia,
    // El nivel academico lo completa el Registro de Vuelo (tanda 9).
    nivel_academico: null,
    lsn_titulo: d.lsn_titulo ?? null,
    lsn_nota: d.lsn_nota ?? null,
    lsn_maximo: d.lsn_maximo ?? null,
    cantidad_lsl: lsl,
    total_libros: (hayLsn ? 1 : 0) + (lsl ?? 0),
    observacion: d.observacion ?? null,
    estado_fila: estadoFila,
    // Tiene libros guardados pero HOY consta ausente: alguien corrigio la
    // asistencia despues. No se borra nada solo; se avisa para que el docente
    // decida, que es lo que pide CU024.
    revisar_asistencia: Boolean(conDatosDeLectura(d) && asistencia === 'ausente'),
    version: d.version ?? null,
  }
}

// ── Registro de Vuelo (CU031, CU032) ───────────────────────────────────────
//
// Una decision por alumno y PERIODO ACADEMICO del ano. El reparto de
// responsabilidades es lo que hay que reproducir bien: el SERVIDOR calcula la
// entrada, la sugerencia y el nivel del programa; el DOCENTE registra el nivel
// colocado, la proyeccion y la observacion.
const DECISIONES_MOCK = {}

const claveDeDecision = (idAlumno, idPeriodo) => `${idAlumno}|${idPeriodo}`

/** Los modulos que un atajo de CU021 puede abrir. Lista CERRADA del contrato. */
const MODULOS_DE_ACTIVIDAD_MOCK = new Set(['asistencias', 'lectura', 'rubrica', 'registro_vuelo', 'alumnos'])

/** `futuro`, `en_curso` o `culminado` según la fecha de hoy. */
function estadoDelTramo(hoy, { inicio, fin }) {
  if (hoy < inicio) return 'futuro'
  return hoy > fin ? 'culminado' : 'en_curso'
}

/** La regla de avance de la rúbrica: desde 28 décimas sube, desde 16 mantiene y debajo baja. */
function accionDeRubrica(decimas) {
  if (decimas >= 28) return 'subir'
  return decimas >= 16 ? 'mantener' : 'bajar'
}

/** Por debajo de aa o por encima de Z no hay a dónde ir: se queda en el extremo. */
function excepcionDeExtremo(fuera, destino) {
  if (!fuera) return null
  return destino < 1 ? 'aa' : 'Z'
}

/** El resultado `rechazada` de un item de un lote. */
const rechazoDeItem = (item) => (motivo, detail, registro = null) => ({
  id_operacion: item.id_operacion,
  estado: 'rechazada',
  motivo,
  detail,
  registro,
})

/** Un LSN va completo (título, nota y máximo) y con la nota entre 0 y el máximo (5 o 10). */
function rechazoDeLsn(titulo, nota, maximo) {
  const partes = [titulo, nota, maximo]
  if (partes.some((v) => v != null) && partes.some((v) => v == null)) {
    return ['lsn_incompleto', 'Para registrar un LSN, completa el titulo, la nota obtenida y el puntaje maximo.']
  }
  const fueraDeRango = ![5, 10].includes(Number(maximo)) || nota < 0 || nota > Number(maximo)
  if (partes.every((v) => v != null) && fueraDeRango) {
    return ['lsn_invalido', 'Selecciona un maximo de 5 o 10 e ingresa una nota entre 0 y ese maximo.']
  }
  return null
}

/** Los cuatro PA del ano, con su estado segun la fecha de hoy. */
function periodosDelAnio() {
  const anio = db.ANIO_LECTIVO
  const tramos = [
    { numero: 1, inicio: `${anio}-03-02`, fin: `${anio}-05-15` },
    { numero: 2, inicio: `${anio}-05-18`, fin: `${anio}-07-17` },
    { numero: 3, inicio: `${anio}-08-03`, fin: `${anio}-10-02` },
    { numero: 4, inicio: `${anio}-10-05`, fin: `${anio}-12-18` },
  ]
  const hoy = hoyLima()
  return tramos.map((t) => ({
    numero: t.numero,
    id_periodo_academico: 4 + t.numero,
    nombre: `PA${t.numero}`,
    fecha_inicio: t.inicio,
    fecha_fin: t.fin,
    estado: estadoDelTramo(hoy, t),
  }))
}

/** La letra con la que entra cada grado en PA1 (1.o aa, 2.o C, 3.o F...). */
const LETRA_POR_GRADO = { 1: 'aa', 2: 'C', 3: 'F', 4: 'J', 5: 'M', 6: 'Q' }

const nivelPorLetra = (letra) => {
  const n = db.NIVELES_RAZKIDS.find((x) => x.letra === letra)
  return n ? { id: n.id_nivel_razkids, letra: n.letra } : null
}

const nivelPorId = (id) => {
  const n = db.NIVELES_RAZKIDS.find((x) => x.id_nivel_razkids === Number(id))
  return n ? { id: n.id_nivel_razkids, letra: n.letra } : null
}

/**
 * La ENTRADA de un periodo.
 *
 * PA1 entra por la letra del grado. PA2 a PA4 entran por el nivel COLOCADO del
 * periodo anterior, y si ese no existe todavia la entrada queda PENDIENTE: no
 * se cae a la letra del grado, porque daria por buena una entrada inventada y
 * arrastraria el error a todos los periodos siguientes.
 */
function entradaDe(alumno, numero, periodos) {
  if (numero === 1) {
    return {
      nivel: nivelPorLetra(LETRA_POR_GRADO[alumno.id_grado] ?? 'aa'),
      origen: 'grado',
      texto: 'Nivel inicial segun el grado del alumno.',
    }
  }
  const anterior = periodos.find((p) => p.numero === numero - 1)
  const decision = DECISIONES_MOCK[claveDeDecision(alumno.id_alumno, anterior?.id_periodo_academico)]
  if (!decision?.id_nivel_colocado) {
    return { nivel: null, origen: 'pendiente_periodo_anterior', texto: 'Pendiente del periodo anterior' }
  }
  return {
    nivel: nivelPorId(decision.id_nivel_colocado),
    origen: 'periodo_anterior',
    texto: 'Proviene del nivel colocado en el periodo anterior.',
  }
}

/** El nivel del programa segun el grado y el nivel colocado. */
function nivelDePrograma(alumno, idNivelColocado) {
  if (!idNivelColocado) return null
  const colocado = db.NIVELES_RAZKIDS.find((n) => n.id_nivel_razkids === Number(idNivelColocado))
  const esperado = db.NIVELES_RAZKIDS.find((n) => n.letra === (LETRA_POR_GRADO[alumno.id_grado] ?? 'aa'))
  const diferencia = (colocado?.orden ?? 0) - (esperado?.orden ?? 0)
  if (diferencia < 0) return 'Inicio'
  if (diferencia < 3) return 'En proceso'
  if (diferencia < 6) return 'Logrado'
  return 'Avanzado'
}

/**
 * La SUGERENCIA del motor, sobre la ultima rubrica completa del alumno.
 *
 * Sin rubrica completa o sin entrada no hay sugerencia: "Pendiente de
 * evaluar". Inventar una sobre datos incompletos seria peor que no darla,
 * porque el docente la leeria como una recomendacion fundada.
 */
function sugerenciaDe(alumno, entrada) {
  const rubricas = Object.entries(RUBRICAS_MOCK)
    .filter(([clave]) => clave.startsWith(`${alumno.id_alumno}|`))
    .map(([clave, valor]) => ({ mes: Number(clave.split('|')[1]), ...valor }))
    .filter((r) => r.fluidez != null && r.comprension != null)
    .sort((a, b) => b.mes - a.mes)

  const ultima = rubricas[0]
  if (!ultima || !entrada.nivel) {
    return { accion: null, nivel: null, texto: 'Pendiente de evaluar', resultado_decimas: null, excepcion: null, rubrica: null }
  }

  const decimas = 4 * ultima.fluidez + 6 * ultima.comprension
  const accion = accionDeRubrica(decimas)
  const salto = { subir: 1, mantener: 0, bajar: -1 }[accion]

  // Las excepciones de los extremos: por debajo de aa y por encima de Z no hay
  // nada, asi que la sugerencia se queda donde esta y lo dice.
  const orden = db.NIVELES_RAZKIDS.find((n) => n.id_nivel_razkids === entrada.nivel.id)?.orden ?? 1
  const destino = orden + salto
  const fuera = destino < 1 || destino > db.NIVELES_RAZKIDS.length
  const nivel = fuera ? entrada.nivel : nivelPorId(db.NIVELES_RAZKIDS.find((n) => n.orden === destino)?.id_nivel_razkids)

  return {
    accion: fuera ? 'mantener' : accion,
    nivel,
    texto: fuera ? 'Mantener nivel' : { subir: 'Subir nivel', mantener: 'Mantener nivel', bajar: 'Bajar nivel' }[accion],
    resultado_decimas: decimas,
    excepcion: excepcionDeExtremo(fuera, destino),
    rubrica: {
      id: ultima.id,
      mes: `${db.ANIO_LECTIVO}-${String(ultima.mes).padStart(2, '0')}`,
      fluidez: NOMBRES_RUBRICA[ultima.fluidez],
      comprension: NOMBRES_RUBRICA[ultima.comprension],
      resultado_decimas: decimas,
    },
  }
}

const NOMBRES_RUBRICA = ['Pre-inicio', 'Inicio', 'En proceso', 'Logrado', 'Avanzado']

/** El periodo de un alumno, ya resuelto: lo calculado y lo decidido. */
function periodoDeAlumno(alumno, periodo, periodos) {
  const decision = DECISIONES_MOCK[claveDeDecision(alumno.id_alumno, periodo.id_periodo_academico)]
  const entrada = entradaDe(alumno, periodo.numero, periodos)
  const colocado = decision?.id_nivel_colocado ? nivelPorId(decision.id_nivel_colocado) : null

  // Si ya hay decision y la entrada de hoy no es la que habia al decidir,
  // alguien corrigio el PA anterior. Se avisa en vez de recalcular: la
  // decision del docente no se toca sola.
  const cambio = Boolean(colocado && decision.id_nivel_entrada && decision.id_nivel_entrada !== (entrada.nivel?.id ?? null))

  return {
    numero: periodo.numero,
    id_periodo_academico: periodo.id_periodo_academico,
    id_registro: decision?.id ?? null,
    version: decision?.version ?? null,
    entrada,
    sugerencia: sugerenciaDe(alumno, entrada),
    nivel_colocado: colocado,
    nivel_programa: nivelDePrograma(alumno, decision?.id_nivel_colocado),
    proyeccion: decision?.id_nivel_proyeccion ? nivelPorId(decision.id_nivel_proyeccion) : null,
    observacion: decision?.observacion ?? null,
    aviso_entrada_cambio: cambio,
    aviso: cambio
      ? 'La entrada de este periodo cambio despues de registrar el nivel colocado: revisa la decision.'
      : null,
    // Lo que falta es el NIVEL COLOCADO: la proyeccion y la observacion son
    // opcionales, asi que no dejan el periodo incompleto.
    incompleto: !colocado,
  }
}

// ── Rubrica mensual (CU029, CU030) ──────────────────────────────────────────
//
// UNA evaluacion por alumno y mes. Los codigos son numeros y el 0 ES UN VALOR
// ("Pre-inicio"): `null` significa "sin evaluar", y confundirlos haria que un
// alumno sin evaluar apareciera como el peor de la clase.
const RUBRICAS_MOCK = {}
let ultimoIdRubrica = 500
const siguienteIdRubrica = () => ++ultimoIdRubrica

const claveDeRubrica = (idAlumno, mes, idAnioEscolar) => `${idAlumno}|${mes}|${idAnioEscolar}`

/**
 * Lo que admite cada dimension, por subprograma.
 *
 * Alfabetizacion acepta 0 en Fluidez —hay alumnos que todavia no reconocen las
 * letras— y Comprension empieza en 1 en los dos, porque quien ya esta en el
 * subprograma lee algo por definicion.
 */
const ESCALA_MOCK = {
  Alfabetizacion: { fluidez: [0, 1, 2, 3, 4], comprension: [1, 2, 3, 4] },
  'Comprension Lectora': { fluidez: [1, 2, 3, 4], comprension: [1, 2, 3, 4] },
}

const sinTildesSimple = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')

const escalaDeProgramaMock = (nombre) =>
  ESCALA_MOCK[sinTildesSimple(nombre)] ?? { fluidez: [0, 1, 2, 3, 4], comprension: [1, 2, 3, 4] }

/** El item del GET: estado y resultado SE CALCULAN, no se guardan. */
function itemDeRubrica(alumno, guardada) {
  const f = guardada?.fluidez ?? null
  const c = guardada?.comprension ?? null
  const puestas = [f, c].filter((v) => v != null).length

  return {
    id_alumno: alumno.id_alumno,
    nombre: `${alumno.apellidos}, ${alumno.nombres}`,
    inactivo: alumno.activo === false,
    id_rubrica: guardada?.id ?? null,
    fluidez: f,
    comprension: c,
    // Una sola dimension es `incompleta` y SE PUEDE GUARDAR: el docente no
    // tiene por que evaluar las dos cosas en la misma sentada.
    estado: ['pendiente', 'incompleta', 'completada'][puestas],
    // En DECIMAS: 4F + 6C, o sea F x 0,40 + C x 0,60. 26 es 2,6.
    resultado_decimas: puestas === 2 ? 4 * f + 6 * c : null,
    version: guardada?.version ?? null,
  }
}

/** La tabla con sus filas ya armadas, que es como la devuelve el servidor. */
function conFilas(tabla) {
  const clase = CLASES_MOCK[tabla.clave_clase]
  const filas = (clase?.lista ?? [])
    .filter((a) => Number(a.id_programa) === Number(tabla.id_programa))
    .map((a) => filaDe(tabla, a.id_alumno))
    .filter(Boolean)

  return {
    id: tabla.id,
    version: tabla.version,
    estado: tabla.estado,
    motivo_no_realizada: tabla.motivo_no_realizada,
    id_colegio: tabla.id_colegio,
    id_grado: tabla.id_grado,
    id_seccion: tabla.id_seccion,
    id_programa: tabla.id_programa,
    id_anio_escolar: tabla.id_anio_escolar,
    mes: tabla.mes,
    id_semana: tabla.id_semana,
    clase_referencia: {
      id_clase: clase?.id_clase ?? null,
      fecha: tabla.clave_clase.split('|').at(-1),
      tipo: clase?.tipo ?? 'habitual',
      reprogramada: false,
    },
    filas,
    escritura: { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null },
  }
}

let ultimoIdClase = 10
const siguienteIdClase = () => (ultimoIdClase += 1)


/** Hoy en Lima, que es la zona en la que se cuentan los días lectivos. */
const hoyLima = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())

/**
 * Un día es lectivo si cae dentro de alguna semana del año escolar (CU022).
 *
 * Las semanas del simulador van de lunes a viernes, así que esto descarta
 * fines de semana, vacaciones y cualquier fecha fuera del periodo vigente sin
 * necesidad de una tabla de recesos aparte. Contra el backend real la decisión
 * la toma el servidor y el cliente solo lee `dia_lectivo`.
 */
const esDiaLectivo = (fecha) =>
  Boolean(fecha) && db.SEMANAS.some((s) => fecha >= s.inicio && fecha <= s.fin)
const GRILLAS_SEMANALES = {}

function errorHttp(status, detail) {
  const error = new Error(detail)
  error.isAxiosError = true
  error.response = { status, data: { detail } }
  return error
}

/** Token de mentira con la forma `mock.<id_usuario>.<año lectivo>`. */
const armarToken = (idUsuario) => `mock.${idUsuario}.${db.ANIO_LECTIVO}`

function usuarioDeToken(token) {
  const idUsuario = Number(String(token ?? '').split('.')[1])
  return db.USUARIOS.find((u) => u.id_usuario === idUsuario) ?? null
}

/** El usuario que viaja al cliente nunca lleva credenciales. */
const perfilPublico = (usuario) => ({
  id_usuario: usuario.id_usuario,
  id_rol: usuario.id_rol,
  correo: usuario.correo,
  id_docente: usuario.id_docente,
  nombres: usuario.nombres,
  apellidos: usuario.apellidos,
  activo: usuario.activo,
})

/** Guardar tarda un poco más que leer: así se ve el estado "guardando" de P4. */
const RETARDO_ESCRITURA_MS = 450

/** Datos del alumno que acompañan a toda fila de captura o listado. */
function conDatosDeAlumno(alumno) {
  const colegio = db.COLEGIOS.find((c) => c.id_colegio === alumno.id_colegio)
  const ciclo = db.CICLOS.find((c) => c.id_ciclo === alumno.id_ciclo_evaluado)
  return {
    id_alumno: alumno.id_alumno,
    codigo: alumno.codigo,
    nombre: db.nombreCompleto(alumno),
    id_colegio: alumno.id_colegio,
    colegio: colegio?.nombre ?? null,
    id_grado: alumno.id_grado,
    aula: alumno.aula,
    id_programa: alumno.id_programa,
    id_ciclo_evaluado: alumno.id_ciclo_evaluado,
    ciclo_evaluado: ciclo?.nombre ?? null,
    activo: alumno.activo,
  }
}

/**
 * Fila del listado de estudiantes (P10).
 *
 * RN-019 (Ley N.° 29733): aquí solo viajan nombre, código y datos académicos.
 * Ni fecha de nacimiento, ni DNI, ni dirección, ni fotografía.
 */
function fichaDeListado(alumno) {
  const ultima = db.ultimaEvaluacionDe(alumno.id_alumno)
  const periodo = db.PERIODOS.find((p) => p.id_periodo === ultima?.id_periodo)
  const cicloNominal = db.CICLOS.find((c) => c.id_ciclo === alumno.id_ciclo_nominal)
  const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)

  return {
    ...conDatosDeAlumno(alumno),
    id_ciclo_nominal: alumno.id_ciclo_nominal,
    ciclo_nominal: cicloNominal?.nombre ?? null,
    nivel_actual: ultima?.nivel_ajustado ?? null,
    orden_actual: ultima ? db.ordenDeLetra(ultima.nivel_ajustado) : null,
    nivel_general: ultima?.nivel_general ?? null,
    nivel_esperado: esperado?.letra ?? null,
    orden_esperado: esperado?.orden ?? null,
    ultima_evaluacion: periodo ? { id_periodo: periodo.id_periodo, nombre: periodo.nombre, fecha: ultima.fecha } : null,
    estado_evaluacion: ultima?.estado ?? 'sin-registro',
  }
}

/**
 * Un alumno como lo devuelve Administración (CU014), en el listado Y EN EL
 * DETALLE.
 *
 * Tiene que ser el mismo mapeo en los dos: el popup de edición completa la
 * fila con el detalle, y un detalle con menos campos borraba lo que la fila sí
 * traía. Así pasó con la sección, y el formulario tomaba cada edición por un
 * cambio de grupo.
 */
function alumnoDeAdministracion(a) {
  const colegio = db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)
  const grado = db.GRADOS.find((g) => g.id_grado === a.id_grado)
  const programa = db.PROGRAMAS.find((p) => p.id_programa === a.id_programa)
  return {
    ...a,
    nombre: db.nombreCompleto(a),
    codigo: a.codigo,
    colegio: colegio?.nombre ?? '—',
    grado: grado?.nombre ?? a.id_grado,
    programa: programa?.nombre ?? '—',
    // Desde T3 todo alumno pertenece a una sección: la "Única" de su grado, la
    // misma que da el detalle del colegio (100 + id_grado). Sin ella, editar a
    // cualquiera rellenaba la sección y el formulario lo tomaba por un cambio
    // de grupo.
    id_seccion: a.id_seccion ?? 100 + a.id_grado,
    seccion: a.seccion ?? 'Única',
  }
}

/** Encabezado e indicadores de la ficha del estudiante (P11). */
function fichaDeAlumno(alumno) {
  const base = fichaDeListado(alumno)
  const evaluaciones = db.evaluacionesDe(alumno.id_alumno)
  const anterior = evaluaciones.at(-2) ?? null
  const ultima = evaluaciones.at(-1) ?? null

  const semanasDelMes = db.SEMANAS.filter(
    (s) => `${s.anio}-${String(s.mes).padStart(2, '0')}` === db.MES_ACTUAL,
  )
  const reportesDelMes = semanasDelMes
    .map((s) => db.reporteSemanalDe(s.id_semana).get(alumno.id_alumno))
    .filter(Boolean)

  const lsb = reportesDelMes.reduce((n, r) => n + (r.libros?.length ?? 0), 0)
  const lsl = reportesDelMes.reduce((n, r) => n + Number(r.lsl ?? 0), 0)
  const asistencias = reportesDelMes.filter((r) => r.asistio).length

  return {
    ...base,
    programa: db.PROGRAMAS.find((p) => p.id_programa === alumno.id_programa)?.nombre ?? null,
    grado_nombre: db.GRADOS.find((g) => g.id_grado === alumno.id_grado)?.nombre ?? null,
    // RN-014: el nivel de Raz-Kids y el del docente conviven como campos distintos.
    variacion: {
      anterior: anterior?.nivel_ajustado ?? null,
      orden_anterior: anterior ? db.ordenDeLetra(anterior.nivel_ajustado) : null,
      actual: ultima?.nivel_ajustado ?? null,
      orden_actual: ultima ? db.ordenDeLetra(ultima.nivel_ajustado) : null,
    },
    mes_actual: {
      mes: db.MES_ACTUAL,
      lsb,
      lsl,
      total_libros: lsb + lsl,
      semanas_registradas: reportesDelMes.length,
      semanas_mes: semanasDelMes.length,
      asistencias,
    },
  }
}

/** Series y tablas de la ficha del estudiante (P11). */
function historialDeAlumno(alumno) {
  const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)

  // RF-011: evolución entre los cuatro cortes, con el nivel esperado de referencia.
  const evolucion = db.PERIODOS.map((periodo) => {
    const ev = db.evaluacionesDe(alumno.id_alumno).find((e) => e.id_periodo === periodo.id_periodo)
    return {
      id_periodo: periodo.id_periodo,
      periodo: periodo.nombre,
      orden_prueba: ev ? db.ordenDeLetra(ev.nivel_prueba) : null,
      orden_ajustado: ev ? db.ordenDeLetra(ev.nivel_ajustado) : null,
      orden_esperado: esperado?.orden ?? null,
      letra_prueba: ev?.nivel_prueba ?? null,
      letra_ajustado: ev?.nivel_ajustado ?? null,
    }
  })

  const semanasDelMes = db.SEMANAS.filter(
    (s) => `${s.anio}-${String(s.mes).padStart(2, '0')}` === db.MES_ACTUAL,
  )

  const nombreNivel = (id) => db.NIVELES_RUBRICA.find((n) => n.id_nivel_rubrica === id)?.nombre_nivel ?? null

  const rubricaMensual = semanasDelMes.map((semana) => {
    const fila = db.rubricaSemanalDe(semana.id_semana).get(alumno.id_alumno)
    return {
      id_semana: semana.id_semana,
      numero: semana.numero,
      fluidez: fila ? nombreNivel(fila.id_nivel_fluidez) : null,
      comprension: fila ? nombreNivel(fila.id_nivel_comprension) : null,
    }
  })

  // RF-016: LSB con título y puntaje, LSL solo cantidad, total calculado.
  const libros = db.SEMANAS.slice(-8)
    .map((semana) => {
      const fila = db.reporteSemanalDe(semana.id_semana).get(alumno.id_alumno)
      if (!fila) return null
      return {
        id_semana: semana.id_semana,
        numero: semana.numero,
        inicio: semana.inicio,
        fin: semana.fin,
        asistio: fila.asistio,
        libros: fila.libros ?? [],
        lsl: Number(fila.lsl ?? 0),
        observacion: fila.observacion ?? '',
      }
    })
    .filter(Boolean)

  const evaluaciones = db.evaluacionesDe(alumno.id_alumno).map((ev) => ({
    ...ev,
    periodo: db.PERIODOS.find((p) => p.id_periodo === ev.id_periodo)?.nombre ?? null,
    ciclo_evaluado: db.CICLOS.find((c) => c.id_ciclo === alumno.id_ciclo_evaluado)?.nombre ?? null,
  }))

  return { evolucion, rubrica_mensual: rubricaMensual, libros, evaluaciones, nivel_esperado: esperado ?? null }
}

/** Fila del histórico del registro de vuelo: un alumno, sus cuatro cortes (P6). */
function filaHistorico(alumno, idPeriodo) {
  const evaluaciones = db.evaluacionesDe(alumno.id_alumno)
  const esperado = db.NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)
  const porPeriodo = Object.fromEntries(evaluaciones.map((e) => [e.id_periodo, e]))
  const delPeriodo = idPeriodo ? (porPeriodo[Number(idPeriodo)] ?? null) : (evaluaciones.at(-1) ?? null)

  return {
    ...conDatosDeAlumno(alumno),
    grado_nombre: db.GRADOS.find((g) => g.id_grado === alumno.id_grado)?.nombre ?? null,
    nivel_esperado: esperado ?? null,
    // Los cuatro cortes, para las columnas Abril · Julio · Octubre · Diciembre.
    por_periodo: Object.fromEntries(
      db.PERIODOS.map((p) => {
        const ev = porPeriodo[p.id_periodo]
        return [
          p.id_periodo,
          ev
            ? {
                id_evaluacion: ev.id_evaluacion,
                letra: ev.nivel_ajustado,
                orden: db.ordenDeLetra(ev.nivel_ajustado),
                estado: ev.estado,
                ajustado: ev.ajustado_por_docente,
              }
            : null,
        ]
      }),
    ),
    evaluacion: delPeriodo,
    // Secuencia cronológica, para tendencia y "Últimos 3". La comparación la
    // hace el cliente por `orden` (RN-012), nunca por la letra como texto.
    secuencia: evaluaciones.map((e) => ({
      id_periodo: e.id_periodo,
      letra: e.nivel_ajustado,
      orden: db.ordenDeLetra(e.nivel_ajustado),
    })),
  }
}

function asignacionesConColegio(idDocente, idPeriodo) {
  return db.asignacionesDe(idDocente, idPeriodo).map((asignacion) => {
    const colegio = db.COLEGIOS.find((c) => c.id_colegio === asignacion.id_colegio)
    return {
      id_asignacion: asignacion.id_asignacion,
      id_periodo: asignacion.id_periodo,
      id_colegio: asignacion.id_colegio,
      colegio: colegio?.nombre ?? null,
      zona: colegio?.zona ?? null,
      grados: asignacion.grados,
    }
  })
}

/**
 * Indicadores del panel del docente (P3).
 *
 * Pendiente: "Ajustes por revisar" se cuenta aquí como las evaluaciones del periodo
 * vigente cuya sugerencia el docente todavía no confirma. El documento nombra el
 * indicador pero no lo define; hay que confirmarlo con Misión Huascarán.
 */
function resumenDelDocente(idDocente, idPeriodo, idSemana) {
  const asignaciones = asignacionesConColegio(idDocente, idPeriodo)
  const reportes = db.reporteSemanalDe(idSemana)
  const rubricas = db.rubricaSemanalDe(idSemana)
  const evaluaciones = db.EVALUACIONES.filter((e) => e.id_periodo === Number(idPeriodo))

  const detalle = asignaciones.flatMap((asignacion) =>
    asignacion.grados.map((idGrado) => {
      const alumnos = db.alumnosDe({ colegio: asignacion.id_colegio, grado: idGrado })
      return {
        id_colegio: asignacion.id_colegio,
        colegio: asignacion.colegio,
        zona: asignacion.zona,
        id_grado: idGrado,
        total: alumnos.length,
        registrados: alumnos.filter((a) => reportes.has(a.id_alumno)).length,
        sin_rubrica: alumnos.filter((a) => !rubricas.has(a.id_alumno)).length,
      }
    }),
  )

  const misAlumnos = asignaciones.flatMap((a) => db.alumnosDe({ colegio: a.id_colegio }))
  const periodo = db.PERIODOS.find((p) => p.id_periodo === Number(idPeriodo))
  const conEvaluacion = misAlumnos.filter((a) => evaluaciones.some((e) => e.id_alumno === a.id_alumno))

  return {
    id_periodo: Number(idPeriodo),
    id_semana: Number(idSemana),
    mis_estudiantes: misAlumnos.length,
    reporte_semana: {
      registrados: misAlumnos.filter((a) => reportes.has(a.id_alumno)).length,
      total: misAlumnos.length,
    },
    pendientes_rubrica: misAlumnos.filter((a) => !rubricas.has(a.id_alumno)).length,
    ajustes_por_revisar: evaluaciones.filter(
      (e) => e.estado === 'pendiente' && misAlumnos.some((a) => a.id_alumno === e.id_alumno),
    ).length,
    // RN-010: aviso cuando el corte diagnóstico está abierto y falta registrarlo.
    evaluacion_abierta:
      periodo?.estado === 'abierto'
        ? { id_periodo: periodo.id_periodo, nombre: periodo.nombre, registrados: conEvaluacion.length, total: misAlumnos.length }
        : null,
    asignaciones: detalle,
  }
}

/** Una fila de la grilla de captura semanal (P4), con sus columnas de referencia. */
function filaSemanal(alumno, guardada, idSemana) {
  return {
    ...conDatosDeAlumno(alumno),
    id_semana: Number(idSemana),
    id_reporte: guardada?.id_reporte ?? null,
    asistio: guardada?.asistio ?? null,
    lsl: guardada?.lsl ?? 0,
    libros: guardada?.libros ?? [],
    observacion: guardada?.observacion ?? '',
    referencia: db.referenciaDe(alumno),
    actualizado_en: guardada?.actualizado_en ?? null,
  }
}

function filaRubrica(alumno, guardada, idSemana) {
  return {
    ...conDatosDeAlumno(alumno),
    id_semana: Number(idSemana),
    id_rubrica: guardada?.id_rubrica ?? null,
    id_nivel_fluidez: guardada?.id_nivel_fluidez ?? null,
    id_nivel_comprension: guardada?.id_nivel_comprension ?? null,
    actualizado_en: guardada?.actualizado_en ?? null,
  }
}

/** Sin asistencia no hay nada que registrar: así está modelado en la base (P4). */
function normalizarReporte(payload) {
  const asistio = Boolean(payload.asistio)
  return {
    id_alumno: payload.id_alumno,
    id_semana: Number(payload.id_semana),
    asistio,
    lsl: asistio ? Number(payload.lsl ?? 0) : 0,
    libros: asistio ? (payload.libros ?? []) : [],
    observacion: asistio ? (payload.observacion ?? '') : '',
  }
}

export const handlers = {
  /** Grillas semanales de Rúbrica y Seguimiento de Lectura (T32). */
  grillas: {
    /**
     * Una grilla existe si alguien la creó en esta sesión, o si la semana ya
     * tiene registros sembrados: en los datos de prueba hay 18 semanas con
     * capturas, y esas no deben pedir que se "cree" nada.
     */
    existe: async ({ tipo, idSemana, idColegio, idGrado }) => {
      if (GRILLAS_SEMANALES[`${tipo}-${idSemana}-${idColegio}-${idGrado}`]) return responder(true)
      return responder(db.reporteSemanalDe(Number(idSemana)).size > 0)
    },

    crear: async ({ tipo, idSemana, idColegio, idGrado, idSeccion }) => {
      const clave = `${tipo}-${idSemana}-${idColegio}-${idGrado}`
      GRILLAS_SEMANALES[clave] = { clave, tipo, id_semana: idSemana, id_seccion: idSeccion ?? null }
      return responder(GRILLAS_SEMANALES[clave], RETARDO_ESCRITURA_MS)
    },

    /**
     * Ausentes del módulo Asistencia. Si para esa semana no hay ninguna grilla
     * de asistencia todavía, devuelve una lista vacía: nadie consta ausente,
     * que no es lo mismo que que todos asistieran.
     */
    ausentes: async () => {
      const ids = Object.values(CLASES_MOCK).flatMap((clase) =>
        Object.entries(clase.marcas)
          .filter(([, marca]) => marca.estado === 'ausente')
          .map(([idAlumno]) => Number(idAlumno)),
      )
      return responder([...new Set(ids)])
    },
  },

  /** Resúmenes del Módulo de Inicio (CU010, CU011, CU012). */
  inicio: {
    /** CU012: exactamente tres tarjetas. `salud_sistema` en null a proposito. */
    directivo: () =>
      responder({
        beneficiarios_activos: db.ALUMNOS.filter((a) => a.activo !== false).length,
        colegios_operando: db.COLEGIOS.length,
        salud_sistema: null,
      }),

    // Los nombres son EXACTAMENTE los del contrato: divergir aquí hacía que la
    // pantalla funcionara con el simulador y mostrara "Sin datos disponibles"
    // contra el servidor, que es el peor orden posible para enterarse.
    supervisor: async () =>
      responder({
        colegios_registrados: db.COLEGIOS.filter((c) => c.activo !== false).length,
        docentes_activos: db.USUARIOS.filter((u) => u.id_rol === 1 && u.activo !== false).length,
        docentes_con_actividad_activa: 1,
        registros_vencidos: 3,
        registros_incompletos: 1,
        // El desglose de la tanda 10. Suma lo mismo que el total: si no
        // cuadrara, la pantalla ensenaria dos verdades distintas del mismo
        // dato y nadie sabria cual creer.
        vencidos_por_modulo: { asistencias: 1, lectura: 0, rubrica: 2, registro_vuelo: 0 },
        incompletos_por_modulo: { asistencias: 1, lectura: 0, rubrica: 0, registro_vuelo: 0 },
        // Los umbrales (3 días, 4 días hábiles) los decide el servidor: las
        // alertas llegan ya redactadas para no codificar reglas de negocio en
        // la interfaz.
        alertas: [
          {
            tipo: 'inactividad_operativa',
            mensaje: 'Inactividad Operativa - Carlos Minaya: Sin actividad registrada en los últimos 4 días hábiles.',
            critica: false,
          },
          {
            tipo: 'incumplimiento_sede',
            mensaje: 'Incumplimiento de Sede - Colegio Shilla: Sin registros obligatorios en el periodo académico actual.',
            critica: true,
          },
        ],
      }),

    /**
     * Misma forma que `GET /inicio/docente` del backend real.
     *
     * Divergir aquí sale caro: la pantalla funcionaba con el simulador y
     * reventaba contra el servidor, que es el peor orden posible para
     * enterarse. Los Resúmenes de Acción NO se devuelven, igual que el
     * backend, porque dependen de las grillas y todavía no existen.
     */
    docente: async (idDocente = 1) => {
      const asignaciones = db.ASIGNACIONES.filter((a) => a.id_docente === Number(idDocente))
      const idsColegio = [...new Set(asignaciones.map((a) => a.id_colegio))]
      const alumnos = idsColegio.flatMap((id) => db.alumnosDe({ colegio: id }))

      return responder({
        actividad_activa: null,
        puede_iniciar_actividad: asignaciones.length > 0,
        motivo_no_puede_iniciar: asignaciones.length > 0 ? null : 'sin_asignaciones',
        // El texto lo redacta el servidor (T4): depende del calendario de cada
        // colegio y de los permisos, que el cliente no puede deducir.
        motivo_no_puede:
          asignaciones.length > 0
            ? null
            : 'No puedes iniciar una actividad porque no tienes asignaciones habilitadas ni permisos excepcionales vigentes.',
        // Vacío a propósito: un permiso es la excepción, no el caso corriente.
        permisos_vigentes: [],
        sesion_expira: null,
        asignaciones: idsColegio.map((id) => ({
          colegio: { id, nombre: db.COLEGIOS.find((c) => c.id_colegio === id)?.nombre },
          // RN-003: la asignación es por colegio completo, con sus seis grados.
          grados: db.GRADOS.map((g) => ({
            id: g.id_grado,
            nombre: g.nombre,
            cantidad_alumnos: db.alumnosDe({ colegio: id, grado: g.id_grado }).length,
            ciclos: ['III'],
            subprogramas: ['Alfabetización'],
          })),
        })),
        totales: {
          ciclos: ['III', 'IV'],
          subprogramas: ['Alfabetización'],
          cantidad_alumnos: alumnos.length,
        },
      })
    },
  },

  /**
   * Asistencias (CU022). Reproduce el contrato real, que ya está publicado.
   *
   * Reglas que imita porque la pantalla ramifica por ellas:
   *
   *   · `editable` lo decide el SERVIDOR: Docente y día lectivo del periodo
   *     vigente. El Supervisor siempre lo recibe en `false`.
   *   · Unicidad por alumno, fecha y subprograma.
   *   · `aplicado: false` cuando otro dispositivo guardó algo más reciente.
   */
  /**
   * Habilitaciones y calendario (CU027, CU028), con la forma del contrato de
   * la semana 11.
   *
   * El simulador monta un calendario de cuatro PA con sus recesos para el año
   * lectivo y le da al docente una asignación ordinaria en cada uno de sus
   * colegios. Sirve para desarrollar las pantallas y, sobre todo, para que las
   * pruebas puedan ejercitar los bordes: permiso vencido, fecha fuera de
   * periodo, colegio sin calendario descargado.
   */
  habilitaciones: {
    mias: async () => {
      const idDocente = 1
      const idsColegio = [...new Set(db.ASIGNACIONES.filter((a) => a.id_docente === idDocente).map((a) => a.id_colegio))]

      return responder({
        generado_en: new Date().toISOString(),
        asignaciones: idsColegio.flatMap((idColegio) =>
          db.GRADOS.flatMap((g) =>
            CALENDARIO_MOCK.periodos
              .filter((p) => p.tipo === 'PA')
              .map((p) => ({
                id_colegio: idColegio,
                id_grado: g.id_grado,
                id_periodo_academico: p.id_periodo_academico,
                // La retroactiva la otorga el Supervisor caso por caso: el
                // simulador no la inventa, para que se vea la diferencia.
                retroactiva: false,
              })),
          ),
        ),
        permisos: [],
        calendarios: idsColegio.map((idColegio) => ({ ...CALENDARIO_MOCK, id_colegio: idColegio })),
      })
    },

    periodo: async ({ idColegio, fecha }) => {
      const periodo = CALENDARIO_MOCK.periodos.find((p) => fecha >= p.fecha_inicio && fecha <= p.fecha_fin)
      if (!periodo) {
        return responder({
          fecha,
          tipo: null,
          numero: null,
          id_periodo_academico: null,
          es_lectivo: false,
          motivo_no_lectivo: 'fuera_de_periodo',
        })
      }
      const noLectivo = CALENDARIO_MOCK.dias_no_lectivos.find((d) => fecha >= d.fecha_inicio && fecha <= d.fecha_fin)
      const finDeSemana = [0, 6].includes(new Date(`${fecha}T12:00:00`).getDay())
      const motivoFinDeSemana = finDeSemana ? 'fin_de_semana' : null
      return responder({
        fecha,
        id_colegio: Number(idColegio),
        tipo: periodo.tipo,
        numero: periodo.numero,
        id_periodo_academico: periodo.id_periodo_academico,
        fecha_inicio: periodo.fecha_inicio,
        fecha_fin: periodo.fecha_fin,
        es_lectivo: periodo.tipo === 'PA' && !noLectivo && !finDeSemana,
        motivo_no_lectivo: periodo.tipo === 'PR'
          ? 'receso'
          : (noLectivo?.motivo ?? motivoFinDeSemana),
      })
    },
  },

  /**
   * Permisos excepcionales de corrección (CU028).
   *
   * Viven en memoria, como las asistencias: lo que importa del simulador aquí
   * no son los datos sino los ESTADOS, que se calculan con la hora —programado,
   * vigente, vencido, revocado— y son lo que la pantalla ramifica.
   */
  /**
   * `GET /anios-escolares`.
   *
   * Tres años: el anterior, el vigente y el siguiente. El vigente va marcado,
   * que es lo que usan los formularios para proponerlo por defecto. No se
   * inventan más: un año escolar lo crea el Supervisor, no el simulador.
   */
  anios: async () =>
    responder([
      { id: 1, nombre: String(db.ANIO_LECTIVO - 1), vigente: false },
      { id: 2, nombre: String(db.ANIO_LECTIVO), vigente: true },
      { id: 3, nombre: String(db.ANIO_LECTIVO + 1), vigente: false },
    ]),

  /**
   * Calendario académico (CU027).
   *
   * Guarda los calendarios por (año, colegio) en memoria. Lo que importa
   * reproducir no son las fechas sino las REGLAS que la pantalla ramifica: el
   * general frente al particular, la versión para detectar ediciones
   * simultáneas, y el 404 cuando el año todavía no tiene calendario —que no es
   * un error, es el estado "hay que crearlo"—.
   */
  calendarios: {
    obtener: async ({ idAnioEscolar, idColegio } = {}) => {
      const anio = Number(idAnioEscolar ?? 2)
      const particular = idColegio ? CALENDARIOS_MOCK[`${anio}|${idColegio}`] : null
      const general = CALENDARIOS_MOCK[`${anio}|general`]
      const elegido = particular ?? general
      if (!elegido) {
        throw errorMock(
          404,
          'No hay un calendario académico configurado para este año escolar.',
          'calendario_no_configurado',
        )
      }
      const colegio = idColegio ? db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio)) : null
      return responder({
        ...elegido,
        colegio: colegio ? { id: colegio.id_colegio, nombre: colegio.nombre } : null,
        periodo_actual:
          elegido.periodos.find((p) => {
            const hoy = hoyLima()
            return hoy >= p.fecha_inicio && hoy <= p.fecha_fin
          }) ?? null,
        fecha_referencia: hoyLima(),
      })
    },

    crearGeneral: async ({ id_anio_escolar: idAnio, periodos, dias_no_lectivos: dias }) => {
      const anio = Number(idAnio)
      if (CALENDARIOS_MOCK[`${anio}|general`]) {
        throw errorMock(409, 'Ya existe un calendario general para este año escolar.', 'calendario_existente')
      }
      CALENDARIOS_MOCK[`${anio}|general`] = {
        id_calendario: siguienteIdCalendario(),
        id_anio_escolar: anio,
        origen: 'general',
        version: 1,
        periodos: conIdDePeriodo(periodos),
        dias_no_lectivos: dias ?? [],
      }
      return responder(CALENDARIOS_MOCK[`${anio}|general`], RETARDO_ESCRITURA_MS)
    },

    crearParticular: async ({ id_colegio: idColegio, id_anio_escolar: idAnio, periodos, dias_no_lectivos: dias }) => {
      const anio = Number(idAnio)
      if (!CALENDARIOS_MOCK[`${anio}|general`]) {
        throw errorMock(
          409,
          'Primero debes configurar el calendario general para poder definir fechas particulares de este colegio.',
          'calendario_general_requerido',
        )
      }
      const clave = `${anio}|${idColegio}`
      if (CALENDARIOS_MOCK[clave]) {
        throw errorMock(
          409,
          'El colegio ya tiene un calendario con fechas particulares para este año escolar.',
          'calendario_particular_existente',
        )
      }
      CALENDARIOS_MOCK[clave] = {
        id_calendario: siguienteIdCalendario(),
        id_anio_escolar: anio,
        id_colegio: Number(idColegio),
        origen: 'particular',
        version: 1,
        periodos: conIdDePeriodo(periodos),
        // Omitirlos copia los del general; mandarlos, aunque sea vacío, manda.
        dias_no_lectivos: dias ?? CALENDARIOS_MOCK[`${anio}|general`].dias_no_lectivos,
      }
      return responder(CALENDARIOS_MOCK[clave], RETARDO_ESCRITURA_MS)
    },

    actualizar: async (idCalendario, { version, periodos, dias_no_lectivos: dias }) => {
      const clave = Object.keys(CALENDARIOS_MOCK).find(
        (k) => String(CALENDARIOS_MOCK[k].id_calendario) === String(idCalendario),
      )
      if (!clave) throw errorMock(404, 'El calendario no existe.', 'calendario_no_encontrado')

      const actual = CALENDARIOS_MOCK[clave]
      if (version != null && Number(version) !== actual.version) {
        throw errorMock(
          409,
          'El calendario fue modificado por otro Supervisor. Consulta la versión actual antes de volver a guardar.',
          'modificacion_concurrente',
        )
      }
      CALENDARIOS_MOCK[clave] = {
        ...actual,
        version: actual.version + 1,
        periodos: conIdDePeriodo(periodos),
        dias_no_lectivos: dias ?? [],
      }
      return responder(CALENDARIOS_MOCK[clave], RETARDO_ESCRITURA_MS)
    },

    usarGeneral: async (idCalendario) => {
      const clave = Object.keys(CALENDARIOS_MOCK).find(
        (k) => String(CALENDARIOS_MOCK[k].id_calendario) === String(idCalendario),
      )
      if (!clave) throw errorMock(404, 'El calendario no existe.', 'calendario_no_encontrado')
      if (CALENDARIOS_MOCK[clave].origen === 'general') {
        throw errorMock(409, 'El calendario general no se puede desactivar.', 'calendario_es_general')
      }
      const anio = CALENDARIOS_MOCK[clave].id_anio_escolar
      delete CALENDARIOS_MOCK[clave]
      return responder(CALENDARIOS_MOCK[`${anio}|general`], RETARDO_ESCRITURA_MS)
    },
  },

  /**
   * Sincronización (T5). El simulador acepta el aviso y no sabe de ninguna
   * operación previa: devuelve `desconocida`, que es lo honesto —no la ha
   * visto— y lo que hace que la cola reintente.
   */
  sincronizacion: {
    pendientes: async (operaciones = []) =>
      responder({ recibidos: operaciones.length, registrados: operaciones.length }),
    operacion: async (idOperacion) => responder({ id_operacion: idOperacion, estado: 'desconocida' }),
    descartar: async () => responder({ estado: 'descartada', motivo: 'modificacion_concurrente', respuesta: null }),
  },

  permisos: {
    listar: async (idUsuario, filtros = {}) => {
      const mios = Object.values(PERMISOS_MOCK)
        .filter((p) => String(p.id_usuario) === String(idUsuario))
        .map(conEstado)
        .filter((p) => !filtros.modulo || p.modulo === filtros.modulo)
        .filter((p) => !filtros.estado || p.estado === filtros.estado)
        .filter((p) => !filtros.id_colegio || String(p.colegio.id) === String(filtros.id_colegio))
        // Del más recientemente otorgado al más antiguo.
        .sort((a, b) => String(b.otorgado_en).localeCompare(String(a.otorgado_en)))
      return responder({ items: mios, total: mios.length, page: 1, page_size: 40, total_pages: 1 })
    },

    detalle: async (idUsuario, idPermiso) => {
      const permiso = PERMISOS_MOCK[idPermiso]
      if (!permiso) throw errorMock(404, 'No existe el permiso.', 'permiso_no_encontrado')
      return responder(conEstado(permiso))
    },

    otorgar: async (idUsuario, datos) => {
      const id = Math.max(0, ...Object.keys(PERMISOS_MOCK).map(Number)) + 1
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(datos.id_colegio))
      const grado = db.GRADOS.find((g) => g.id_grado === Number(datos.id_grado))
      PERMISOS_MOCK[id] = {
        id,
        id_usuario: Number(idUsuario),
        anio_escolar: { id: Number(datos.id_anio_escolar), nombre: String(db.ANIO_LECTIVO) },
        colegio: { id: colegio?.id_colegio ?? Number(datos.id_colegio), nombre: colegio?.nombre ?? '—' },
        grado: { id: grado?.id_grado ?? Number(datos.id_grado), nombre: grado?.nombre ?? '—' },
        periodo: { id: Number(datos.id_periodo_academico), nombre: `PA${datos.id_periodo_academico}` },
        modulo: datos.modulo,
        inicio: datos.desde_ahora ? new Date().toISOString() : datos.inicio,
        fin: datos.fin,
        motivo: datos.motivo,
        otorgado_en: new Date().toISOString(),
        otorgado_por: { id: 2, nombre: 'Jefa de Prueba' },
        revocado_por: null,
        revocado_en: null,
        motivo_revocacion: null,
      }
      return responder(conEstado(PERMISOS_MOCK[id]), RETARDO_ESCRITURA_MS)
    },

    revocar: async (idUsuario, idPermiso, motivo) => {
      const permiso = PERMISOS_MOCK[idPermiso]
      if (!permiso) throw errorMock(404, 'No existe el permiso.', 'permiso_no_encontrado')
      if (permiso.revocado_en) {
        throw errorMock(409, 'El permiso ya fue revocado. Se actualizó su información.', 'permiso_revocado')
      }
      if (conEstado(permiso).estado === 'vencido') {
        throw errorMock(409, 'El permiso ya venció y no requiere revocación.', 'permiso_vencido')
      }
      permiso.revocado_en = new Date().toISOString()
      permiso.revocado_por = { id: 2, nombre: 'Jefa de Prueba' }
      permiso.motivo_revocacion = motivo
      return responder(conEstado(permiso), RETARDO_ESCRITURA_MS)
    },

    /**
     * Los PA cuyo plazo ordinario YA terminó, que son los únicos que admiten
     * un permiso. El simulador ofrece los anteriores al actual.
     */
    opciones: async ({ idColegio }) => {
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio))
      return responder({
        periodos: CALENDARIO_MOCK.periodos
          .filter((p) => p.tipo === 'PA' && p.numero < 3)
          .map((p) => ({ id: p.id_periodo_academico, nombre: `PA${p.numero}` })),
        grados: db.GRADOS.map((g) => ({ id: g.id_grado, nombre: g.nombre })),
        colegio: colegio ? { id: colegio.id_colegio, nombre: colegio.nombre } : null,
      })
    },
  },

  /**
   * Asistencias (CU022), con la forma de la tanda 6.
   *
   * Reproduce las reglas que la pantalla ramifica, que son las que importan:
   *
   *   · La clase es colegio x grado x seccion x fecha. El subprograma NO entra:
   *     una clase reune a los de ambos y cada alumno trae el suyo.
   *   · La primera escritura CREA la clase y CONGELA su lista de alumnos. A
   *     partir de ahi, quien entro sigue en la tabla aunque cambie de aula o
   *     lo den de baja.
   *   · `escritura` sustituye a `editable`, y dice por que no se puede.
   *   · Gana la captura mas reciente, pero el item vuelve ACEPTADA con
   *     `motivo: "registro_mas_reciente"`: la operacion se proceso, solo que
   *     gano la otra.
   */
  asistencia: {
    clase: async ({ idColegio, idGrado, idSeccion, fecha }) => {
      const clave = claveDeClase(idColegio, idGrado, idSeccion, fecha)
      const guardada = CLASES_MOCK[clave]

      // La fecha se rechaza con un 422, no dentro de `escritura`: eso es lo
      // que hace el servidor, y la pantalla lo ramifica por ahi.
      const lectiva = esDiaLectivo(fecha)
      if (fecha > hoyLima()) {
        throw errorMock(422, 'No se pueden registrar asistencias para fechas futuras.', 'fecha_futura')
      }
      if (!lectiva) {
        throw errorMock(
          422,
          'Dia no lectivo: fin de semana o feriado. No se permite registrar asistencias para esta fecha.',
          'fecha_no_lectiva',
        )
      }

      // La lista CONGELADA si la clase ya existe; si no, quienes pertenecen hoy.
      const alumnos = (
        guardada?.lista ?? db.alumnosDe({ colegio: Number(idColegio), grado: Number(idGrado) })
      ).map((a) => {
        const marca = guardada?.marcas?.[a.id_alumno]
        return {
          id_alumno: a.id_alumno,
          nombre: `${a.apellidos}, ${a.nombres}`,
          id_programa: a.id_programa,
          inactivo: a.activo === false,
          estado: marca?.estado ?? null,
          observacion: marca?.observacion ?? null,
          version: marca?.version ?? null,
        }
      })

      return responder({
        clase: guardada
          ? {
              id_clase: guardada.id_clase,
              tipo: guardada.tipo,
              etiqueta: guardada.tipo === 'adicional' ? 'Clase adicional' : CLASE_PROGRAMADA,
              fecha_original: fecha,
              fecha,
              aviso: null,
            }
          : {
              id_clase: null,
              tipo: lectiva ? 'habitual' : null,
              etiqueta: lectiva ? CLASE_PROGRAMADA : null,
              fecha_original: fecha,
              fecha,
              aviso: lectiva ? null : 'No hay una clase programada para esta fecha.',
            },
        alumnos,
        // `escritura` ya solo habla de QUIEN escribe, no de la fecha.
        escritura: { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null },
      })
    },

    // `idClase` lo acepta el contrato, pero aqui la clase se resuelve siempre
    // por su clave: el simulador no necesita el atajo.
    guardar: async ({ idColegio, idGrado, idSeccion, fecha, adicional, registros = [] }) => {
      const clave = claveDeClase(idColegio, idGrado, idSeccion, fecha)
      let clase = CLASES_MOCK[clave]

      if (!clase) {
        if (!esDiaLectivo(fecha) && !adicional) {
          throw errorMock(
            422,
            'No hay una clase programada para esta fecha.',
            'sin_clase_programada',
          )
        }
        // La primera escritura crea la clase y CONGELA su lista.
        clase = {
          id_clase: siguienteIdClase(),
          tipo: esDiaLectivo(fecha) ? 'habitual' : 'adicional',
          lista: db.alumnosDe({ colegio: Number(idColegio), grado: Number(idGrado) }),
          marcas: {},
        }
        CLASES_MOCK[clave] = clase
      }

      const resultados = registros.map((r) => {
        const enLaClase = clase.lista.some((a) => a.id_alumno === r.id_alumno)
        if (!enLaClase) {
          return {
            id_operacion: r.id_operacion,
            estado: 'rechazada',
            motivo: 'alumno_fuera_de_la_clase',
            detail: 'El alumno no pertenece a esta clase.',
            registro: null,
          }
        }

        const previa = clase.marcas[r.id_alumno]
        const momento = r.realizado_en ?? new Date().toISOString()

        // Gana la captura mas reciente. El item se ACEPTA igual: la operacion
        // se proceso, solo que no se aplico porque habia algo posterior.
        if (previa && previa.fecha_registro > momento) {
          return {
            id_operacion: r.id_operacion,
            estado: 'aceptada',
            motivo: 'registro_mas_reciente',
            detail: null,
            registro: { id_clase: clase.id_clase, id_alumno: r.id_alumno, ...previa },
          }
        }

        const marca = {
          estado: r.estado ?? previa?.estado ?? null,
          observacion: r.observacion !== undefined ? r.observacion : (previa?.observacion ?? null),
          version: (previa?.version ?? 0) + 1,
          fecha_registro: momento,
        }
        clase.marcas[r.id_alumno] = marca
        return {
          id_operacion: r.id_operacion,
          estado: 'aceptada',
          motivo: null,
          detail: null,
          registro: { id_clase: clase.id_clase, id_alumno: r.id_alumno, ...marca },
        }
      })

      return responder(
        {
          clase: {
            id_clase: clase.id_clase,
            tipo: clase.tipo,
            etiqueta: clase.tipo === 'adicional' ? 'Clase adicional' : CLASE_PROGRAMADA,
            fecha_original: fecha,
            fecha,
            aviso: null,
          },
          resultados,
        },
        RETARDO_ESCRITURA_MS,
      )
    },
  },

  /**
   * Programacion de clases y reprogramaciones (CU013).
   *
   * Lo que importa reproducir:
   *
   *   · Una clase MIXTA sale UNA sola vez, con sus dos subprogramas en la
   *     misma fila. `id_programa` filtra, no parte.
   *   · Reprogramar conserva el identificador de la clase: cambia su fecha
   *     vigente y la original queda en el historial.
   *   · No se puede reprogramar una clase que ya tiene asistencias.
   */
  clases: {
    listar: async ({ idColegio, idGrado, idSeccion, idPrograma, desde, hasta, pagina = 1 }) => {
      const todas = clasesHabituales({ idColegio, idGrado, idSeccion, desde, hasta })

      // El filtro se aplica ANTES de paginar: `total` cuenta solo las que
      // quedan, y una clase con los dos subprogramas aparece con cualquiera.
      const filtradas = idPrograma
        ? todas.filter((c) => c.subprogramas.some((sp) => Number(sp.id) === Number(idPrograma)))
        : todas

      const porPagina = 40
      const desdeIndice = (Number(pagina) - 1) * porPagina
      return responder({
        items: filtradas.slice(desdeIndice, desdeIndice + porPagina),
        total: filtradas.length,
        page: Number(pagina),
        page_size: porPagina,
        total_pages: Math.max(1, Math.ceil(filtradas.length / porPagina)),
      })
    },

    reprogramar: async (idColegio, { idGrado, idSeccion, fechaOriginal, fechaNueva, motivo, version }) => {
      const clave = claveDeProgramacion(idColegio, idGrado, idSeccion, fechaOriginal)
      const previa = REPROGRAMACIONES_MOCK[clave]

      if (version != null && Number(version) !== Number(previa?.version ?? 0)) {
        throw errorMock(
          409,
          'La clase fue modificada por otro usuario. Vuelve a consultarla e intentalo de nuevo.',
          'modificacion_concurrente',
        )
      }

      const vigente = previa?.fecha_nueva ?? fechaOriginal
      const guardada = CLASES_MOCK[claveDeClase(idColegio, idGrado, idSeccion, vigente)]
      if (guardada && Object.keys(guardada.marcas ?? {}).length) {
        throw errorMock(
          409,
          'Esta clase ya tiene asistencias registradas y no puede reprogramarse.',
          'clase_con_asistencias',
        )
      }

      const porCampo = (campo, mensaje, motivoError) => {
        const error = errorMock(422, mensaje, motivoError)
        error.response.data.errores = [{ campo, mensaje }]
        return error
      }

      if (!motivo || !String(motivo).trim()) {
        throw porCampo('motivo', 'Ingresa el motivo de la reprogramacion.', 'validacion')
      }
      if (fechaNueva === vigente) {
        throw porCampo('fecha_nueva', 'Selecciona una fecha distinta de la fecha actual de la clase.', 'fecha_sin_cambio')
      }
      if (!esDiaLectivo(fechaNueva)) {
        throw porCampo(
          'fecha_nueva',
          'La nueva fecha no es un dia lectivo del calendario del colegio.',
          'fecha_no_lectiva',
        )
      }
      // Ya ocupada por otra clase del mismo grupo.
      const ocupada = Object.values(REPROGRAMACIONES_MOCK).some(
        (r) => r.clave !== clave && r.id_grado === Number(idGrado) && r.fecha_nueva === fechaNueva,
      )
      if (ocupada) {
        throw porCampo('fecha_nueva', `El grupo ya tiene una clase el ${fechaNueva}.`, 'fecha_ocupada')
      }

      REPROGRAMACIONES_MOCK[clave] = {
        clave,
        id_grado: Number(idGrado),
        id_seccion: Number(idSeccion),
        fecha_original: fechaOriginal,
        fecha_anterior: vigente,
        fecha_nueva: fechaNueva,
        motivo: String(motivo).trim(),
        version: (previa?.version ?? 0) + 1,
        historial: [
          ...(previa?.historial ?? []),
          {
            id: ++ultimoIdReprogramacion,
            fecha_anterior: vigente,
            fecha_nueva: fechaNueva,
            motivo: String(motivo).trim(),
            usuario: { id: 2, nombre: 'Sara Supervisora' },
            fecha: new Date().toISOString(),
          },
        ],
      }

      return responder(
        {
          id_clase: REPROGRAMACIONES_MOCK[clave].historial.at(-1).id,
          fecha_original: fechaOriginal,
          fecha: fechaNueva,
          reprogramada: true,
          version: REPROGRAMACIONES_MOCK[clave].version,
        },
        RETARDO_ESCRITURA_MS,
      )
    },

    reprogramaciones: async (idClase) => {
      const traslado = Object.values(REPROGRAMACIONES_MOCK).find((r) =>
        (r.historial ?? []).some((h) => Number(h.id) === Number(idClase)),
      )
      // El historial entero, del mas reciente al mas antiguo: modificar una
      // reprogramacion NO sobrescribe la anterior.
      return responder([...(traslado?.historial ?? [])].reverse())
    },
  },

  /**
   * Seguimiento de Lectura (CU023 a CU026), forma de la tanda 7.
   *
   * Reproduce lo que de verdad ramifica la pantalla:
   *
   *   · La tabla NO EXISTE hasta que alguien la crea. El 404 con
   *     `tabla_no_existe` es la respuesta normal, no un fallo, y trae la clase
   *     sugerida para poder crearla.
   *   · Las filas son la lista de la clase de referencia filtrada por el
   *     subprograma de la tabla.
   *   · Sin presente o tardanza no se registran libros, pero la observacion
   *     si se admite: justificar la falta es justo lo que hace falta ahi.
   *   · "No realizada" bloquea TAMBIEN las observaciones y pone todas las
   *     filas en `no_aplica`.
   */
  lectura: {
    tabla: async ({ idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana }) => {
      const clave = claveDeTabla({ idColegio, idPrograma, idGrado, idSeccion, mes, idSemana })
      const guardada = TABLAS_LECTURA[clave]
      if (guardada) return responder(conFilas(guardada))

      const semana = db.SEMANAS.find((s) => Number(s.id_semana) === Number(idSemana))
      if (!semana) throw errorMock(404, 'La semana seleccionada no existe.', 'semana_no_encontrada')

      const error = errorMock(
        404,
        'No existe una tabla de lectura semanal para los filtros seleccionados.',
        'tabla_no_existe',
      )
      error.response.data.clase_referencia_sugerida = claseSugeridaDe(semana)
      error.response.data.escritura = { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null }
      error.response.data.id_anio_escolar = Number(idAnioEscolar)
      throw error
    },

    crear: async (cuerpo) => {
      const clave = claveDeTabla({
        idColegio: cuerpo.id_colegio,
        idPrograma: cuerpo.id_programa,
        idGrado: cuerpo.id_grado,
        idSeccion: cuerpo.id_seccion,
        mes: cuerpo.mes,
        idSemana: cuerpo.id_semana,
      })
      // Idempotente por `id_operacion`: un reintento devuelve LA MISMA tabla.
      const existente = TABLAS_LECTURA[clave]
      if (existente) {
        if (existente.id_operacion === cuerpo.id_operacion) return responder(conFilas(existente))
        const choque = errorMock(
          409,
          'Ya existe una tabla de lectura semanal para los filtros seleccionados.',
          'tabla_existente',
        )
        choque.response.data.id = existente.id
        throw choque
      }

      const semana = db.SEMANAS.find((s) => Number(s.id_semana) === Number(cuerpo.id_semana))
      if (!semana) throw errorMock(404, 'La semana seleccionada no existe.', 'semana_no_encontrada')
      if (semana.inicio > hoyLima()) {
        throw errorMock(
          422,
          'No es posible adelantar registros. Seleccione la semana actual o una anterior.',
          'semana_futura',
        )
      }

      const alumnos = db
        .alumnosDe({ colegio: Number(cuerpo.id_colegio), grado: Number(cuerpo.id_grado) })
        .filter((a) => Number(a.id_programa) === Number(cuerpo.id_programa))
      if (alumnos.length === 0) {
        throw errorMock(
          422,
          'No hay estudiantes que pertenecieran a este grupo en la fecha de la clase seleccionada.',
          'sin_alumnos',
        )
      }

      const porId = cuerpo.id_clase_referencia
        ? Object.keys(CLASES_MOCK).find((k) => CLASES_MOCK[k].id_clase === Number(cuerpo.id_clase_referencia))
        : null
      const fecha =
        porId?.split('|').at(-1) ?? cuerpo.fecha_clase_referencia ?? claseSugeridaDe(semana)?.fecha ?? semana.inicio
      // Crear la tabla CONGELA la lista de la clase, y crea la clase si no
      // tenia fila: es lo que hace el servidor en la misma transaccion.
      const claveClase = claveDeClase(cuerpo.id_colegio, cuerpo.id_grado, cuerpo.id_seccion, fecha)
      if (!CLASES_MOCK[claveClase]) {
        CLASES_MOCK[claveClase] = {
          id_clase: siguienteIdClase(),
          tipo: 'habitual',
          lista: db.alumnosDe({ colegio: Number(cuerpo.id_colegio), grado: Number(cuerpo.id_grado) }),
          marcas: {},
        }
      }

      TABLAS_LECTURA[clave] = {
        id: siguienteIdTabla(),
        id_operacion: cuerpo.id_operacion,
        version: 1,
        estado: 'normal',
        motivo_no_realizada: null,
        id_colegio: Number(cuerpo.id_colegio),
        id_grado: Number(cuerpo.id_grado),
        id_seccion: Number(cuerpo.id_seccion),
        id_programa: Number(cuerpo.id_programa),
        id_anio_escolar: Number(cuerpo.id_anio_escolar),
        mes: Number(cuerpo.mes),
        id_semana: Number(cuerpo.id_semana),
        clave_clase: claveClase,
        datos: {},
      }
      return responder(conFilas(TABLAS_LECTURA[clave]), RETARDO_ESCRITURA_MS)
    },

    claseReferencia: async (idTabla, { version, idClase, fecha }) => {
      const tabla = porIdDeTabla(idTabla)
      exigirVersionDeTabla(tabla, version)
      if (tabla.estado === 'no_realizada') {
        throw errorMock(409, 'La lectura semanal de esta tabla fue marcada como no realizada.', 'lectura_no_realizada')
      }
      if (Object.values(tabla.datos).some(conDatosDeLectura)) {
        throw errorMock(
          409,
          'No es posible cambiar la clase de referencia porque ya existen registros de lectura guardados para esta tabla.',
          'tabla_con_datos',
        )
      }
      const nueva = fecha
        ? claveDeClase(tabla.id_colegio, tabla.id_grado, tabla.id_seccion, fecha)
        : Object.keys(CLASES_MOCK).find((k) => CLASES_MOCK[k].id_clase === Number(idClase))
      if (!nueva) {
        throw errorMock(422, 'La clase seleccionada no es de este grupo o de esta semana.', 'clase_fuera_de_la_semana')
      }
      tabla.clave_clase = nueva
      tabla.version += 1
      return responder(conFilas(tabla), RETARDO_ESCRITURA_MS)
    },

    guardarFilas: async (idTabla, filas = []) => {
      const tabla = porIdDeTabla(idTabla)

      const resultados = filas.map((f) => {
        const rechazo = rechazoDeItem(f)

        if (tabla.estado === 'no_realizada') {
          return rechazo('lectura_no_realizada', 'La lectura semanal de esta tabla fue marcada como no realizada.')
        }

        if (!filaDe(tabla, f.id_alumno)) {
          return rechazo(
            'alumno_fuera_de_la_tabla',
            'El estudiante no corresponde a la clase de referencia de esta tabla semanal.',
          )
        }

        // Un titulo con SOLO ESPACIOS cuenta como vacio.
        const titulo = typeof f.lsn_titulo === 'string' ? f.lsn_titulo.trim() || null : f.lsn_titulo
        const tocaLibros = ['lsn_titulo', 'lsn_nota', 'lsn_maximo', 'cantidad_lsl'].some((c) => c in f)

        // Sin presente o tardanza no hay libros; la observacion si pasa, y
        // BORRAR tambien: es como se resuelve un `revisar_asistencia`.
        if (tocaLibros && !soloBorra(f) && !asistioALaReferencia(tabla, f.id_alumno)) {
          return rechazo(
            'sin_asistencia',
            'El estudiante debe tener asistencia Presente o Tardanza en la clase de referencia para registrar su lectura.',
          )
        }

        const guardado = tabla.datos[f.id_alumno] ?? {}
        const nota = 'lsn_nota' in f ? f.lsn_nota : guardado.lsn_nota
        const maximo = 'lsn_maximo' in f ? f.lsn_maximo : guardado.lsn_maximo
        const tituloFinal = 'lsn_titulo' in f ? titulo : guardado.lsn_titulo
        const lsn = rechazoDeLsn(tituloFinal, nota, maximo)
        if (lsn) return rechazo(...lsn)

        tabla.datos[f.id_alumno] = {
          ...guardado,
          ...('lsn_titulo' in f ? { lsn_titulo: titulo } : {}),
          ...('lsn_nota' in f ? { lsn_nota: f.lsn_nota } : {}),
          ...('lsn_maximo' in f ? { lsn_maximo: f.lsn_maximo } : {}),
          ...('cantidad_lsl' in f ? { cantidad_lsl: f.cantidad_lsl } : {}),
          ...('observacion' in f ? { observacion: f.observacion } : {}),
          version: (guardado.version ?? 0) + 1,
        }

        return {
          id_operacion: f.id_operacion,
          estado: 'aceptada',
          motivo: null,
          detail: null,
          registro: filaDe(tabla, f.id_alumno),
        }
      })

      return responder(resultados, RETARDO_ESCRITURA_MS)
    },

    noRealizada: async (idTabla, { version, motivo }) => {
      const tabla = porIdDeTabla(idTabla)
      exigirVersionDeTabla(tabla, version)
      if (!motivo || !String(motivo).trim()) {
        throw errorMock(
          422,
          'Es obligatorio registrar una justificacion para indicar por que no se realizo la lectura semanal.',
          'validacion',
        )
      }
      // Las observaciones NO cuentan como datos de lectura.
      if (Object.values(tabla.datos).some(conDatosDeLectura)) {
        throw errorMock(
          409,
          'No es posible marcar la lectura semanal como no realizada porque ya existen registros de lectura guardados para esta tabla.',
          'tabla_con_datos',
        )
      }
      tabla.estado = 'no_realizada'
      tabla.motivo_no_realizada = String(motivo).trim()
      tabla.version += 1
      return responder(conFilas(tabla), RETARDO_ESCRITURA_MS)
    },
  },

  /**
   * Rubrica mensual (CU029, CU030), forma de la tanda 8.
   *
   * Lo que importa reproducir son las reglas que la pantalla ramifica:
   *
   *   · No se evaluan meses FUTUROS: 422 `mes_futuro`, que no es un fallo sino
   *     un estado —no hay nada que corregir, solo otro mes que elegir—.
   *   · La escala depende del subprograma, y el 0 solo se admite en Fluidez de
   *     Alfabetizacion.
   *   · Una sola dimension se guarda igual, y la fila queda `incompleta`.
   *   · `version` detecta que otro docente la cambio entre medias.
   */
  rubricas: {
    listar: async ({ idColegio, idPrograma, idGrado, idAnioEscolar, mes, pagina = 1 }) => {
      const mesActual = Number(hoyLima().slice(5, 7))
      if (Number(mes) > mesActual) {
        throw errorMock(422, 'No es posible evaluar meses futuros.', 'mes_futuro')
      }

      const alumnos = db
        .alumnosDe({ colegio: Number(idColegio), grado: Number(idGrado) })
        .filter((a) => Number(a.id_programa) === Number(idPrograma))
        // Por apellidos, que es el orden que da el contrato.
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'))

      const porPagina = 40
      const total = alumnos.length
      const desde = (Number(pagina) - 1) * porPagina
      const items = alumnos
        .slice(desde, desde + porPagina)
        .map((a) => itemDeRubrica(a, RUBRICAS_MOCK[claveDeRubrica(a.id_alumno, mes, idAnioEscolar)]))

      // El CICLO sale de los dos catalogos: el grado trae `id_ciclo` y el
      // nombre ("III", "IV", "V") vive en CICLOS. Es el que necesita la
      // pantalla para pedir los descriptores pedagogicos.
      const grado = db.GRADOS.find((g) => Number(g.id_grado) === Number(idGrado))
      const ciclo = db.CICLOS.find((c) => c.id_ciclo === grado?.id_ciclo)
      return responder({
        items,
        total,
        page: Number(pagina),
        page_size: porPagina,
        total_pages: Math.max(1, Math.ceil(total / porPagina)),
        ciclo: ciclo?.nombre ?? 'III',
        id_ciclo: ciclo?.id_ciclo ?? 1,
        id_periodo_academico: 2,
        escritura: { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null },
        // Sin alumnos NO es un error: es un 200 que lo dice con palabras.
        detail: total === 0 ? 'No hay alumnos que corresponda evaluar en este grupo y mes.' : null,
      })
    },

    guardar: async (items = []) =>
      responder(
        items.map((it) => {
          const rechazo = rechazoDeItem(it)

          const alumno = db.ALUMNOS.find((a) => Number(a.id_alumno) === Number(it.id_alumno))
          if (!alumno) {
            return rechazo('alumno_fuera_del_grupo', 'El estudiante no pertenecia a este grupo en el mes seleccionado.')
          }

          const programa = db.PROGRAMAS.find((p) => Number(p.id_programa) === Number(it.id_programa))
          const escala = escalaDeProgramaMock(programa?.nombre)
          const clave = claveDeRubrica(it.id_alumno, it.mes, it.id_anio_escolar)
          const guardada = RUBRICAS_MOCK[clave]

          // La version que se leyo tiene que seguir siendo la vigente. Se
          // devuelve el registro VIGENTE para poder adoptarlo sin recargar.
          if (it.version != null && Number(it.version) !== Number(guardada?.version ?? 0)) {
            return rechazo(
              'modificacion_concurrente',
              'Esta evaluacion fue modificada desde que la consultaste. Revisa la version actual antes de guardar nuevamente.',
              itemDeRubrica(alumno, guardada),
            )
          }

          // Una dimension en `null` BORRA; omitida no cambia. Y el 0 es un
          // valor: comprobar `if (valor)` lo trataria como ausente.
          for (const dimension of ['fluidez', 'comprension']) {
            if (!(dimension in it) || it[dimension] == null) continue
            if (!escala[dimension].includes(Number(it[dimension]))) {
              return rechazo(
                'valor_no_permitido',
                'Selecciona una valoracion permitida para esta dimension.',
                { campo: dimension },
              )
            }
          }

          RUBRICAS_MOCK[clave] = {
            id: guardada?.id ?? siguienteIdRubrica(),
            fluidez: 'fluidez' in it ? it.fluidez : (guardada?.fluidez ?? null),
            comprension: 'comprension' in it ? it.comprension : (guardada?.comprension ?? null),
            version: (guardada?.version ?? 0) + 1,
          }

          return {
            id_operacion: it.id_operacion,
            estado: 'aceptada',
            motivo: null,
            detail: null,
            registro: itemDeRubrica(alumno, RUBRICAS_MOCK[clave]),
          }
        }),
        RETARDO_ESCRITURA_MS,
      ),

    /**
     * Los descriptores pedagogicos. NO se escriben en el codigo (RN-011): son
     * material de Mision Huascaran y cambian sin que nadie toque el front.
     * Alfabetizacion no se dicta en los ciclos IV y V, y ahi la lista es vacia.
     */
    criterios: async ({ idPrograma, idCiclo }) => {
      const programa = db.PROGRAMAS.find((p) => Number(p.id_programa) === Number(idPrograma))
      const nombre = sinTildesSimple(programa?.nombre)
      // `id_ciclo` es el entero del catálogo, como en el backend (no "III").
      const ciclo = db.CICLOS.find((c) => c.id_ciclo === Number(idCiclo))
      if (nombre === 'Alfabetizacion' && ['IV', 'V'].includes(ciclo?.nombre)) return responder([])

      const escala = escalaDeProgramaMock(programa?.nombre)
      const nombres = ['Pre-inicio', 'Inicio', 'En proceso', 'Logrado', 'Avanzado']
      const descriptores = {
        0: 'No puede leer porque le cuesta reconocer consonantes y vocales.',
        1: 'Lee palabras sueltas con apoyo y se detiene con frecuencia.',
        2: 'Lee oraciones completas, todavia con pausas y repeticiones.',
        3: 'Lee con fluidez y respeta los signos de puntuacion.',
        4: 'Lee con fluidez y entonacion, y sostiene el ritmo en textos largos.',
      }

      return responder(
        ['Fluidez', 'Comprension'].flatMap((dimension) =>
          escala[dimension === 'Fluidez' ? 'fluidez' : 'comprension'].map((valor) => ({
            dimension,
            valor,
            nombre: nombres[valor],
            descriptor: descriptores[valor],
          })),
        ),
      )
    },
  },

  /**
   * Registro de Vuelo (CU031, CU032), forma de la tanda 9.
   *
   * Lo que importa reproducir:
   *
   *   · El servidor CALCULA entrada, sugerencia y nivel del programa. El
   *     cliente que los mande se lleva un 422 del lote entero, no un campo
   *     ignorado: es la unica forma de que el error se vea pronto.
   *   · `escritura` va una vez POR PERIODO, no por alumno: la habilitacion es
   *     de cada PA, y tenerla en PA2 no habilita PA3.
   *   · El nivel colocado no se puede volver a null.
   */
  registroVuelo: {
    listar: async ({ idColegio, idPrograma, idGrado, pagina = 1 }) => {
      const periodos = periodosDelAnio()
      const alumnos = db
        .alumnosDe({ colegio: Number(idColegio), grado: Number(idGrado) })
        .filter((a) => Number(a.id_programa) === Number(idPrograma))
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es'))

      const porPagina = 40
      const desde = (Number(pagina) - 1) * porPagina
      const items = alumnos.slice(desde, desde + porPagina).map((a) => {
        const suyos = periodos.map((p) => periodoDeAlumno(a, p, periodos))
        return {
          id_alumno: a.id_alumno,
          nombre: `${a.apellidos}, ${a.nombres}`,
          id_programa: a.id_programa,
          inactivo: a.activo === false,
          // 25 por cada PA con nivel colocado.
          avance_anual: suyos.filter((p) => p.nivel_colocado).length * 25,
          periodos: suyos,
        }
      })

      return responder({
        items,
        total: alumnos.length,
        page: Number(pagina),
        page_size: porPagina,
        total_pages: Math.max(1, Math.ceil(alumnos.length / porPagina)),
        periodos: periodos.map((p) => ({
          ...p,
          escritura:
            p.estado === 'futuro'
              ? {
                  permitida: false,
                  motivo: 'No se puede registrar un periodo academico que todavia no empieza.',
                  id_permiso: null,
                  aviso_permiso: null,
                }
              : { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null },
        })),
        aviso: alumnos.length === 0 ? 'No hay alumnos que correspondan a este grupo en el ano seleccionado.' : null,
      })
    },

    guardar: async (items = []) => {
      const periodos = periodosDelAnio()

      // Un campo calculado en el cuerpo tira el LOTE COMPLETO, no solo su item.
      const PROHIBIDOS = new Set(['entrada', 'sugerencia', 'nivel_programa', 'nivel_colocado', 'proyeccion', 'avance_anual'])
      const intruso = items.flatMap((it) => Object.keys(it)).find((c) => PROHIBIDOS.has(c))
      if (intruso) {
        const error = errorMock(422, 'Los datos enviados no son validos.', 'validacion')
        error.response.data.errores = [{ campo: intruso, mensaje: 'Este campo lo calcula el servidor.' }]
        throw error
      }

      return responder(
        items.map((it) => {
          const rechazo = rechazoDeItem(it)

          const alumno = db.ALUMNOS.find((a) => Number(a.id_alumno) === Number(it.id_alumno))
          if (!alumno) {
            return rechazo('alumno_fuera_del_grupo', 'El estudiante no pertenecia a este grupo en el periodo seleccionado.')
          }

          const periodo = periodos.find((p) => p.id_periodo_academico === Number(it.id_periodo_academico))
          if (!periodo) return rechazo('periodo_inexistente', 'El periodo academico no existe.')
          if (periodo.estado === 'futuro') {
            return rechazo('periodo_futuro', 'No se puede registrar un periodo academico que todavia no empieza.')
          }

          const clave = claveDeDecision(it.id_alumno, periodo.id_periodo_academico)
          const previa = DECISIONES_MOCK[clave]

          if (it.version != null && Number(it.version) !== Number(previa?.version ?? 0)) {
            return rechazo(
              'modificacion_concurrente',
              'El registro de este alumno y periodo fue modificado desde que lo consultaste. Revisa la version actual antes de guardar nuevamente.',
              periodoDeAlumno(alumno, periodo, periodos),
            )
          }

          // El nivel colocado NO se puede volver a null: la fila del PA
          // siguiente se construye sobre el.
          if ('id_nivel_colocado' in it && it.id_nivel_colocado == null && previa?.id_nivel_colocado) {
            return rechazo(
              'nivel_colocado_obligatorio',
              'El nivel colocado ya registrado no se puede quitar; selecciona otro nivel.',
            )
          }

          for (const campo of ['id_nivel_colocado', 'id_nivel_proyeccion']) {
            if (!(campo in it) || it[campo] == null) continue
            if (!nivelPorId(it[campo])) {
              return rechazo('nivel_invalido', 'Selecciona un nivel valido entre aa y Z.', { campo })
            }
          }

          const entrada = entradaDe(alumno, periodo.numero, periodos)
          DECISIONES_MOCK[clave] = {
            id: previa?.id ?? Number(`${it.id_alumno}${periodo.numero}`),
            id_nivel_colocado:
              'id_nivel_colocado' in it ? it.id_nivel_colocado : (previa?.id_nivel_colocado ?? null),
            id_nivel_proyeccion:
              'id_nivel_proyeccion' in it ? it.id_nivel_proyeccion : (previa?.id_nivel_proyeccion ?? null),
            observacion: 'observacion' in it ? it.observacion : (previa?.observacion ?? null),
            // La entrada QUE HABIA AL DECIDIR: con ella se detecta despues que
            // alguien corrigio el PA anterior.
            id_nivel_entrada: previa?.id_nivel_entrada ?? entrada.nivel?.id ?? null,
            version: (previa?.version ?? 0) + 1,
          }

          return {
            id_operacion: it.id_operacion,
            estado: 'aceptada',
            motivo: null,
            detail: null,
            registro: periodoDeAlumno(alumno, periodo, periodos),
          }
        }),
        RETARDO_ESCRITURA_MS,
      )
    },
  },


  /** Sesiones de ACTIVIDADES (el botón del docente), no las de autenticación. */
  sesiones: {
    /**
     * Inicio y fin de una actividad. El id lo trae el cliente, asi que repetir
     * la llamada con el mismo id devuelve lo mismo en vez de duplicar.
     */
    iniciar: ({ id, inicio }) => {
      const abierta = {
        id,
        inicio: inicio ?? new Date().toISOString(),
        fin: null,
        estado: 'en_curso',
        tipo_cierre: null,
        sesion_expira: null,
      }
      ACTIVIDADES_MOCK[id] = abierta
      return responder(abierta)
    },

    finalizar: (id, { fin } = {}) => {
      const previa = ACTIVIDADES_MOCK[id] ?? { id, inicio: new Date().toISOString() }
      const cerrada = {
        ...previa,
        fin: fin ?? new Date().toISOString(),
        estado: 'finalizada',
        tipo_cierre: 'Manual por finalizacion de actividad',
      }
      ACTIVIDADES_MOCK[id] = cerrada
      return responder(cerrada)
    },

    /** CU020: primero los pendientes, luego alfabetico. Hoy todos al dia. */
    seguimiento: () =>
      responder({
        items: db.DOCENTES.map((d) => ({
          id_docente: d.id_docente,
          nombres: d.nombre?.split(' ')[0] ?? d.nombre,
          apellidos: d.nombre?.split(' ').slice(1).join(' ') ?? '',
          activo: d.activo !== false,
          colegios: [],
          ultima_conexion: null,
          sincronizacion: 'al_dia',
          registros_pendientes: 0,
        })),
        total: db.DOCENTES.length,
        pagina: 1,
        paginas: 1,
        por_pagina: 10,
      }),

    seguimientoDocente: (idDocente) => {
      const d = db.DOCENTES.find((x) => Number(x.id_docente) === Number(idDocente))
      if (!d) return Promise.reject(errorMock(404, 'El detalle solicitado no se encuentra disponible.', 'docente_no_encontrado'))
      return responder({
        id_docente: d.id_docente,
        nombres: d.nombre?.split(' ')[0] ?? d.nombre,
        apellidos: d.nombre?.split(' ').slice(1).join(' ') ?? '',
        activo: d.activo !== false,
        colegios: [],
        ultima_conexion: null,
        sincronizacion: 'al_dia',
        registros_pendientes: 0,
      })
    },

    actividadesDe: () => responder({ items: [], total: 0, pagina: 1, paginas: 1, por_pagina: 10 }),

    /**
     * Los registros que una actividad TOCO (CU021, tanda 10).
     *
     * Sale de la AUDITORIA de la actividad y no de la fecha: dos actividades
     * del mismo dia tocaron cosas distintas, y filtrar por fecha mezclaria el
     * trabajo de una con el de la otra.
     *
     * Cada modulo trae su propia unidad, y por eso las columnas que sobran van
     * en null en vez de omitirse: una fila de rubrica no tiene fecha porque su
     * unidad es el MES, no porque falte el dato.
     */
    registrosDeActividad: async (idDocente, idActividad, { modulo, pagina = 1 } = {}) => {
      if (!MODULOS_DE_ACTIVIDAD_MOCK.has(modulo)) {
        const error = errorMock(422, 'Los datos enviados no son validos.', 'validacion')
        error.response.data.errores = [{ campo: 'modulo', mensaje: 'El modulo indicado no existe.' }]
        throw error
      }

      const colegio = db.COLEGIOS[0]
      const grado = db.GRADOS[1]
      const programa = db.PROGRAMAS[1]
      const alumno = db.ALUMNOS[0]
      const semana = db.SEMANAS.at(-1)

      const comun = {
        modulo,
        colegio: { id: colegio.id_colegio, nombre: colegio.nombre },
        grado: { id: grado.id_grado, nombre: grado.nombre },
        seccion: { id: 2, nombre: 'Unica' },
        programa: null,
        alumno: null,
        fecha: null,
        id_semana: null,
        semana_inicio: null,
        mes: null,
        id_anio_escolar: 2,
        id_periodo_academico: null,
        cambios: 1,
      }

      const porModulo = {
        // Una fila por CLASE: `cambios` son los alumnos con cambios.
        asistencias: [{ ...comun, id: 12, fecha: semana.inicio, cambios: 23 }],
        // Una fila por TABLA SEMANAL.
        lectura: [
          {
            ...comun,
            id: 7,
            programa: { id: programa.id_programa, nombre: programa.nombre },
            id_semana: semana.id_semana,
            semana_inicio: semana.inicio,
            mes: semana.mes,
            cambios: 5,
          },
        ],
        // Una fila por ALUMNO y MES.
        rubrica: [
          {
            ...comun,
            id: 12,
            programa: { id: programa.id_programa, nombre: programa.nombre },
            alumno: { id: alumno.id_alumno, nombre: `${alumno.apellidos}, ${alumno.nombres}` },
            mes: semana.mes,
            cambios: 2,
          },
        ],
        // Una fila por ALUMNO y PERIODO ACADEMICO.
        registro_vuelo: [
          {
            ...comun,
            id: 8,
            programa: { id: programa.id_programa, nombre: programa.nombre },
            alumno: { id: alumno.id_alumno, nombre: `${alumno.apellidos}, ${alumno.nombres}` },
            id_periodo_academico: 6,
            cambios: 1,
          },
        ],
        // Una fila por ALUMNO.
        alumnos: [
          {
            ...comun,
            id: alumno.id_alumno,
            alumno: { id: alumno.id_alumno, nombre: `${alumno.apellidos}, ${alumno.nombres}` },
            cambios: 1,
          },
        ],
      }

      const items = porModulo[modulo] ?? []
      return responder({
        items,
        total: items.length,
        page: Number(pagina),
        page_size: 40,
        total_pages: 1,
      })
    },

    listar: async ({ todas = false, idDocente, idColegio, fecha } = {}) => {
      const base = [
        { id: 'a3f1b2c4', id_docente: 1, docente: 'Rosa Elena Cárdenas Villanueva', id_colegio: 1, colegio: 'I.E. 86021 Ranrahirca', inicio: '2026-10-05T08:05:00', fin: '2026-10-05T11:40:00', estado: 'cerrada', cambios: 23 },
        { id: '9d2e7f10', id_docente: 1, docente: 'Rosa Elena Cárdenas Villanueva', id_colegio: 2, colegio: 'I.E. 86024 Mancos', inicio: '2026-10-06T08:10:00', fin: null, estado: 'abierta', cambios: 7 },
        { id: '55c08ab1', id_docente: 2, docente: 'Luis Ramos', id_colegio: 3, colegio: 'I.E. 86031 Shupluy', inicio: '2026-10-05T09:00:00', fin: '2026-10-05T12:15:00', estado: 'pendiente', cambios: 12 },
      ]
      let filtradas = todas ? base : base.filter((s) => s.id_docente === 1)
      if (idDocente) filtradas = filtradas.filter((s) => String(s.id_docente) === String(idDocente))
      if (idColegio) filtradas = filtradas.filter((s) => String(s.id_colegio) === String(idColegio))
      if (fecha) filtradas = filtradas.filter((s) => s.inicio.slice(0, 10) === fecha)
      return responder(filtradas)
    },

    detalle: async (id) =>
      responder({
        id,
        cambios: [
          { id_cambio: `${id}-1`, entidad: 'Rúbrica — Pérez Quispe, Ana', campo: 'Fluidez', valor_anterior: 'Inicio', valor_nuevo: 'Proceso', fecha_cliente: '2026-10-05T09:12:00', fecha_servidor: '2026-10-05T11:41:00', diferido: true },
          { id_cambio: `${id}-2`, entidad: 'Asistencia — Ramírez López, Carlos', campo: 'Presente', valor_anterior: null, valor_nuevo: 'Ausente', fecha_cliente: '2026-10-05T09:20:00', fecha_servidor: '2026-10-05T11:41:00', diferido: true },
          { id_cambio: `${id}-3`, entidad: 'Seguimiento de Lectura — Pérez Quispe, Ana', campo: 'Libros de sala', valor_anterior: '2', valor_nuevo: '3', fecha_servidor: '2026-10-05T10:05:00', diferido: false },
        ],
      }),
  },

  auth: {
    /**
     * `POST /password/primer-ingreso` (CU001).
     *
     * Devuelve LO MISMO que `/login`, token incluido: el usuario termina
     * dentro, sin volver a escribir sus credenciales.
     */
    async primerIngreso({ correo, temporal, passwordNueva }) {
      const usuario = db.USUARIOS.find((u) => u.correo.toLowerCase() === String(correo ?? '').trim().toLowerCase())
      // 401 genérico: no revela si la cuenta existe (CU002).
      if (!usuario || temporal !== db.CLAVE_DEMO) throw errorMock(401, 'Correo o contraseña incorrectos.', 'credenciales_invalidas')
      if (passwordNueva === temporal) {
        throw errorMock(400, 'La nueva contraseña debe ser diferente de la contraseña anterior.', 'password_igual')
      }
      usuario.debe_cambiar_contrasena = false
      return responder({ access_token: armarToken(usuario.id_usuario), token_type: 'bearer' }, RETARDO_ESCRITURA_MS)
    },

    /**
     * `POST /password/verificar-codigo` — valida el PIN SIN gastarlo (CU006).
     *
     * El PIN del simulador es siempre `123456`: seis DÍGITOS, como pide CU005.
     * Los `motivo` son los que distingue el contrato, porque la pantalla
     * ramifica por ellos.
     */
    async verificarCodigoPublico({ correo, codigo }) {
      if (!esCorreoValido(correo)) throw errorMock(422, 'El correo no es válido', 'validacion')
      if (String(codigo ?? '').trim() !== '123456') {
        throw errorMock(400, 'El código ingresado es incorrecto. Inténtalo nuevamente.', 'incorrecto')
      }
      return responder({ valido: true })
    },

    /**
     * `POST /password/recuperar`. Responde 200 SIEMPRE, exista el correo o no:
     * si distinguiera, cualquiera podría probar direcciones para averiguar
     * quién tiene cuenta. El mock replica ese silencio a propósito.
     */
    async recuperarPassword({ correo }) {
      if (!esCorreoValido(correo)) throw errorHttp(422, 'El correo no es válido')
      return responder({ detail: 'Si el correo está registrado, enviamos un código de verificación' })
    },

    /**
     * `POST /password/restablecer`. El código del mock es siempre `123456`.
     *
     * SEIS DÍGITOS, no alfanumérico: CU005 lo dice ("6 dígitos numéricos") y el
     * campo filtra las letras al teclear, así que un PIN como `AB12CD` era
     * imposible de escribir y el simulador no se podía usar de verdad.
     */
    async restablecerPassword({ correo, codigo }) {
      if (!esCorreoValido(correo)) throw errorHttp(422, 'El correo no es válido')
      if (String(codigo ?? '').trim() !== '123456') {
        throw errorHttp(400, 'El código no es válido o ya caducó')
      }
      return responder({ detail: 'Contraseña actualizada' }, RETARDO_ESCRITURA_MS)
    },

    async login({ correo, password }) {
      const usuario = db.USUARIOS.find((u) => u.correo.toLowerCase() === String(correo ?? '').trim().toLowerCase())
      // P1: un 401 nunca revela cuál de los dos campos falló.
      if (!usuario || password !== db.CLAVE_DEMO) throw errorHttp(401, 'Correo o contraseña incorrectos.')
      return responder({ access_token: armarToken(usuario.id_usuario), token_type: 'bearer' })
    },

    async me(token) {
      const usuario = usuarioDeToken(token)
      if (!usuario) throw errorHttp(401, 'No autenticado')
      return responder(perfilPublico(usuario), 150)
    },

    async logout() {
      // JWT stateless: el cierre real es borrar el token en el cliente (§3).
      return responder({ ok: true }, 80)
    },

    async passwordCodigo({ correo } = {}) {
      const email = String(correo ?? '').trim().toLowerCase()
      if (!email || !esCorreoValido(email)) {
        throw errorHttp(422, 'Debe indicar un correo válido')
      }
      return responder({ detail: 'Código enviado a tu correo' }, 150)
    },

    async verificarCodigo({ codigo } = {}) {
      const valor = String(codigo ?? '').trim().toUpperCase()
      if (valor?.length !== 6) {
        throw errorHttp(400, 'Código incorrecto o expirado')
      }
      return responder({ detail: 'Código correcto' }, 120)
    },

    async cambiarPassword({ codigo, contraseña_nueva, confirmar_contraseña_nueva } = {}) {
      const valor = String(codigo ?? '').trim().toUpperCase()
      const nueva = String(contraseña_nueva ?? '').trim()
      const confirmacion = String(confirmar_contraseña_nueva ?? '').trim()
      if (valor?.length !== 6 || !nueva || !confirmacion) {
        throw errorHttp(400, 'Código incorrecto o expirado')
      }
      if (nueva.length < 8) throw errorHttp(422, 'La contraseña debe tener al menos 8 caracteres')
      if (nueva !== confirmacion) throw errorHttp(422, 'Las contraseñas no coinciden')
      return responder({ detail: 'Contraseña actualizada' }, 150)
    },
  },

  catalogos: {
    colegios: () => responder(db.COLEGIOS),
    grados: () => responder(db.GRADOS),
    programas: () => responder(db.PROGRAMAS),
    ciclos: () => responder(db.CICLOS),
    nivelesRazkids: () => responder(db.NIVELES_RAZKIDS),
    nivelesRubrica: ({ programa } = {}) =>
      responder(
        programa ? db.NIVELES_RUBRICA.filter((n) => n.id_programa === Number(programa)) : db.NIVELES_RUBRICA,
      ),
    nivelGeneral: () => responder(db.NIVEL_GENERAL),
    esperadoPorGrado: () => responder(db.NIVEL_ESPERADO_POR_GRADO),
    periodos: () => responder(db.PERIODOS),
    /**
     * `GET /semanas` — solo las semanas con ALGUNA CLASE del grupo en ese mes.
     *
     * Antes devolvia el ano entero. Una semana sin clase no tiene tabla de
     * lectura ni obligacion de registrarla, asi que ofrecerla en el
     * desplegable era mandar al docente a una pantalla donde lo unico que
     * podia encontrarse era un 422.
     *
     * DEUDA CONOCIDA, y conviene no perderla de vista: el simulador sigue
     * mandando `numero`, `inicio`, `fin`, `mes` y `anio` ademas de los campos
     * del contrato. No es por compatibilidad bonita, es que CUATRO pantallas
     * anteriores a esta tanda —Nivel final, Consolidados, el detalle del
     * alumno y el resumen del Inicio— usan esta llamada SIN FILTROS como si
     * fuera el catalogo de semanas del ano, y de ahi sacan su lista de meses y
     * "la semana actual". Contra el backend real esa llamada sin los cinco
     * filtros responde 422, asi que esas cuatro se rompen el dia que se
     * conecten: necesitan otra fuente para los meses, no esta.
     */
    semanas: ({ mes } = {}) =>
      responder(
        db.SEMANAS.filter((s) => !mes || Number(s.mes) === Number(mes)).map((s) => ({
          id: s.id_semana,
          id_semana: s.id_semana,
          numero_semana: s.numero,
          fecha_inicio: s.inicio,
          fecha_fin: s.fin,
          cerrada: false,
          // Lo que esperan las cuatro pantallas de antes de la tanda 7.
          numero: s.numero,
          inicio: s.inicio,
          fin: s.fin,
          mes: s.mes,
          anio: s.anio,
        })),
      ),
  },

  alumnos: {
    listar: (filtros = {}) => responder(db.alumnosDe(filtros).map(fichaDeListado)),
    detalle: (id) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(id))
      if (!alumno) throw errorHttp(404, ALUMNO_NO_EXISTE)
      return responder(fichaDeAlumno(alumno))
    },
    historial: (id) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(id))
      if (!alumno) throw errorHttp(404, ALUMNO_NO_EXISTE)
      return responder(historialDeAlumno(alumno))
    },
  },

  evaluaciones: {
    /** Histórico del registro de vuelo: una fila por alumno con sus cuatro cortes (P6). */
    listar: (filtros = {}) =>
      responder(db.alumnosDe(filtros).map((alumno) => filaHistorico(alumno, filtros.periodo))),

    guardar: async (payload) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(payload.id_alumno))
      if (!alumno) throw errorHttp(404, ALUMNO_NO_EXISTE)

      const periodo = db.PERIODOS.find((p) => p.id_periodo === Number(payload.id_periodo))
      if (!periodo) throw errorHttp(422, 'El periodo de evaluación no existe')
      // RN-010: solo el corte vigente admite escritura; los anteriores están cerrados.
      if (periodo.estado === 'cerrado' && !payload.justificacion) {
        throw errorHttp(422, 'Los periodos cerrados requieren una justificación para corregirse')
      }
      // RN-008: las dos dimensiones de la rúbrica van siempre juntas.
      if (!payload.fluidez || !payload.comprension) {
        throw errorHttp(422, 'Ambas dimensiones son obligatorias')
      }
      // RN-015: cambiar el nivel sugerido exige justificación escrita.
      const cambiaSugerencia = payload.nivel_ajustado && payload.nivel_ajustado !== payload.nivel_sugerido
      if (cambiaSugerencia && !String(payload.justificacion ?? '').trim()) {
        throw errorHttp(422, 'La justificación es obligatoria al modificar el nivel sugerido')
      }

      const guardada = db.guardarEvaluacion(payload)
      return responder({ ...guardada, alumno: conDatosDeAlumno(alumno) }, RETARDO_ESCRITURA_MS)
    },
  },

  nivelFinal: {
    /** Consolidado mensual derivado de las rúbricas semanales (P9, RF-018). */
    listar: ({ mes, colegio, grado, programa, estado } = {}) => {
      const consolidado = db.nivelFinalDeMes(mes)
      const filas = db
        .alumnosDe({ colegio, grado, programa })
        .map((alumno) => {
          const fila = consolidado.get(alumno.id_alumno)
          return fila ? { ...conDatosDeAlumno(alumno), ...fila } : null
        })
        .filter(Boolean)

      if (estado === 'ajustados') return responder(filas.filter((f) => f.ajustado))
      if (estado === 'sin-ajustar') return responder(filas.filter((f) => !f.ajustado))
      return responder(filas)
    },

    ajustar: async (payload) => {
      // RN-015: la justificación es obligatoria y el servidor también la exige.
      if (!String(payload.justificacion ?? '').trim()) {
        throw errorHttp(422, 'La justificación es obligatoria')
      }
      const guardada = db.ajustarNivelFinal(payload)
      if (!guardada) throw errorHttp(404, 'No hay consolidado para ese alumno en el mes')
      return responder(guardada, RETARDO_ESCRITURA_MS)
    },
  },

  docentes: {
    asignaciones: (idDocente, { periodo } = {}) => responder(asignacionesConColegio(idDocente, periodo)),
    resumen: (idDocente, { periodo, semana } = {}) => responder(resumenDelDocente(idDocente, periodo, semana)),
  },

  semanal: {
    listar: ({ semana, colegio, grado } = {}) => {
      const guardadas = db.reporteSemanalDe(semana)
      return responder(
        db.alumnosDe({ colegio, grado }).map((alumno) => filaSemanal(alumno, guardadas.get(alumno.id_alumno), semana)),
      )
    },
    guardar: async (payload) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === payload.id_alumno)
      if (!alumno) throw errorHttp(404, ALUMNO_NO_EXISTE)
      const guardada = db.guardarReporteSemanal(normalizarReporte(payload))
      return responder(filaSemanal(alumno, guardada, payload.id_semana), RETARDO_ESCRITURA_MS)
    },
  },

  rubrica: {
    listar: ({ semana, colegio, grado } = {}) => {
      const guardadas = db.rubricaSemanalDe(semana)
      return responder(
        db.alumnosDe({ colegio, grado }).map((alumno) => filaRubrica(alumno, guardadas.get(alumno.id_alumno), semana)),
      )
    },
    guardar: async (payload) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === payload.id_alumno)
      if (!alumno) throw errorHttp(404, ALUMNO_NO_EXISTE)
      // RN-008: Fluidez y Comprensión viajan siempre juntas.
      if (!payload.id_nivel_fluidez || !payload.id_nivel_comprension) {
        throw errorHttp(422, 'Ambas dimensiones son obligatorias')
      }
      const guardada = db.guardarRubricaSemanal(payload)
      return responder(filaRubrica(alumno, guardada, payload.id_semana), RETARDO_ESCRITURA_MS)
    },
  },
  // ── Fase 6 ──────────────────────────────────────────────────────────────────

  dashboard: {
    /**
     * Todo el dashboard (P12) en una sola respuesta. RF-006 pide una sola vista
     * con varios gráficos que reaccionan a los mismos filtros; con la conexión
     * del 70 % de RN-017, una petición es mejor que siete.
     */
    resumen: (filtros = {}) =>
      responder({
        indicadores: agregados.indicadores(filtros),
        distribucion: agregados.distribucion(filtros),
        variacion: agregados.variacion(filtros),
        alcanzado_vs_esperado: agregados.alcanzadoVsEsperado(filtros),
        fluidez_vs_comprension: agregados.fluidezVsComprension(filtros),
        evolucion_programas: agregados.evolucionPorPrograma(filtros),
        colegios: agregados.resumenPorColegio(filtros),
      }),
    rankingColegios: (filtros = {}) => responder(agregados.rankingColegios(filtros)),
    rankingAulas: (filtros = {}) => responder(agregados.rankingAulas(filtros)),
    ejecutivo: (filtros = {}) =>
      responder({
        indicadores: agregados.panelEjecutivo(filtros),
        evolucion_programas: agregados.evolucionPorPrograma(filtros),
        ranking: agregados.rankingColegios(filtros),
      }),
  },

  colegios: {
    detalle: (id, filtros = {}) => {
      const detalle = agregados.detalleColegio(id, filtros)
      if (!detalle) throw errorHttp(404, 'El colegio no existe')
      return responder(detalle)
    },
  },

  consolidados: {
    nivel: (filtros = {}) => responder(agregados.consolidadoNivel(filtros)),
    libros: (filtros = {}) => responder(agregados.consolidadoLibros(filtros)),
  },

  alertas: {
    listar: (filtros = {}) => responder(agregados.alertasInconsistencias(filtros)),
    marcarRevisada: (id) => responder(agregados.marcarAlertaRevisada(id), RETARDO_ESCRITURA_MS),
  },

  // ── Fase 7 ──────────────────────────────────────────────────────────────────

  administracion: {
    /**
     * `GET /colegios/estado-calendario` — el periodo de HOY en cada colegio.
     *
     * El simulador pone a uno en receso a propósito: es el único caso en que
     * el formulario pregunta si la asignación es retroactiva o próxima, y sin
     * un colegio así no habría forma de verlo.
     */
    estadoCalendario: async () =>
      responder(
        db.COLEGIOS.map((c, i) => ({
          id: c.id_colegio,
          nombre: c.nombre,
          estado_calendario:
            i === 1
              ? { tipo: 'PR', numero: 3, es_pr4: false, fecha_fin: '2026-11-08' }
              : { tipo: 'PA', numero: 3, es_pr4: false, fecha_fin: '2026-10-31' },
        })),
      ),

    /** Valores existentes para los desplegables de filtro de colegios. */
    ubicaciones: () =>
      responder({
        departamentos: [...new Set(db.COLEGIOS.map((c) => c.departamento).filter(Boolean))],
        distritos: [...new Set(db.COLEGIOS.map((c) => c.distrito).filter(Boolean))],
      }),

    docentes: () =>
      responder(
        db.DOCENTES.map((d) => {
          const usuario = db.USUARIOS.find((u) => u.id_docente === d.id_docente)
          const vigentes = db.asignacionesDe(d.id_docente, db.PERIODO_VIGENTE.id_periodo)
          return {
            ...d,
            id_usuario: usuario?.id_usuario ?? null,
            nombre: `${d.nombres} ${d.apellidos}`,
            correo: usuario?.correo ?? null,
            activo: usuario?.activo ?? false,
            colegios_vigentes: vigentes.map((a) => db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)?.nombre),
          }
        }),
      ),

    colegios: () =>
      responder(
        db.COLEGIOS.map((c) => ({
          ...c,
          nombre: c.nombre,
          abreviatura: c.abreviatura,
          zona: c.zona,
          distrito: c.distrito,
        })),
      ),

    /**
     * `GET /colegios/{id}` — el colegio COMPLETO.
     *
     * El listado no trae grados ni programas: solo el detalle. Los grados van
     * con su `dia_clase` (CU013); el primero se deja a propósito en `null`
     * para reproducir a los colegios creados antes de que el campo existiera,
     * que es el caso que el formulario tiene que obligar a completar.
     */
    colegio: async (idColegio) => {
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio))
      if (!colegio) throw errorHttp(404, `No existe un colegio con id_colegio=${idColegio}`)
      return responder({
        ...colegio,
        id: colegio.id_colegio,
        /**
         * Cada grado con su día y sus SECCIONES (T3).
         *
         * Una por grado, "Única", que es con lo que nace un grado y el caso
         * corriente de todos los colegios de hoy. El caso de varias secciones
         * se ejercita en las pruebas que lo necesitan, montando su propio
         * detalle: ponerlo aquí obligaría a elegir sección en cada prueba de
         * Asistencia, que no es de lo que van.
         */
        grados: db.GRADOS.map((g, i) => ({
          id: g.id_grado,
          nombre: g.nombre,
          dia_clase: i === 0 ? null : ((i % 5) + 1),
          secciones: [{ id: 100 + g.id_grado, nombre: 'Única' }],
        })),
        programas: db.PROGRAMAS.map((p) => ({ id: p.id_programa, nombre: p.nombre })),
      })
    },

    /**
     * `GET /alumnos/{id}/resumen` — las tres tarjetas de CU015.
     *
     * `nivel_descriptivo` lo calcula el SERVIDOR con la matriz por grado: una
     * "J" es "Logrado" en 3.º y apenas "Inicio" en 5.º. El simulador devuelve
     * uno coherente en vez de inventarse la tabla entera.
     */
    /**
     * `GET /alumnos/{id}` — el alumno con el inicio de su grupo actual.
     *
     * `pertenece_desde` es `null` cuando está inactivo: sin grupo en curso no
     * hay fecha de inicio que dar.
     *
     * Uno de cada siete activos lo trae en `null` AUNQUE ESTÉ ACTIVO: es el
     * caso que encontró el tester (D65), los alumnos cargados antes de que el
     * backend modelara el historial de pertenencia. El formulario tiene que
     * pedir la fecha para poder arreglarlos, y sin un alumno así en el
     * simulador no hay manera de verlo.
     */
    alumno: async (idAlumno) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(idAlumno))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${idAlumno}`)
      const inicio = db.ANIO_ESCOLAR_INICIO ?? '2026-03-02'
      const sinPertenencia = alumno.id_alumno % 7 === 0
      // El MISMO mapeo que el listado a propósito: el detalle no puede traer
      // menos campos que la fila, o editar borraría lo que no se mostró.
      return responder({
        ...alumnoDeAdministracion(alumno),
        creado_en: `${inicio}T08:15:00-05:00`,
        pertenece_desde: alumno.activo && !sinPertenencia ? inicio : null,
      })
    },

    resumenAlumno: async (idAlumno) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(idAlumno))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${idAlumno}`)
      // Uno de cada cinco todavía no tiene evaluación: es el caso que la
      // pantalla tiene que resolver con "-" y "Sin evaluar".
      const sinEvaluar = alumno.id_alumno % 5 === 0
      return responder({
        nivel_colocado: sinEvaluar
          ? null
          : { letra: 'J', id_nivel_rk: 10, numero_periodo: 3, nivel_descriptivo: 'Logrado' },
        libros_leidos_anio: sinEvaluar ? 0 : 7,
        asistencia: sinEvaluar
          ? { porcentaje: null, asistidas: 0, contabilizadas: 0 }
          : { porcentaje: 92.5, asistidas: 37, contabilizadas: 40 },
      })
    },

    lecturaAlumno: async (idAlumno) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(idAlumno))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${idAlumno}`)
      if (alumno.id_alumno % 5 === 0) return responder([])
      return responder([
        { semana: 23, fecha_inicio: '2026-06-15', fecha_fin: '2026-06-19', mes: 6, id_programa: alumno.id_programa,
          estado_tabla: 'normal', motivo_no_realizada: null, asistencia: 'presente',
          lsn_titulo: 'El zorro', lsn_nota: 0, lsn_maximo: 5, cantidad_lsl: 3, total_libros: 4,
          observacion: null, estado_fila: 'completada' },
        { semana: 22, fecha_inicio: '2026-06-08', fecha_fin: '2026-06-12', mes: 6, id_programa: alumno.id_programa,
          estado_tabla: 'no_realizada', motivo_no_realizada: 'Paro de transportistas', asistencia: null,
          lsn_titulo: null, lsn_nota: null, lsn_maximo: null, cantidad_lsl: null, total_libros: 0,
          observacion: null, estado_fila: 'no_aplica' },
      ])
    },

    rubricaAlumno: async (idAlumno) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(idAlumno))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${idAlumno}`)
      if (alumno.id_alumno % 5 === 0) return responder({ evaluaciones: [] })
      return responder({
        evaluaciones: [
          { mes: 6, fluidez: 'Logrado', comprension: null, estado: 'incompleta', resultado_decimas: null },
          { mes: 5, fluidez: 'Inicio', comprension: 'En proceso', estado: 'completada', resultado_decimas: 16 },
        ],
      })
    },

    registroVueloAlumno: async (idAlumno) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(idAlumno))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${idAlumno}`)
      const conDecision = alumno.id_alumno % 5 !== 0
      return responder([1, 2, 3, 4].map((numero) => {
        const decidido = conDecision && numero <= 2
        let origen = 'pendiente_periodo_anterior'
        if (numero === 1) origen = 'grado'
        else if (conDecision && numero <= 3) origen = 'periodo_anterior'
        return {
          numero,
          id_periodo_academico: numero,
          entrada: origen === 'pendiente_periodo_anterior' ? null : ['E', 'F', 'G'][numero - 1],
          origen_entrada: origen,
          nivel_colocado: decidido ? ['F', 'G'][numero - 1] : null,
          id_nivel_colocado: decidido ? [7, 8][numero - 1] : null,
          proyeccion: decidido ? ['G', 'H'][numero - 1] : null,
          nivel_programa: decidido ? 'En proceso' : null,
        }
      }))
    },

    alumnos: () => responder(db.ALUMNOS.map(alumnoDeAdministracion)),

    usuarios: () =>
      responder(
        db.USUARIOS.map((u) => {
          const rol = { 1: 'Docente', 2: 'Supervisor', 3: 'Directivo' }[u.id_rol] ?? 'Usuario'
          return {
            ...u,
            nombre: `${u.nombres} ${u.apellidos}`,
            rol,
            // Una cuenta recién creada arrastra su temporal hasta el primer
            // ingreso (CU001). En el simulador solo la última, para que la
            // columna se vea sin inventar que todas están pendientes.
            debe_cambiar_contrasena: Boolean(u.debe_cambiar_contrasena),
          }
        }),
      ),

    /** Baja lógica del colegio (D5): cambia el estado, no borra nada. */
    cambiarEstadoColegio: async (idColegio, activo) => {
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(idColegio))
      if (!colegio) throw errorHttp(404, `No existe un colegio con id_colegio=${idColegio}`)
      colegio.activo = Boolean(activo)
      return responder(colegio, RETARDO_ESCRITURA_MS)
    },

    /**
     * Auditoría de un registro. El mock devuelve un rastro de ejemplo para
     * poder construir y probar la pestaña; el backend aún no la publica.
     */
    auditoria: async () =>
      responder({
        items: [
          {
            fecha: '2026-10-05T14:32:00-05:00',
            usuario: 'Docente de Prueba',
            rol: 'Docente',
            accion: 'editó',
            cambios: [
              { campo: 'Nombres', anterior: 'Ana', nuevo: 'Ana María' },
              { campo: 'Grado', anterior: '1.º', nuevo: '2.º' },
            ],
          },
          {
            fecha: '2026-10-04T09:10:00-05:00',
            usuario: 'Jefa de Prueba',
            rol: 'Supervisor',
            accion: 'creó',
            cambios: [],
          },
        ],
        total: 2,
        page: 1,
        page_size: 10,
        total_pages: 1,
      }),

    /** Secciones de un colegio. Mientras el backend no las modele, van fijas. */
    secciones: async (idColegio) =>
      responder(
        ['A', 'B', 'C'].map((letra, i) => ({
          id_seccion: Number(idColegio) * 10 + i + 1,
          id_colegio: Number(idColegio),
          nombre: letra,
        })),
      ),

    asignaciones: () =>
      responder(
        db.ASIGNACIONES.map((a) => {
          const docente = db.DOCENTES.find((d) => d.id_docente === a.id_docente)
          const periodo = db.PERIODOS.find((p) => p.id_periodo === a.id_periodo)
          return {
            ...a,
            docente: docente ? `${docente.nombres} ${docente.apellidos}` : '—',
            colegio: db.COLEGIOS.find((c) => c.id_colegio === a.id_colegio)?.nombre ?? '—',
            periodo: periodo?.nombre ?? '—',
            estado_periodo: periodo?.estado ?? null,
            /**
             * La asignación es por COLEGIO COMPLETO (RN-003), así que van sus
             * seis grados. Y los subprogramas de cada grado NO son los que
             * ofrece el colegio: son los de sus alumnos, igual que en el
             * backend. De ahí sale que un grado sin alumnos de Comprensión
             * Lectora no deba ofrecerla, que es justo lo que hacía que el
             * servidor respondiera 403 a una clase elegida desde la pantalla.
             */
            grados: db.GRADOS.map((g) => {
              const alumnos = db.alumnosDe({ colegio: a.id_colegio, grado: g.id_grado })
              const nombres = alumnos
                .map((al) => db.PROGRAMAS.find((p) => p.id_programa === al.id_programa)?.nombre)
                .filter(Boolean)
              return {
                id: g.id_grado,
                nombre: g.nombre,
                cantidad_alumnos: alumnos.length,
                ciclos: [...new Set(alumnos.map((al) => al.ciclo).filter(Boolean))],
                subprogramas: [...new Set(nombres)],
              }
            }),
          }
        }),
      ),

    /**
     * Igual que `POST /colegios`: solo exige nombre y zona, que es lo único que
     * guarda el backend. La abreviatura no se pide —se deduce del nombre— porque
     * solo la usan las etiquetas de los gráficos del propio mock.
     */
    crearColegio: async ({ nombre, zona }) => {
      const limpioNombre = String(nombre ?? '').trim()
      const limpioZona = String(zona ?? '').trim()
      if (!limpioNombre || !limpioZona) throw errorHttp(422, 'Completa el nombre y la zona del colegio')
      const repetido = db.COLEGIOS.some((c) => c.nombre.trim().toLowerCase() === limpioNombre.toLowerCase())
      if (repetido) throw errorHttp(422, 'Ya existe un colegio con ese nombre')
      const nuevo = {
        id_colegio: Math.max(...db.COLEGIOS.map((c) => c.id_colegio)) + 1,
        nombre: limpioNombre,
        abreviatura: limpioNombre.replace(/[^A-Za-zÁÉÍÓÚÑ ]/g, '').trim().split(/\s+/).slice(-2).map((x) => x[0] ?? '').join('').toUpperCase() || 'N/D',
        zona: limpioZona,
        distrito: limpioZona,
      }
      db.COLEGIOS.push(nuevo)
      return responder(nuevo, RETARDO_ESCRITURA_MS)
    },

    crearAlumno: async ({ nombres, apellidos, id_colegio: idColegio, id_grado: idGrado, id_programa: idPrograma, aula = 'A' }) => {
      const nombre = String(nombres ?? '').trim()
      const apellido = String(apellidos ?? '').trim()
      const colegioId = Number(idColegio)
      const gradoId = Number(idGrado)
      const programaId = Number(idPrograma)
      if (!nombre || !apellido || !colegioId || !gradoId || !programaId) {
        throw errorHttp(422, 'Completa nombre, colegio, grado y programa del alumno')
      }
      if (!db.COLEGIOS.some((c) => c.id_colegio === colegioId)) throw errorHttp(404, 'El colegio no existe')
      const ultimo = db.ALUMNOS.at(-1)
      const nuevo = {
        id_alumno: (ultimo?.id_alumno ?? 0) + 1,
        codigo: `EST-${db.COLEGIOS.find((c) => c.id_colegio === colegioId)?.abreviatura ?? 'NUE'}-${String((ultimo?.id_alumno ?? 0) + 1).padStart(4, '0')}`,
        nombres: nombre,
        apellidos: apellido,
        id_colegio: colegioId,
        id_grado: gradoId,
        aula: String(aula || 'A').toUpperCase(),
        id_ciclo_nominal: db.GRADOS.find((g) => g.id_grado === gradoId)?.id_ciclo ?? 1,
        id_ciclo_evaluado: db.GRADOS.find((g) => g.id_grado === gradoId)?.id_ciclo ?? 1,
        id_programa: programaId,
        activo: true,
      }
      db.ALUMNOS.push(nuevo)
      return responder(nuevo, RETARDO_ESCRITURA_MS)
    },

    /**
     * Alta de docente con la MISMA forma que `POST /profesores` del backend: no
     * recibe contraseña, la genera, y la devuelve en `contraseña_temporal` para
     * que el Supervisor pueda entregarla (el backend solo la devuelve cuando el
     * correo de bienvenida falla; aquí siempre, que es el caso útil en pruebas).
     */
    crearDocente: async ({ nombres, apellidos, correo }) => {
      const nombre = String(nombres ?? '').trim()
      const apellido = String(apellidos ?? '').trim()
      const email = String(correo ?? '').trim().toLowerCase()
      if (!nombre || !apellido || !email) throw errorHttp(422, 'Completa nombres, apellidos y correo')
      if (!esCorreoValido(email)) throw errorHttp(422, 'El correo no es válido')
      // El backend responde 409 cuando el correo ya está tomado.
      if (db.USUARIOS.some((u) => u.correo.toLowerCase() === email)) throw errorHttp(409, CORREO_REGISTRADO)

      const idUsuario = Math.max(...db.USUARIOS.map((u) => u.id_usuario)) + 1
      const idDocente = Math.max(...db.DOCENTES.map((d) => d.id_docente)) + 1
      const temporal = `SICEDU-${String(idUsuario).padStart(3, '0')}`

      const nuevo = { id_usuario: idUsuario, id_rol: 1, correo: email, id_docente: idDocente, nombres: nombre, apellidos: apellido, activo: true }
      db.USUARIOS.push(nuevo)
      db.DOCENTES.push({ id_docente: idDocente, nombres: nombre, apellidos: apellido })
      return responder({ ...nuevo, 'contraseña_temporal': temporal }, RETARDO_ESCRITURA_MS)
    },

    /** Reactiva una cuenta desactivada (`PATCH /profesores/{id}/activar`). */
    activarUsuario: async (id) => {
      const usuario = db.USUARIOS.find((u) => u.id_usuario === Number(id))
      if (!usuario) throw errorHttp(404, 'El usuario no existe')
      usuario.activo = true
      return responder(usuario, RETARDO_ESCRITURA_MS)
    },

    /**
     * Misma forma que `POST /usuarios`: no recibe contraseña, la genera, y
     * devuelve `correo_enviado` para que la pantalla decida si mostrarla.
     * Rechaza el rol Docente, igual que el backend (para eso está crearDocente).
     */
    crearUsuario: async ({ nombres, apellidos, correo, id_rol: idRol }) => {
      const nombre = String(nombres ?? '').trim()
      const apellido = String(apellidos ?? '').trim()
      const email = String(correo ?? '').trim().toLowerCase()
      const rol = Number(idRol)
      if (!nombre || !apellido || !email || !rol) throw errorHttp(422, 'Completa todos los datos del usuario')
      if (!esCorreoValido(email)) throw errorHttp(422, 'El correo no es válido')
      // Ya NO se rechaza el rol Docente: `/profesores` desapareció y este es
      // el único alta de los tres roles. Con id_rol de Docente, el backend crea
      // además su ficha y sus asignaciones en la misma transacción.
      if (db.USUARIOS.some((u) => u.correo.toLowerCase() === email)) throw errorHttp(409, CORREO_REGISTRADO)

      const idUsuario = Math.max(...db.USUARIOS.map((u) => u.id_usuario)) + 1
      const nuevo = { id_usuario: idUsuario, id_rol: rol, correo: email, id_docente: null, nombres: nombre, apellidos: apellido, activo: true }
      db.USUARIOS.push(nuevo)
      // Sin SMTP configurado el envío falla, que es el caso habitual hoy.
      return responder({ ...nuevo, 'contraseña_temporal': `SICEDU-${String(idUsuario).padStart(3, '0')}`, correo_enviado: false }, RETARDO_ESCRITURA_MS)
    },

    actualizarUsuario: async (id, { nombres, apellidos, correo, id_rol: idRol, password }) => {
      const usuario = db.USUARIOS.find((u) => u.id_usuario === Number(id))
      if (!usuario) throw errorHttp(404, 'El usuario no existe')
      const nombre = String(nombres ?? usuario.nombres).trim()
      const apellido = String(apellidos ?? usuario.apellidos).trim()
      const email = String(correo ?? usuario.correo).trim().toLowerCase()
      const rol = Number(idRol ?? usuario.id_rol)
      if (!nombre || !apellido || !email || !rol) throw errorHttp(422, 'Completa todos los campos del usuario')
      if (!esCorreoValido(email)) throw errorHttp(422, 'El correo no es válido')
      if (db.USUARIOS.some((u) => u.id_usuario !== Number(id) && u.correo.toLowerCase() === email)) throw errorHttp(422, CORREO_REGISTRADO)

      const anteriorRol = usuario.id_rol
      usuario.nombres = nombre
      usuario.apellidos = apellido
      usuario.correo = email
      usuario.id_rol = rol

      if (rol === 1) {
        if (!usuario.id_docente) {
          const siguienteIdDocente = Math.max(...db.DOCENTES.map((d) => d.id_docente)) + 1
          usuario.id_docente = siguienteIdDocente
          db.DOCENTES.push({ id_docente: siguienteIdDocente, nombres: nombre, apellidos: apellido })
        } else {
          const docente = db.DOCENTES.find((d) => d.id_docente === usuario.id_docente)
          if (docente) {
            docente.nombres = nombre
            docente.apellidos = apellido
          }
        }
      } else if (anteriorRol === 1 && usuario.id_docente) {
        usuario.id_docente = null
      }

      if (password && String(password).trim()) {
        usuario.password = String(password).trim()
      }
      return responder(usuario, RETARDO_ESCRITURA_MS)
    },

    /**
     * Baja lógica. Replica las dos reglas que aplica el servidor: no se puede
     * dejar sin la última cuenta activa de Supervisor ni de Directivo (409).
     */
    desactivarUsuario: async (id) => {
      const usuario = db.USUARIOS.find((u) => u.id_usuario === Number(id))
      if (!usuario) throw errorHttp(404, `No existe un usuario con id_usuario=${id}`)
      const NOMBRE = { 2: 'Supervisor', 3: 'Directivo' }
      if (NOMBRE[usuario.id_rol]) {
        const activos = db.USUARIOS.filter((u) => u.activo && u.id_rol === usuario.id_rol).length
        if (activos <= 1) {
          throw errorHttp(409, `No puedes desactivar la última cuenta activa de ${NOMBRE[usuario.id_rol]}`)
        }
      }
      usuario.activo = false
      return responder(usuario, RETARDO_ESCRITURA_MS)
    },

    actualizarAlumno: async (id, cambios) => {
      const alumno = db.ALUMNOS.find((a) => a.id_alumno === Number(id))
      if (!alumno) throw errorHttp(404, `No existe un alumno con id_alumno=${id}`)
      Object.assign(alumno, cambios)
      return responder(alumno, RETARDO_ESCRITURA_MS)
    },

    actualizarColegio: async (id, cambios) => {
      const colegio = db.COLEGIOS.find((c) => c.id_colegio === Number(id))
      if (!colegio) throw errorHttp(404, `No existe un colegio con id_colegio=${id}`)
      Object.assign(colegio, Object.fromEntries(Object.entries(cambios).filter(([, v]) => v != null)))
      return responder(colegio, RETARDO_ESCRITURA_MS)
    },

    /**
     * RN-003: la rotación ocurre SOLO al cierre de un periodo y cambia el colegio
     * completo, no grados sueltos. Por eso la asignación es docente × colegio ×
     * periodo (los seis grados van juntos) y solo se admite sobre periodos que
     * todavía no empiezan.
     */
    crearAsignacion: async ({ id_docente: idDocente, id_colegio: idColegio, id_periodo: idPeriodo }) => {
      const periodo = db.PERIODOS.find((p) => p.id_periodo === Number(idPeriodo))
      if (!periodo) throw errorHttp(422, 'El periodo no existe')
      if (periodo.estado !== 'programado') {
        throw errorHttp(422, 'Solo se asigna en periodos que aún no empiezan: la rotación ocurre al cierre de un periodo')
      }
      const repetida = db.ASIGNACIONES.some(
        (a) => a.id_docente === Number(idDocente) && a.id_colegio === Number(idColegio) && a.id_periodo === Number(idPeriodo),
      )
      if (repetida) throw errorHttp(422, 'El docente ya tiene ese colegio en ese periodo')

      const nueva = {
        id_asignacion: Math.max(...db.ASIGNACIONES.map((a) => a.id_asignacion)) + 1,
        id_docente: Number(idDocente),
        id_colegio: Number(idColegio),
        id_periodo: Number(idPeriodo),
        grados: db.GRADOS.map((g) => g.id_grado),
      }
      db.ASIGNACIONES.push(nueva)
      return responder(nueva, RETARDO_ESCRITURA_MS)
    },

    eliminarAsignacion: async (idAsignacion) => {
      const indice = db.ASIGNACIONES.findIndex((a) => a.id_asignacion === Number(idAsignacion))
      if (indice < 0) throw errorHttp(404, 'La asignación no existe')
      const periodo = db.PERIODOS.find((p) => p.id_periodo === db.ASIGNACIONES[indice].id_periodo)
      if (periodo?.estado !== 'programado') {
        throw errorHttp(422, 'No se retira una asignación de un periodo en curso o cerrado')
      }
      db.ASIGNACIONES.splice(indice, 1)
      return responder({ ok: true }, RETARDO_ESCRITURA_MS)
    },
  },
}

/**
 * Vacia el estado que el simulador acumula durante la sesion.
 *
 * Solo para las pruebas. Las clases y las tablas de lectura viven en modulo, y
 * sin esto una prueba hereda lo que creo la anterior: crear la misma tabla dos
 * veces responde 409 con razon, pero el fallo aparece en la prueba equivocada.
 */
export function _reiniciarSimulador() {
  Object.keys(CLASES_MOCK).forEach((k) => delete CLASES_MOCK[k])
  Object.keys(TABLAS_LECTURA).forEach((k) => delete TABLAS_LECTURA[k])
  Object.keys(RUBRICAS_MOCK).forEach((k) => delete RUBRICAS_MOCK[k])
  Object.keys(DECISIONES_MOCK).forEach((k) => delete DECISIONES_MOCK[k])
  Object.keys(REPROGRAMACIONES_MOCK).forEach((k) => delete REPROGRAMACIONES_MOCK[k])
}

export default handlers
