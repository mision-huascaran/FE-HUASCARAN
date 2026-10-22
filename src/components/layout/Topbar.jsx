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
 * Las rutas donde el selector de periodo SE VE.
 *
 * Son las pantallas de consulta, que es donde comparar dos cortes tiene
 * sentido. En el resto se esconde, y cada una por su motivo:
 *
 *   · Inicio, Rúbrica y Seguimiento de Lectura son el trabajo del día. Van
 *     siempre contra el periodo abierto (RN-010), así que el selector promete
 *     una elección que no cambia nada de lo que se ve.
 *   · Dashboard y Registro de Vuelo YA TIENEN su propio periodo, dentro de la
 *     pantalla. Dos selectores para lo mismo, y encima uno arriba y otro
 *     abajo, es una invitación a dejarlos descuadrados.
 *
 * Esconderlo no deja el periodo sin valor: el efecto de abajo lo fija igual en
 * todas las rutas, también donde el control no se pinta.
 *
 * Los prefijos cubren las rutas con detalle (`/consulta-colegios/3`).
 */
const RUTAS_CON_PERIODO = ['/consulta-colegios']

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
