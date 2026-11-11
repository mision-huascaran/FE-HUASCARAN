import cn from '../../lib/cn'
import IconoTinte from './IconoTinte'

export default function Card({ title, subtitle, actions, icon, tono = 'azul', padded = true, className, bodyClassName, children }) {
  const tieneCabecera = title || subtitle || actions

  return (
    <section className={cn('sicedu-tarjeta rounded-xl border border-line/80 bg-surface-0 shadow-card', className)}>
      {tieneCabecera && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/70 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <IconoTinte icon={icon} tono={tono} tamano="sm" />}
            <div className="min-w-0">
              {title && <h3 className="text-[15px] font-semibold leading-snug text-ink-900">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
            </div>
          </div>
          {/* En el teléfono las acciones toman su propia fila: sin esto, un botón
              ancho no podía encogerse y empujaba la página de lado (FE-07). */}
          {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
