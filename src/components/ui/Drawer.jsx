import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useOnEscape from '../../hooks/useOnEscape'
import cn from '../../lib/cn'

/**
 * Panel lateral derecho para editar sin perder la tabla de fondo (§4.5).
 * `side="left"` se usa para el menú en móvil (P2).
 */
export default function Drawer({ open, onClose, title, subtitle, footer, side = 'right', width = 'max-w-md', children }) {
  useOnEscape(open, onClose)

  useEffect(() => {
    if (!open) return undefined
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previo
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 bg-navy-900/45 backdrop-blur-sm animate-fade-in">
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      {/*
        `<dialog>` nativo ABIERTO POR ATRIBUTO (no con `showModal()`): mismo rol
        y nombre que el `aside role="dialog"` de antes, y se sigue abriendo y
        cerrando igual. `m-0`, `h-auto`, `text-inherit` y el lado contrario en
        `auto` anulan los estilos por defecto del navegador para `dialog`
        (margen automático, alto ajustado, color y `inset-inline: 0`).
      */}
      <dialog
        open
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute inset-y-0 m-0 flex h-auto w-full flex-col border-l border-line/70 bg-surface-0 text-inherit shadow-drawer animate-slide-in-right sm:rounded-l-2xl',
          side === 'right' ? 'left-auto right-0' : 'left-0 right-auto',
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line/70 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
          <div className="min-w-0">
            {title && <h2 className="truncate text-base font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-400 sm:h-8 sm:w-8 transition-colors hover:bg-surface-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/70 bg-surface-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-bl-2xl sm:px-5 sm:py-4">
            {footer}
          </footer>
        )}
      </dialog>
    </div>,
    document.body,
  )
}
