import { useState } from 'react'
import { Menu } from 'lucide-react'
import BarraActividades from './BarraActividades'
import Breadcrumbs from './Breadcrumbs'
import PanelSincronizacion from './PanelSincronizacion'
import SyncBadge from '../ui/SyncBadge'
import useSyncStore from '../../store/syncStore'

export default function Topbar({ onAbrirMenu }) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const { pendientes, sincronizando, ultimoError } = useSyncStore()
  return (
    <header className="sticky top-0 z-30 flex h-16 print:hidden items-center gap-2 border-b border-line bg-surface-0 px-4 sm:gap-3 sm:px-6">
      {/*
        EL BOTÓN DE MENÚ SOLO EN TABLETA.
        
        En el teléfono la navegación vive abajo (`BarraInferior`), con su propia
        ranura "Más" que abre este mismo cajón. Dejarlo aquí además era ofrecer
        dos puertas a lo mismo, y encima en la esquina a la que no llega el
        pulgar: la barra de arriba se quedaba con cuatro controles y las migas
        de pan se recortaban a "S..".
        
        De `sm` a `lg` sí se queda: ahí hay sitio de sobra y la barra inferior
        también está, pero el cajón es más cómodo con la pantalla grande.
      */}
      <button
        type="button"
        onClick={onAbrirMenu}
        aria-label="Abrir menú"
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-700 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Breadcrumbs className="min-w-0 flex-1" />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <BarraActividades />
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
