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
