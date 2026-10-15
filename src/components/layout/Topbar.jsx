import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import BarraActividades from './BarraActividades'
import Breadcrumbs from './Breadcrumbs'
import PanelSincronizacion from './PanelSincronizacion'
import Select from '../ui/Select'
import SyncBadge from '../ui/SyncBadge'
import useFiltrosStore from '../../store/filtrosStore'
import useSyncStore from '../../store/syncStore'
import { usePeriodos } from '../../hooks/useCatalogos'

/**
 * Las rutas que de verdad LEEN el periodo del selector.
 *
 * El selector salía en la barra superior de toda la aplicación, también en
 * Usuarios, Alumnos y Colegios, donde cambiarlo no hacía absolutamente nada:
 * un control que promete filtrar y no filtra. No se borra del todo porque sí
 * manda en las pantallas de consulta del Supervisor y el Directivo; se esconde
 * donde no pinta nada.
 *
 * Los prefijos cubren las rutas con detalle (`/ranking/3`, `/estudiantes/12`).
 */
const RUTAS_CON_PERIODO = [
  '/inicio',
  '/ranking',
  '/estudiantes',
  '/consulta-colegios',
  '/consolidados',
  '/nivel-final',
  '/panel-ejecutivo',
  '/reportes',
  '/dashboard',
  '/rubrica',
  '/seguimiento-lectura',
]

const usaElPeriodo = (ruta) => RUTAS_CON_PERIODO.some((base) => ruta === base || ruta.startsWith(`${base}/`))

/** Selector del periodo de evaluación vigente (P2). */
function SelectorPeriodo() {
  const { data: periodos = [] } = usePeriodos()
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const setPeriodo = useFiltrosStore((s) => s.setPeriodo)
  const fijarPeriodoPorDefecto = useFiltrosStore((s) => s.fijarPeriodoPorDefecto)
  const { pathname } = useLocation()

  // Por defecto, el periodo abierto (RN-010). Se fija SIEMPRE, también donde el
  // selector no se ve: las pantallas que lo leen cuentan con que ya tenga valor.
  useEffect(() => {
    const vigente = periodos.find((p) => p.estado === 'abierto') ?? periodos.at(-1)
    if (vigente) fijarPeriodoPorDefecto(vigente.id_periodo)
  }, [periodos, fijarPeriodoPorDefecto])

  if (periodos.length === 0 || !usaElPeriodo(pathname)) return null

  return (
    <Select
      aria-label="Periodo de evaluación vigente"
      value={idPeriodo ?? ''}
      onChange={(e) => setPeriodo(e.target.value)}
      className="w-32 sm:w-44"
      options={periodos.map((p) => ({
        value: p.id_periodo,
        label: `${p.nombre} ${p.anio}${p.estado === 'abierto' ? ' · vigente' : ''}`,
      }))}
    />
  )
}

export default function Topbar({ onAbrirMenu }) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const { pendientes, sincronizando, ultimoError } = useSyncStore()
  return (
    <header className="sticky top-0 z-30 flex h-16 print:hidden items-center gap-2 border-b border-line bg-surface-0 px-4 sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menú"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-700 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Breadcrumbs className="flex-1" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <BarraActividades />
        <SelectorPeriodo />
        <SyncBadge
          pendientes={pendientes}
          sincronizando={sincronizando}
          error={Boolean(ultimoError)}
          onClick={() => setPanelAbierto(true)}
        />
      </div>

      <PanelSincronizacion abierto={panelAbierto} onCerrar={() => setPanelAbierto(false)} />
    </header>
  )
}
