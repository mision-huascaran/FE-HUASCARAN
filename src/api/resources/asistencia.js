// Asistencia por clase (CU022). YA NO ES UNA DEMO: el backend la publica.
//
// Una CLASE es la combinación de fecha + colegio + grado + subprograma. La
// sección NO entra: es un atributo del colegio ("Única") que el alumno hereda,
// así que `GET /asistencias` no la recibe y el filtro de la pantalla solo sirve
// para que el docente se ubique.
//
// Dos cosas que cambiaron respecto de lo que teníamos:
//
//   · TRES estados, no dos: `presente | tardanza | ausente`, más `null` para
//     "sin marcar". Y `null` NO se acepta al escribir: una marca puesta no se
//     puede quitar, solo cambiar.
//   · El guardado es un PUT con VARIOS registros. El autoguardado manda uno,
//     pero "Marcar todos como presentes" los manda juntos, y el mismo endpoint
//     sirve para la observación.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/** Los tres estados del Segmented Control, en el orden en que se pintan. */
export const ESTADOS_ASISTENCIA = ['presente', 'tardanza', 'ausente']

/**
 * Las secciones (aulas) de un colegio y grado.
 *
 * NO es un endpoint: el backend no modela las secciones y `GET /asistencias`
 * no las recibe. La sección es un atributo del colegio ("Única") que el alumno
 * hereda, y el filtro existe solo porque CU022 lo pide para ubicarse. Se sacan
 * de los alumnos que hay.
 */
export const listarSeccionesDe = ({ idColegio, idGrado }) =>
  resolver({
    mock: () => handlers.asistencia.secciones({ idColegio, idGrado }),
    real: () => handlers.asistencia.secciones({ idColegio, idGrado }),
  })

/**
 * `GET /asistencias` — la clase de una fecha.
 *
 * Devuelve `{fecha, editable, alumnos}`. `editable` lo decide el SERVIDOR: es
 * `true` solo si quien pregunta es Docente y la fecha es un día lectivo del
 * periodo vigente. El Supervisor siempre lo recibe en `false`, y así se entera
 * la pantalla de que va en solo lectura sin tener que razonarlo por su cuenta.
 *
 * Cada alumno trae `activo` y `en_aula`: el primero marca a los dados de baja
 * que ya constaban ese día, y el segundo a los que rotaron de aula después.
 * Los dos se muestran igual, señalados.
 */
export const obtenerClase = ({ idColegio, idGrado, idPrograma, fecha }) =>
  resolver({
    mock: () => handlers.asistencia.clase({ idColegio, idGrado, idPrograma, fecha }),
    real: () =>
      api.get(ENDPOINTS.asistencia.listar, {
        params: {
          id_colegio: Number(idColegio),
          id_grado: Number(idGrado),
          id_programa: Number(idPrograma),
          fecha,
        },
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PUT /asistencias` — guarda uno o varios registros de la misma fecha.
 *
 * Un registro lleva `estado`, `observacion` o ambos; lo que se omite no se
 * toca. `fecha_registro` es el momento REAL del clic, con zona: sin ella el
 * servidor usa la suya, y un envío que estuvo una hora en la cola offline se
 * registraría con la hora de la sincronización en vez de la del aula.
 *
 * La respuesta trae `aplicado` por registro. En `false` significa que OTRO
 * dispositivo guardó algo más reciente para ese alumno: gana el suyo, y la
 * pantalla tiene que repintarse con el `estado` y la `observacion` que vuelven.
 */
export const guardarAsistencia = ({ fecha, registros, fechaRegistro }) =>
  resolver({
    mock: () => handlers.asistencia.guardar({ fecha, registros, fecha_registro: fechaRegistro }),
    real: () =>
      api.put(ENDPOINTS.asistencia.guardar, {
        fecha,
        registros,
        ...(fechaRegistro ? { fecha_registro: fechaRegistro } : {}),
      }),
    forzarReal: adminContraApiReal,
  })
