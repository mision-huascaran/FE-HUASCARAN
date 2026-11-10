import cn from '../../lib/cn'
import IconoTinte from './IconoTinte'
import TrendIndicator from './TrendIndicator'

export default function StatCard({ icon, tono = 'azul', label, value, unit, hint, trend, className }) {
  return (
    <div className={cn('sicedu-tarjeta sicedu-elevable rounded-xl border border-line/80 bg-surface-0 p-4 shadow-card sm:p-5', className)}>
      <div className="flex items-center gap-3 sm:gap-4">
        {icon && <IconoTinte icon={icon} tono={tono} tamano="lg" />}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-ink-500">{label}</p>
          <p className="mt-1 font-display text-[26px] font-bold leading-none tabular-nums text-ink-900 sm:text-[28px]">
            {value}
            {unit && <span className="ml-1 text-base font-semibold text-ink-500">{unit}</span>}
          </p>
        </div>
      </div>
      {(hint || trend) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {trend && <TrendIndicator dir={trend.dir} label={trend.label} value={trend.value} />}
          {hint && <span className="text-xs text-ink-500">{hint}</span>}
        </div>
      )}
    </div>
  )
}
