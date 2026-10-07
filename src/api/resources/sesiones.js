// Sesiones de actividades (CU023 Docente, CU025 Supervisor).
//
// TODO BACKEND: los endpoints no existen todavía (T12 del sprint). Se resuelve
// con el mock para poder construir y probar la pantalla; ver "Lo que falta del
// backend" en APIS_BACKEND.md.
import { resolver } from '../client'
import handlers from '../mock/handlers'

export const listarSesiones = ({ todas = false, idDocente, idColegio, fecha } = {}) =>
  resolver({
    mock: () => handlers.sesiones.listar({ todas, idDocente, idColegio, fecha }),
    real: () => handlers.sesiones.listar({ todas, idDocente, idColegio, fecha }),
  })

export const detalleSesion = (id) =>
  resolver({
    mock: () => handlers.sesiones.detalle(id),
    real: () => handlers.sesiones.detalle(id),
  })
