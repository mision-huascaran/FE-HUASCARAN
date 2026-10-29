// Consultas de catálogo con TanStack Query. Cambian poquísimo, así que se
// cachean por toda la sesión y no se vuelven a pedir al cambiar de pantalla.
import { useQuery } from '@tanstack/react-query'
import {
  obtenerNivelesRazkids,
  obtenerNivelesRubrica,
} from '../api/resources/catalogos'
import {
  listarColegiosAdmin,
  listarGradosAdmin,
  listarProgramasAdmin,
} from '../api/resources/administracion'

const OPCIONES_CATALOGO = { staleTime: Infinity, gcTime: Infinity }

const useCatalogo = (clave, fn, opciones) =>
  useQuery({ queryKey: clave, queryFn: fn, ...OPCIONES_CATALOGO, ...opciones })

export const useNivelesRazkids = () => useCatalogo(['catalogo', 'niveles-razkids'], obtenerNivelesRazkids)

// ── Catálogos de administración, del backend ─────────────────────────────────
//
// `habilitado` en false para quien no puede pedirlos: `GET /colegios` es de
// administración y un Docente solo recibiría un 403.
export const useColegiosReales = (habilitado = true) =>
  useCatalogo(['catalogo', 'real', 'colegios'], async () => (await listarColegiosAdmin({ estado: 'activo' })).items, {
    enabled: habilitado,
  })

// `opciones` admite `{ enabled: false }` por el mismo motivo que los colegios:
// `/grados` y `/programas` son de administración, y al Directivo —que no tiene
// la sección— le responderían 403.
export const useGradosReales = (opciones) => useCatalogo(['catalogo', 'real', 'grados'], listarGradosAdmin, opciones)

export const useProgramasReales = (opciones) =>
  useCatalogo(['catalogo', 'real', 'programas'], listarProgramasAdmin, opciones)

/**
 * Niveles de rúbrica (P5). Con `idPrograma` trae los de ese programa; sin él,
 * el catálogo completo, que es lo que necesita una grilla donde conviven
 * alumnos de Alfabetización y de Comprensión Lectora. En los dos casos las
 * opciones vienen del backend: nunca se escriben en el código (RN-011).
 */
export const useNivelesRubrica = (idPrograma) =>
  useCatalogo(['catalogo', 'niveles-rubrica', idPrograma ?? 'todos'], () => obtenerNivelesRubrica(idPrograma))

/** Agrupa el catálogo por programa y dimensión: `opciones[id_programa][dimension]`. */
export function agruparNivelesRubrica(niveles = []) {
  return niveles.reduce((mapa, nivel) => {
    const porPrograma = mapa[nivel.id_programa] ?? {}
    const porDimension = porPrograma[nivel.dimension] ?? []
    return {
      ...mapa,
      [nivel.id_programa]: { ...porPrograma, [nivel.dimension]: [...porDimension, nivel] },
    }
  }, {})
}
