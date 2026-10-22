// Sincronización de lo que se hizo sin conexión (CU012, CU017 a CU021).
//
// Dos endpoints que resuelven dos problemas distintos, y conviene no
// confundirlos:
//
//   · `POST /sincronizacion/pendientes` — el AVISO. Al recuperar la conexión
//     se manda primero la lista de qué operaciones existen, antes de mandarlas
//     de verdad. Es lo que cierra el agujero descrito en
//     `docs/propuesta-visibilidad-sincronizacion.md`: hasta ahora, un Docente
//     que trabajó una semana sin señal era invisible para el Supervisor —su
//     fila salía en verde— porque el servidor no tenía forma de enterarse de
//     que existía ese trabajo. Con el aviso, el riesgo se ve en cuanto hay un
//     hueco de red, sin esperar a que suba el contenido completo.
//
//   · `GET /sincronizacion/operaciones/{id}` — la VERIFICACIÓN. Para el envío
//     que se quedó sin respuesta: se mandó, pero no se supo si llegó. Antes de
//     reintentarlo se pregunta qué pasó con él. La idempotencia de
//     `id_operacion` ya evita el duplicado, pero preguntar evita además el
//     reintento inútil y, sobre todo, permite distinguir "no llegó" de "llegó
//     y fue rechazado", que para la persona son cosas muy distintas.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/**
 * Avisa de qué operaciones hay pendientes, sin su contenido.
 *
 * Es idempotente: repetirlo no crea nada. Y no debe bloquear el envío — si
 * falla, se manda igual lo que haya: avisar es mejor que nada, pero perder el
 * trabajo por no poder avisar sería absurdo.
 */
export const avisarPendientes = (operaciones) =>
  resolver({
    mock: () => handlers.sincronizacion.pendientes(operaciones),
    real: () => api.post(ENDPOINTS.sincronizacion.pendientes, operaciones),
    forzarReal: adminContraApiReal,
  })

/**
 * Qué pasó con una operación que se quedó sin respuesta.
 *
 * `desconocida` significa que el servidor no la ha visto: hay que reintentar.
 * `aceptada` o `rechazada`, que sí llegó y no hace falta volver a mandarla.
 */
export const consultarOperacion = (idOperacion) =>
  resolver({
    mock: () => handlers.sincronizacion.operacion(idOperacion),
    real: () => api.get(ENDPOINTS.sincronizacion.operacion(idOperacion)),
    forzarReal: adminContraApiReal,
  })

/**
 * Por qué el servidor rechaza una OPERACIÓN, con su texto.
 *
 * Son los motivos comunes a todos los módulos: los cuatro valen igual en
 * Asistencias que en Lectura, Rúbrica o Registro de Vuelo, así que viven aquí
 * y cada módulo les suma los suyos.
 *
 * Dos de ellos merecen una explicación, porque no son errores del docente:
 *
 *   · `realizado_en_futuro` — el reloj del dispositivo iba adelantado cuando
 *     se capturó el dato. Se nombra como lo que es, un desajuste de hora, y no
 *     como un dato inválido: lo que se escribió estaba bien.
 *   · `operacion_ajena` — ese `id_operacion` ya se usó, y en otra cuenta. No
 *     se reintenta: volver a mandarlo daría lo mismo.
 *
 * El texto bueno es el `detail` del servidor; estos son el respaldo.
 */
/**
 * `POST /sincronizacion/operaciones/{id}/descartar` — solo Docente, sin cuerpo.
 *
 * Es la otra mitad de "Cargar versión actual": la operación rechazada pasa a
 * `descartada` y deja de contar como error en la actividad y en Seguimiento.
 * 404 `operacion_no_encontrada`, 409 `operacion_no_rechazada`.
 */
export const descartarOperacion = (idOperacion) =>
  resolver({
    mock: () => handlers.sincronizacion.descartar(idOperacion),
    real: () => api.post(ENDPOINTS.sincronizacion.descartar(idOperacion)),
    forzarReal: adminContraApiReal,
  })

export const MOTIVO_OPERACION = {
  fuera_de_actividad: 'La operación se realizó fuera de una actividad de trabajo del docente.',
  actividad_requerida: 'Inicia una actividad de trabajo para registrar información.',
  realizado_en_futuro:
    'La hora del dispositivo iba adelantada cuando se registró el dato. Comprueba la fecha y la hora del equipo.',
  operacion_ajena: 'El identificador de la operación ya fue usado.',
}

/**
 * El texto de un `ResultadoOperacion` rechazado.
 *
 * @param extra motivos propios del módulo, que pesan igual que los comunes.
 */
export const textoDeRechazo = (resultado, extra = {}) =>
  resultado?.detail ?? extra[resultado?.motivo] ?? MOTIVO_OPERACION[resultado?.motivo] ?? null
