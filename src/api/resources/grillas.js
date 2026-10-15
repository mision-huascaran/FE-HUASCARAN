// Creación de las grillas semanales de Rúbrica y Seguimiento de Lectura (T32).
//
// Una grilla no existe hasta que alguien la crea: el sistema NO la genera sola
// ni copia la de la semana anterior. Es deliberado — copiar daría por evaluado
// a un alumno que nadie miró esa semana.
//
// TODO BACKEND: no existen estos endpoints. Ver APIS_BACKEND.md.
import { resolver } from '../client'
import handlers from '../mock/handlers'

export const existeGrillaSemanal = ({ tipo, idSemana, idColegio, idGrado, idSeccion }) =>
  resolver({
    mock: () => handlers.grillas.existe({ tipo, idSemana, idColegio, idGrado, idSeccion }),
    real: () => handlers.grillas.existe({ tipo, idSemana, idColegio, idGrado, idSeccion }),
  })

export const crearGrillaSemanal = ({ tipo, idSemana, idColegio, idGrado, idSeccion }) =>
  resolver({
    mock: () => handlers.grillas.crear({ tipo, idSemana, idColegio, idGrado, idSeccion }),
    real: () => handlers.grillas.crear({ tipo, idSemana, idColegio, idGrado, idSeccion }),
  })

/** Qué alumnos faltaron ese día, según el módulo Asistencia (T32). */
export const ausentesDe = ({ idColegio, idGrado, idSemana }) =>
  resolver({
    mock: () => handlers.grillas.ausentes({ idColegio, idGrado, idSemana }),
    real: () => handlers.grillas.ausentes({ idColegio, idGrado, idSemana }),
  })
