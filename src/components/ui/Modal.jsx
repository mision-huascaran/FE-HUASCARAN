import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import useOnEscape from '../../hooks/useOnEscape'
import cn from '../../lib/cn'
import useBloqueoScroll from '../../hooks/useBloqueoScroll'

/** Modal centrado, cierre por Escape y por clic fuera (§4.5). */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  size = 'max-w-2xl',
  /**
   * ¿Pulsar fuera lo cierra? (D78)
   *
   * Por defecto sí, que es lo habitual y lo que la mayoría de los modales
   * quiere. Los que recogen datos pasan `false`: CU028 lo exige para otorgar
   * y revocar, porque un clic distraído fuera del cuadro no puede tirar un
   * formulario a medio llenar.
   */
  cierreExterior = true,
  children,
}) {
  useOnEscape(open, onClose)

  useBloqueoScroll(open)

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-navy-900/45 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4">
      {cierreExterior && (
        <button
          type="button"
          aria-label="Cerrar"
          tabIndex={-1}
          onClick={onClose}
          className="absolute inset-0 h-full w-full cursor-default"
        />
      )}
      {/*
        `<dialog>` nativo ABIERTO POR ATRIBUTO (no con `showModal()`): mismo rol
        y nombre que el `div role="dialog"` de antes, y se sigue abriendo y
        cerrando igual, con `useOnEscape` y el fondo. Las clases `mx-0`,
        `h-auto` y `text-inherit` anulan los estilos por defecto del navegador
        para `dialog` (margen automático, alto ajustado y color de texto).
      */}
      <dialog
        open
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 mx-0 my-0 h-auto w-full rounded-t-2xl border border-line/70 bg-surface-0 text-inherit shadow-modal animate-modal-in sm:my-8 sm:rounded-2xl',
          size,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line/70 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            {/* Un título con un nombre larguísimo no desborda el modal. */}
            {title && (
              <h2 title={typeof title === 'string' ? title : undefined} className="line-clamp-2 text-lg font-semibold text-ink-900 [overflow-wrap:anywhere]">
                {title}
              </h2>
            )}
            {subtitle && (
              <p title={typeof subtitle === 'string' ? subtitle : undefined} className="mt-0.5 line-clamp-2 text-xs text-ink-500 [overflow-wrap:anywhere]">
                {subtitle}
              </p>
            )}
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
        <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto p-4 sm:max-h-[70vh] sm:p-5">{children}</div>
        {/* El pie lleva fondo propio: sin redondear sus esquinas, el gris pinta
            cuadradas las de la tarjeta y el borde inferior parece faltar. En
            móvil la ventana sube desde abajo a sangre, así que solo se redondea
            desde `sm`, igual que la tarjeta. */}
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line/70 bg-surface-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:px-5 sm:py-4">
            {footer}
          </footer>
        )}
      </dialog>
    </div>,
    document.body,
  )
}
