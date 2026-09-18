import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import useFiltrosStore, { FILTROS_DASHBOARD_VACIOS } from '../../store/filtrosStore'

const CLAVES = Object.keys(FILTROS_DASHBOARD_VACIOS)

/**
 * Filtros del dashboard (P12): viven en zustand y se reflejan en la URL como
 * query params (`?programa=1&colegio=3`), para que una vista filtrada se pueda
 * compartir con un enlace.
 *
 * La URL manda. Si se entra sin parámetros, se restauran los últimos filtros
 * usados en la sesión, que el almacén conserva al navegar a otra pantalla.
 *
 * RN-019: en la URL solo viajan ids de catálogo y el texto de búsqueda que el
 * propio usuario escribió; nunca datos de un estudiante.
 */
export default function useFiltrosDashboard() {
  const [params, setParams] = useSearchParams()
  const guardados = useFiltrosStore((s) => s.dashboard)
  const setFiltrosDashboard = useFiltrosStore((s) => s.setFiltrosDashboard)
  const limpiarFiltrosDashboard = useFiltrosStore((s) => s.limpiarFiltrosDashboard)
  const idPeriodoVigente = useFiltrosStore((s) => s.idPeriodo)

  const desdeUrl = useMemo(
    () => Object.fromEntries(CLAVES.map((clave) => [clave, params.get(clave) ?? ''])),
    [params],
  )
  const urlVacia = CLAVES.every((clave) => !desdeUrl[clave])

  // Al entrar sin parámetros, se recuperan los filtros de la sesión.
  useEffect(() => {
    const hayGuardados = CLAVES.some((clave) => guardados[clave])
    if (urlVacia && hayGuardados) setParams(aParams(guardados), { replace: true })
    // Solo al montar: después, la URL es la fuente de verdad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cada cambio de la URL queda guardado para la próxima visita.
  useEffect(() => {
    if (!urlVacia) setFiltrosDashboard(desdeUrl)
  }, [desdeUrl, urlVacia, setFiltrosDashboard])

  const filtros = { ...desdeUrl, periodo: desdeUrl.periodo || (idPeriodoVigente ? String(idPeriodoVigente) : '') }

  function cambiar(parcial) {
    setParams(aParams({ ...desdeUrl, ...parcial }), { replace: true })
  }

  function limpiar() {
    limpiarFiltrosDashboard()
    setParams(new URLSearchParams(), { replace: true })
  }

  return {
    filtros,
    cambiar,
    limpiar,
    activos: CLAVES.filter((clave) => clave !== 'periodo' && desdeUrl[clave]).length,
  }
}

function aParams(valores) {
  const params = new URLSearchParams()
  CLAVES.forEach((clave) => {
    if (valores[clave]) params.set(clave, String(valores[clave]))
  })
  return params
}
