// Catálogos del sistema. Ninguno se hardcodea en la interfaz (RN-011, RN-012).
import { adminContraApiReal, api, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { catalogos } = ENDPOINTS

/*
 * Estos catálogos alimentan el dashboard, los filtros y las pantallas de
 * captura, que siguen resolviéndose contra el mock: si aquí llegaran los
 * colegios reales, el dashboard pintaría nombres reales sobre métricas del
 * mock. Administración pide los suyos aparte (resources/administracion.js),
 * porque allí los ids tienen que ser los del backend de verdad.
 */
export const obtenerColegios = () =>
  resolver({ mock: () => handlers.catalogos.colegios(), real: () => api.get(catalogos.colegios) })

export const obtenerGrados = () =>
  resolver({ mock: () => handlers.catalogos.grados(), real: () => api.get(catalogos.grados) })

export const obtenerProgramas = () =>
  resolver({ mock: () => handlers.catalogos.programas(), real: () => api.get(catalogos.programas) })

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

/** Los niveles de rúbrica dependen del programa del alumno (P5, RN-011). */
export const obtenerNivelesRubrica = (programa) =>
  resolver({
    mock: () => handlers.catalogos.nivelesRubrica({ programa }),
    real: () => api.get(catalogos.nivelesRubrica, { params: { programa } }),
  })

export const obtenerNivelGeneral = () =>
  resolver({ mock: () => handlers.catalogos.nivelGeneral(), real: () => api.get(catalogos.nivelGeneral) })

export const obtenerEsperadoPorGrado = () =>
  resolver({ mock: () => handlers.catalogos.esperadoPorGrado(), real: () => api.get(catalogos.esperadoPorGrado) })

export const obtenerPeriodos = () =>
  resolver({ mock: () => handlers.catalogos.periodos(), real: () => api.get(catalogos.periodos) })

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
 */
export const obtenerSemanas = ({ idAnioEscolar, mes, idColegio, idGrado, idSeccion } = {}) =>
  resolver({
    mock: () => handlers.catalogos.semanas({ idAnioEscolar, mes, idColegio, idGrado, idSeccion }),
    real: () =>
      api.get(catalogos.semanas, {
        params: {
          id_anio_escolar: Number(idAnioEscolar),
          mes: Number(mes),
          id_colegio: Number(idColegio),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
        },
      }),
    // Las semanas deciden qué tabla de Lectura se pide al backend real: si
    // salieran del simulador, sus ids no serían los del servidor.
    forzarReal: adminContraApiReal,
  })
