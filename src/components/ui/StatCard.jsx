import cn from '../../lib/cn'
import IconoTinte from './IconoTinte'
import TrendIndicator from './TrendIndicator'

/** Color del número: el de texto, salvo que pida atención. */
function colorDelValor(tono) {
  if (tono === 'peligro') return 'text-danger-600'
  if (tono === 'aviso') return 'text-warning-600'
  return 'text-ink-900'
}

/**
 * Tarjeta de indicador.
 *
 * `sobria` es la de Inicio: icono gris sin cuadro de color, etiqueta en formato
 * oración y borde en vez de sombra. `tonoValor` ('peligro' | 'aviso') colorea
 * el número solo cuando hay algo que atender; si no, va en el color de texto.
 */
export default function StatCard({ icon: Icono, tono = 'azul', label, value, unit, hint, trend, sobria = false, tonoValor, className }) {
  return (
    <div
      className={cn(
        'sicedu-stat sicedu-tarjeta rounded-xl border bg-surface-0 p-4 sm:p-5',
        sobria ? 'flex flex-col border-line' : 'sicedu-elevable border-line/80 shadow-card',
        className,
      )}
    >
      {/* N008 — En `sobria` el número va al pie de la fila: si una etiqueta ocupa
          dos líneas ("Colegios registrados") y la de al lado una, las cifras
          de una misma fila de tarjetas quedaban a distinta altura. */}
      <div className={cn('sicedu-stat-fila flex gap-3.5', sobria ? 'flex-1 items-start' : 'items-center')}>
        {Icono && !sobria && <IconoTinte icon={Icono} tono={tono} tamano="lg" />}
        {Icono && sobria && <Icono className="h-6 w-6 shrink-0 text-ink-500" aria-hidden="true" strokeWidth={1.8} />}
        <div className={cn('min-w-0', sobria && 'flex flex-1 flex-col self-stretch')}>
          <p
            className={
              sobria
                ? 'text-sm font-medium leading-tight text-ink-700'
                : 'text-[11px] font-semibold uppercase leading-tight tracking-wide text-ink-500'
            }
          >
            {label}
          </p>
          <p
            className={cn(
              'font-display text-[26px] font-bold leading-none tabular-nums sm:text-[28px]',
              sobria ? 'mt-auto pt-1.5' : 'mt-1',
              colorDelValor(tonoValor),
            )}
          >
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
