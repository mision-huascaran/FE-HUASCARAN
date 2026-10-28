// Catálogos del sistema. Ninguno se hardcodea en la interfaz (RN-011, RN-012).
import { adminContraApiReal, api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { catalogos } = ENDPOINTS

/**
 * `GET /niveles-razkids` — la escala aa–Z (27 niveles, sin Z1 ni Z2 desde T9).
 *
 * Va contra la API real: Registro de Vuelo guarda `id_nivel_colocado` con
 * estos ids, y uno del simulador no existiría en el servidor. El backend manda
 * `{id, letra}`; las pantallas leen `id_nivel_razkids` y `orden`, así que se
 * normaliza aquí, en un solo sitio (el orden es el de la lista: aa primero).
 */
export const obtenerNivelesRazkids = async () => {
  const niveles = await resolver({
    mock: () => handlers.catalogos.nivelesRazkids(),
    real: () => api.get(catalogos.nivelesRazkids),
    forzarReal: adminContraApiReal,
  })
  return (niveles ?? []).map((n, i) => ({
    ...n,
    id: n.id ?? n.id_nivel_razkids,
    id_nivel_razkids: n.id_nivel_razkids ?? n.id,
    orden: n.orden ?? i + 1,
  }))
}

/**
 * `GET /niveles-rubrica?id_programa=` — códigos 0-4 con sus nombres (P4 §3).
 * Sin programa, el catálogo completo (es lo que baja la precarga offline).
 */
export const obtenerNivelesRubrica = (idPrograma) =>
  resolver({
    mock: () => handlers.catalogos.nivelesRubrica({ programa: idPrograma }),
    real: () =>
      api.get(catalogos.nivelesRubrica, { params: idPrograma ? { id_programa: Number(idPrograma) } : {} }),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /semanas` — YA NO ES UN CATÁLOGO, pese a seguir donde estaba.
 *
 * Desde la tanda 7 los cinco filtros son obligatorios y devuelve solo las
 * semanas del año con ALGUNA CLASE de ese grupo en ese mes. Es un cambio de
 * fondo, no de firma: una semana sin clase no tiene tabla de lectura ni
 * obligación de registrarla, así que ofrecerla en el desplegable era mandar al
 * docente a una pantalla donde solo podía encontrarse un 422.
 *
 * Y ya no acepta `id_periodo_academico`: la semana cubre el año escolar
 * completo, de lunes a viernes, sin depender de los periodos.
 *
 * `id_programa` es OPCIONAL y conviene mandarlo (tanda B): acota las semanas a
 * las que tienen clase de ESE subprograma. Sin él, un grupo con clases de
 * Alfabetización y de Comprensión Lectora ofrece semanas que, para el
 * subprograma elegido, no tienen nada que registrar.
 */
export const obtenerSemanas = ({ idAnioEscolar, mes, idColegio, idGrado, idSeccion, idPrograma } = {}) =>
  resolver({
    mock: () => handlers.catalogos.semanas({ idAnioEscolar, mes, idColegio, idGrado, idSeccion, idPrograma }),
    real: () =>
      api.get(catalogos.semanas, {
        params: {
          id_anio_escolar: Number(idAnioEscolar),
          mes: Number(mes),
          id_colegio: Number(idColegio),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
          ...(idPrograma ? { id_programa: Number(idPrograma) } : {}),
        },
      }),
    // Las semanas deciden qué tabla de Lectura se pide al backend real: si
    // salieran del simulador, sus ids no serían los del servidor.
    forzarReal: adminContraApiReal,
  })
