// Asistencia por fecha (CU022).
//
// TODO BACKEND: los endpoints NO EXISTEN todavía. El caso de uso aún no está
// cerrado, así que esto es una demo funcional resuelta contra el simulador: la
// pantalla, las reglas y el comportamiento offline son los definitivos, y lo
// único que habrá que cambiar cuando el backend publique las rutas es la rama
// `real` de estas tres funciones.
//
// Lo que hará falta pedirle al backend, tal como lo describe CU022:
//
//   GET  /asistencia/clase?id_colegio&id_grado&seccion&id_programa&fecha
//        → { dia_lectivo, alumnos: [{ id_alumno, nombres, apellidos, seccion,
//            activo, presente }], servidor_ahora }
//        `presente` es null mientras nadie haya marcado: "sin marcar" y
//        "ausente" no son lo mismo.
//        En una fecha pasada la lista incluye también a los alumnos INACTIVOS
//        que ya tengan registro ese día.
//   POST /asistencia/marcas  { id_alumno, fecha, id_programa, presente }
//        Un micro-paquete por interacción. Único por alumno, fecha y
//        subprograma; ante escrituras simultáneas gana la más reciente.
//   GET  /asistencia/secciones?id_colegio&id_grado → ["A", "B"]
//
// `servidor_ahora` es importante: recalibra el reloj del cliente (ver
// `lib/relojServidor.js`). CU022 prohíbe fiarse de la hora del dispositivo.
import { resolver } from '../client'
import handlers from '../mock/handlers'
import { sincronizarReloj } from '../../lib/relojServidor'

export const listarSeccionesDe = ({ idColegio, idGrado }) =>
  resolver({
    mock: () => handlers.asistencia.secciones({ idColegio, idGrado }),
    real: () => handlers.asistencia.secciones({ idColegio, idGrado }),
  })

export async function obtenerClase({ idColegio, idGrado, seccion, idPrograma, fecha }) {
  const datos = await resolver({
    mock: () => handlers.asistencia.clase({ idColegio, idGrado, seccion, idPrograma, fecha }),
    real: () => handlers.asistencia.clase({ idColegio, idGrado, seccion, idPrograma, fecha }),
  })
  sincronizarReloj(datos?.servidor_ahora)
  return datos
}

/** Un micro-paquete del Auto-save: el estado de UN alumno. */
export const marcarAsistencia = (paquete) =>
  resolver({
    mock: () => handlers.asistencia.marcar(paquete),
    real: () => handlers.asistencia.marcar(paquete),
  })
