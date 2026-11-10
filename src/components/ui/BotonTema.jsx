import { Monitor, Moon, Sun } from 'lucide-react'
import useTema from '../../hooks/useTema'
import cn from '../../lib/cn'

const ASPECTO = {
  claro: { Icono: Sun, nombre: 'Claro' },
  oscuro: { Icono: Moon, nombre: 'Oscuro' },
  sistema: { Icono: Monitor, nombre: 'Según el sistema' },
}

/**
 * Cambia entre claro, oscuro y el del sistema.
 *
 * `fila` es la versión con texto para el menú lateral, sobre fondo navy; sin
 * ella es el botón redondo de la barra superior.
 */
export default function BotonTema({ fila = false, className }) {
  const { preferencia, siguiente, alternar } = useTema()
  const { Icono, nombre } = ASPECTO[preferencia]
  const etiqueta = `Tema: ${nombre.toLowerCase()}. Cambiar a ${ASPECTO[siguiente].nombre.toLowerCase()}`

  if (fila) {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-label={etiqueta}
        className={cn(
          'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-0',
          className,
        )}
      >
        <Icono className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Tema</span>
        <span className="text-xs text-white/60">{nombre}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-0/70 text-ink-500 transition-colors hover:bg-surface-0 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        className,
      )}
    >
      <Icono className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  )
}
