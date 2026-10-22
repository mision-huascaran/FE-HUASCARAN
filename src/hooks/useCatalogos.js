// Consultas de catálogo con TanStack Query. Cambian poquísimo, así que se
// cachean por toda la sesión y no se vuelven a pedir al cambiar de pantalla.
import { useQuery } from '@tanstack/react-query'
import {
  obtenerColegios,
  obtenerGrados,
  obtenerNivelesRazkids,
  obtenerNivelesRubrica,
  obtenerPeriodos,
  obtenerProgramas,
} from '../api/resources/catalogos'
import {
  listarColegiosAdmin,
  listarGradosAdmin,
  listarProgramasAdmin,
} from '../api/resources/administracion'

const OPCIONES_CATALOGO = { staleTime: Infinity, gcTime: Infinity }

const useCatalogo = (clave, fn, opciones) =>
  useQuery({ queryKey: clave, queryFn: fn, ...OPCIONES_CATALOGO, ...opciones })

export const useColegios = () => useCatalogo(['catalogo', 'colegios'], obtenerColegios)
export const useGrados = () => useCatalogo(['catalogo', 'grados'], obtenerGrados)
export const useProgramas = () => useCatalogo(['catalogo', 'programas'], obtenerProgramas)
export const useNivelesRazkids = () => useCatalogo(['catalogo', 'niveles-razkids'], obtenerNivelesRazkids)
export const usePeriodos = () => useCatalogo(['catalogo', 'periodos'], obtenerPeriodos)

// ── Los mismos catálogos, pero del backend DE VERDAD ────────────────────────
//
// Los de arriba salen del simulador mientras `VITE_USE_MOCK` esté encendido, y
// eso es a propósito: las pantallas que todavía son mock (Rúbrica, Registro de
// Vuelo, Dashboard) tienen métricas inventadas, y pintarlas bajo nombres de
// colegios reales sería peor que no pintarlas.
//
// Pero Asistencia ya no es mock. Pedía sus colegios al simulador y por eso no
// aparecían los que el Supervisor acababa de crear; peor aún, los ids que sí
// salían eran de otra base, así que `GET /asistencias` nunca iba a encontrar
// esa clase. Estos hooks son los que deben usar las pantallas ya conectadas.
// `habilitado` en false para quien no puede pedirlos: `GET /colegios` es de
// administración y un Docente solo recibiría un 403.
export const useColegiosReales = (habilitado = true) =>
  useCatalogo(['catalogo', 'real', 'colegios'], async () => (await listarColegiosAdmin({ estado: 'activo' })).items, {
    enabled: habilitado,
  })

export const useGradosReales = () => useCatalogo(['catalogo', 'real', 'grados'], listarGradosAdmin)

export const useProgramasReales = () => useCatalogo(['catalogo', 'real', 'programas'], listarProgramasAdmin)

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
