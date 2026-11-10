import { useState } from 'react'
import { Menu } from 'lucide-react'
import BarraActividades from './BarraActividades'
import Breadcrumbs from './Breadcrumbs'
import PanelSincronizacion from './PanelSincronizacion'
import BotonTema from '../ui/BotonTema'
import SyncBadge from '../ui/SyncBadge'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import { navegacionDe, RANURAS_BARRA_INFERIOR } from './navegacion'

export default function Topbar({ onAbrirMenu }) {
  const [panelAbierto, setPanelAbierto] = useState(false)
  const { pendientes, sincronizando, ultimoError } = useSyncStore()
  const idRol = useSessionStore((s) => s.usuario?.id_rol)
  const hayMenuMas = navegacionDe(idRol).length > RANURAS_BARRA_INFERIOR
  return (
    <header className="sicedu-cristal-barra sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 border-b border-line/70 px-4 pt-[env(safe-area-inset-top)] sm:h-16 sm:gap-3 sm:px-6 lg:rounded-t-panel lg:px-7 print:hidden">
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
        className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-700 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex lg:hidden"
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
        {/* En el teléfono vive en el menú "Más", salvo que el rol no lo tenga:
            aquí le quitaría a las migas el poco sitio que les queda. */}
        <BotonTema className={hayMenuMas ? 'hidden sm:flex' : undefined} />
      </div>

      <PanelSincronizacion abierto={panelAbierto} onCerrar={() => setPanelAbierto(false)} />
    </header>
  )
}
