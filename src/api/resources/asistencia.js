// Asistencia por fecha (T30).
//
// TODO BACKEND: no existen los endpoints. Se resuelve con el mock para poder
// construir la pantalla; ver "Lo que el frontend necesita del backend" en
// APIS_BACKEND.md.
import { resolver } from '../client'
import handlers from '../mock/handlers'

export const obtenerGrillaAsistencia = ({ idColegio, idGrado, idSeccion, fecha }) =>
  resolver({
    mock: () => handlers.asistencia.grilla({ idColegio, idGrado, idSeccion, fecha }),
    real: () => handlers.asistencia.grilla({ idColegio, idGrado, idSeccion, fecha }),
  })

export const crearGrillaAsistencia = ({ idColegio, idGrado, idSeccion, fecha }) =>
  resolver({
    mock: () => handlers.asistencia.crearGrilla({ idColegio, idGrado, idSeccion, fecha }),
    real: () => handlers.asistencia.crearGrilla({ idColegio, idGrado, idSeccion, fecha }),
  })

export const guardarAsistencia = (payload) =>
  resolver({
    mock: () => handlers.asistencia.guardar(payload),
    real: () => handlers.asistencia.guardar(payload),
  })
