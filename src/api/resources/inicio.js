// Resúmenes del Módulo de Inicio (CU010, CU011, CU012).
//
// TODO BACKEND: no existe el endpoint consolidado. El Supervisor necesita
// colegios, docentes activos, docentes con actividad en curso, registros
// pendientes y las Alertas de Inactividad en una sola llamada — con la
// disponibilidad de conexión de RN-017, cuatro peticiones separadas son peor
// que una. Ver APIS_BACKEND.md.
import { resolver } from '../client'
import handlers from '../mock/handlers'

export const obtenerResumenSupervisor = () =>
  resolver({
    mock: () => handlers.inicio.supervisor(),
    real: () => handlers.inicio.supervisor(),
  })

export const obtenerResumenDocente = (idDocente) =>
  resolver({
    mock: () => handlers.inicio.docente(idDocente),
    real: () => handlers.inicio.docente(idDocente),
  })
