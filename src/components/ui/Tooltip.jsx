import { cloneElement, isValidElement, useId, useState } from 'react'
import cn from '../../lib/cn'

/**
 * Tooltip accesible por hover, por foco Y POR TOQUE.
 *
 * Se usa para los descriptores oficiales de la rúbrica (P5), para explicar
 * qué mide cada gráfico (P12) y para los íconos de información que CU015 pide
 * consultables "mediante clic o toque". En un móvil no hay hover: sin el clic,
 * ese texto simplemente no existía para la mitad de los dispositivos.
 */
export default function Tooltip({ content, side = 'top', className, children }) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  if (!content) return children

  /*
   * El clic (o el toque) y Escape van EN EL HIJO, que es el control: un botón
   * de información, que ya recibe el foco y el teclado. Así el envoltorio no
   * se hace pasar por un segundo control. Escape lo cierra, como pide el
   * patrón de tooltip de WAI-ARIA.
   */
  const disparador = isValidElement(children)
    ? cloneElement(children, {
        onClick: (evento) => {
          children.props.onClick?.(evento)
          setVisible((previo) => !previo)
        },
        onKeyDown: (evento) => {
          children.props.onKeyDown?.(evento)
          if (evento.key === 'Escape') setVisible(false)
        },
      })
    : children

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined}>{disparador}</span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-40 w-64 rounded-lg bg-navy-900 px-3 py-2 text-xs font-medium leading-relaxed text-white shadow-card animate-fade-in',
            side === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
            side === 'bottom' && 'top-full left-1/2 mt-2 -translate-x-1/2',
            side === 'left' && 'right-full top-1/2 mr-2 -translate-y-1/2',
            side === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          )}
        >
          {content}
        </span>
      )}
    </span>
  )
}
