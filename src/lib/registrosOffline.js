// Escrituras de Lectura, Rúbrica y Registro de Vuelo a través de la cola offline
// (RNF-001, P3 §1). Es la misma cola de Asistencias: cada cambio es una
// OPERACIÓN con su `id_operacion`, la `version` que veía el docente, la hora
// real (`realizado_en`) y su actividad, y sale cuando hay conexión.
//
// Lo que estos tres módulos tienen y Asistencias no:
//
//   · CONTROL DE VERSIÓN. Si otra persona guardó antes, el ítem vuelve
//     `modificacion_concurrente` con el registro vigente. No se reintenta ni se
//     adopta en silencio: queda como rechazo con "Cargar versión actual", que
//     descarta la operación (`POST /sincronizacion/operaciones/{id}/descartar`)
//     y pone el registro del servidor en pantalla.
//   · SE MANDA SOLO LO QUE CAMBIÓ. Dos ediciones de la misma fila que esperan
//     juntas se FUSIONAN en un envío; si no, la segunda borraría la primera.
//   · EL SERVIDOR CALCULA. Mientras espera, la fila muestra el valor elegido,
//     pero estado, totales, resultado, entrada y sugerencia siguen como en la
//     última descarga: se recalculan con la respuesta del servidor.
//
// Los rechazos llegan aunque la pantalla ya no esté abierta (se sincroniza al
// volver la conexión), así que no se resuelven en la pantalla: van a un almacén
// común que pintan las tres pantallas y el panel de sincronización.
import { MOTIVO_FILA, guardarFilas } from '../api/resources/lectura'
import { MOTIVO_RUBRICA, guardarRubricas } from '../api/resources/rubricaMensual'
import { MOTIVO_VUELO, PUNTOS_POR_PERIODO, guardarRegistroVuelo } from '../api/resources/registroVueloAnual'
import { descartarOperacion, textoDeRechazo } from '../api/resources/sincronizacion'
import { ajustarPendientes, encolar, registrarEnviador } from './colaOffline'
import useRechazosStore from '../store/rechazosStore'

/** Una fila de la lista con el registro nuevo; `igual` dice cuál es. */
const reemplazar = (lista, igual, nuevo) => (lista ?? []).map((x) => (igual(x) ? nuevo(x) : x))

const MODULOS = {
  lectura: {
    tipo: 'lectura-fila',
    contrato: 'lectura',
    prefijo: ['lectura', 'tabla'],
    motivos: MOTIVO_FILA,
    enviar: ({ idTabla, item }) => guardarFilas(idTabla, [item]),
    aplicar: (datos, { item }, registro) =>
      datos?.filas
        ? { ...datos, filas: reemplazar(datos.filas, (f) => f.id_alumno === item.id_alumno, (f) => ({ ...f, ...registro })) }
        : datos,
  },
  rubrica: {
    tipo: 'rubrica-mensual',
    contrato: 'rubrica',
    prefijo: ['rubricas'],
    motivos: MOTIVO_RUBRICA,
    enviar: ({ item }) => guardarRubricas([item]),
    aplicar: (datos, { item }, registro) =>
      datos?.items
        ? { ...datos, items: reemplazar(datos.items, (i) => i.id_alumno === item.id_alumno, (i) => ({ ...i, ...registro })) }
        : datos,
  },
  vuelo: {
    tipo: 'registro-vuelo',
    contrato: 'registro_vuelo',
    prefijo: ['registro-vuelo'],
    motivos: MOTIVO_VUELO,
    enviar: ({ item }) => guardarRegistroVuelo([item]),
    aplicar: (datos, { item, numero }, registro) => {
      if (!datos?.items) return datos
      return {
        ...datos,
        items: reemplazar(
          datos.items,
          (a) => a.id_alumno === item.id_alumno,
          (a) => {
            const periodos = reemplazar(a.periodos, (p) => p.numero === (registro.numero ?? numero), (p) => ({ ...p, ...registro }))
            // El avance anual es el número de PA con nivel colocado.
            return { ...a, periodos, avance_anual: periodos.filter((p) => p.nivel_colocado).length * PUNTOS_POR_PERIODO }
          },
        ),
      }
    },
  },
}

/** El cliente de TanStack Query de la aplicación, para escribir en la caché. */
let consultas = null
export const conectarConsultas = (cliente) => {
  consultas = cliente
}

/** Escribe el registro en TODAS las consultas del módulo que lo contengan. */
function aplicarEnCache(modulo, envio, registro) {
  if (!consultas || !registro) return
  const { prefijo, aplicar } = MODULOS[modulo]
  consultas.setQueriesData({ queryKey: prefijo }, (datos) => aplicar(datos, envio, registro))
}

/**
 * Lo que pasó con la operación, ya en el servidor.
 *
 * Se resuelve AQUÍ y no en la pantalla porque la respuesta puede llegar con la
 * pantalla cerrada: al reconectar, horas después del cambio.
 */
function procesarResultado(modulo, envio, resultado) {
  if (!resultado) return
  const { motivos } = MODULOS[modulo]

  if (resultado.estado === 'rechazada') {
    useRechazosStore.getState().agregar({
      clave: envio.clave,
      modulo,
      nombre: envio.nombre ?? null,
      idOperacion: resultado.id_operacion,
      motivo: resultado.motivo,
      detail: textoDeRechazo(resultado, motivos) ?? 'El servidor rechazó el registro.',
      registro: resultado.motivo === 'modificacion_concurrente' ? resultado.registro : null,
      envio,
    })
    // Lo que se puso en pantalla al encolar no se guardó: si no hay un
    // registro vigente que ofrecer, se vuelve a pedir lo que tiene el servidor.
    if (resultado.motivo !== 'modificacion_concurrente') {
      consultas?.invalidateQueries({ queryKey: MODULOS[modulo].prefijo })
    }
    return
  }

  const registro = resultado.registro
  if (registro) {
    aplicarEnCache(modulo, envio, registro)
    useRechazosStore.getState().quitar(envio.clave)
    /**
     * La versión subió. Si hay OTRA edición de esta misma fila esperando, se
     * encoló con la versión vieja y chocaría contra el propio cambio del
     * docente: se le pone la nueva.
     */
    if (registro.version != null) {
      ajustarPendientes((pendiente) =>
        pendiente.clave === envio.clave && pendiente.payload?.item?.version === envio.item.version
          ? { ...pendiente, payload: { ...pendiente.payload, item: { ...pendiente.payload.item, version: registro.version } } }
          : pendiente,
      ).catch(() => null) // `ajustarPendientes` ya maneja sus errores.
    }
  }
  // Entrada y sugerencia del Registro de Vuelo dependen de otros registros:
  // se vuelven a pedir para no dejar las de la última descarga.
  if (modulo === 'vuelo') consultas?.invalidateQueries({ queryKey: MODULOS.vuelo.prefijo })
}

Object.entries(MODULOS).forEach(([modulo, { tipo, contrato, enviar }]) => {
  registrarEnviador(
    tipo,
    async ({ id_operacion: idOperacion, ...envio }) => {
      const conId = { ...envio, item: { ...envio.item, id_operacion: idOperacion } }
      const respuesta = await enviar(conId)
      // El de ESTA operación, por su `id_operacion` (D91): un rechazo puede no
      // traer `registro` con el que reconocerlo.
      const resultado = Array.isArray(respuesta)
        ? (respuesta.find((r) => r?.id_operacion === idOperacion) ?? respuesta[0] ?? null)
        : null
      procesarResultado(modulo, conId, resultado)
      return respuesta
    },
    { modulo: contrato },
  )
})

/**
 * Encola un cambio de UNA fila.
 *
 * @param modulo 'lectura' | 'rubrica' | 'vuelo'
 * @param clave el registro (alumno, alumno-periodo…): una espera por registro.
 * @param envio `{item, ...}` lo que necesita su enviador; `item` es la operación
 *   sin `id_operacion`, que pone la cola (el mismo en cada reintento).
 * @param local los campos que la fila muestra mientras espera.
 */
export function guardarRegistro(modulo, { clave, envio, local, descripcion, idActividad }) {
  const { tipo } = MODULOS[modulo]
  aplicarEnCache(modulo, envio, local)
  return encolar({
    clave: `${tipo}:${clave}`,
    tipo,
    payload: { ...envio, clave: `${tipo}:${clave}` },
    descripcion,
    idActividad,
    // La versión es la que vio el docente ANTES de la primera edición: se
    // conserva la del envío que espera, y los campos se suman.
    fusionar: (anterior, nuevo) => ({
      ...nuevo,
      item: { ...anterior.item, ...nuevo.item, version: anterior.item.version },
    }),
  })
}

/** "Cargar versión actual": descarta la operación y pone el registro vigente. */
export async function cargarVersionActual(clave) {
  const rechazo = useRechazosStore.getState().rechazos.find((r) => r.clave === clave)
  if (!rechazo) return
  // Si ya estaba descartada (otra pestaña) o no existe, el registro vigente se
  // carga igual: lo que importa es dejar de mostrar algo que no se guardó.
  await descartarOperacion(rechazo.idOperacion).catch(() => null)
  if (rechazo.registro) aplicarEnCache(rechazo.modulo, rechazo.envio, rechazo.registro)
  else consultas?.invalidateQueries({ queryKey: MODULOS[rechazo.modulo].prefijo })
  useRechazosStore.getState().quitar(clave)
}

/** "Descartar" un rechazo sin registro que cargar (otros motivos). */
export async function descartarRechazo(clave) {
  const rechazo = useRechazosStore.getState().rechazos.find((r) => r.clave === clave)
  if (!rechazo) return
  await descartarOperacion(rechazo.idOperacion).catch(() => null)
  useRechazosStore.getState().quitar(clave)
}

export const PREFIJOS_REGISTROS = Object.values(MODULOS).map((m) => m.prefijo)
