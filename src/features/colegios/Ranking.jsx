// Cubre: RF-008, RF-009 (NICE TO HAVE)
import { Medal } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'
import { formatoPct } from '../../components/charts/tema'
import cn from '../../lib/cn'

/**
 * Ranking con podio para los tres primeros y lista ordenada con barra de
 * progreso (P13). Sirve igual para colegios (RF-009) que para aulas (RF-008):
 * cada fila solo necesita `nombre`, `pct_logro`, `cobertura` y `posicion`.
 *
 * Los que no tienen evaluaciones en el corte no se rankean: van al final con
 * "Sin datos", porque un 0 % los dejaría como "los peores" cuando en realidad
 * todavía no cargaron información.
 */
const MEDALLA = {
  1: 'bg-warning-100 text-warning-600 border-warning-600/30',
  2: 'bg-surface-100 text-ink-700 border-line-strong',
  3: 'bg-danger-100 text-danger-600 border-danger-600/20',
}

export default function Ranking({ filas = [], conPodio = true, unidad = 'colegio' }) {
  if (!filas.length) return <EmptyState title="Sin datos" description={`No hay ${unidad}s con evaluaciones en este corte.`} />

  const conDatos = filas.filter((f) => f.pct_logro != null)
  const sinDatos = filas.filter((f) => f.pct_logro == null)
  const podio = conPodio ? conDatos.slice(0, 3) : []

  return (
    <div className="flex flex-col gap-5">
      {podio.length > 0 && (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Podio">
          {podio.map((f) => (
            <li
              key={f.id_colegio ?? f.id_aula}
              className={cn(
                'flex flex-col items-center rounded-xl border p-4 text-center',
                f.posicion === 1 ? 'border-warning-600/30 bg-warning-100/40 sm:order-2' : 'border-line bg-surface-50',
                f.posicion === 2 && 'sm:order-1 sm:mt-4',
                f.posicion === 3 && 'sm:order-3 sm:mt-6',
              )}
            >
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-full border', MEDALLA[f.posicion])}>
                <Medal className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="mt-2 text-xs font-semibold text-ink-400">{f.posicion}.° lugar</span>
              <span className="mt-1 line-clamp-2 text-sm font-semibold text-ink-900">{f.nombre ?? f.colegio}</span>
              <span className="mt-1 font-display text-2xl font-bold tabular-nums text-ink-900">{formatoPct(f.pct_logro)}</span>
              <span className="text-[11px] text-ink-500">en Logrado o Destacado</span>
            </li>
          ))}
        </ol>
      )}

      <ol className="flex flex-col gap-2.5">
        {[...conDatos, ...sinDatos].map((f) => (
          <li key={f.id_colegio ?? f.id_aula} className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-3">
            <span className="text-right text-xs font-bold tabular-nums text-ink-400">
              {f.pct_logro == null ? '—' : `${f.posicion}.°`}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-ink-900">{f.nombre ?? f.colegio}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-ink-400">cobertura {formatoPct(f.cobertura)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${f.pct_logro ?? 0}%` }} />
              </div>
            </div>
            <span className="text-right text-sm font-semibold tabular-nums text-ink-900">
              {f.pct_logro == null ? 'Sin datos' : formatoPct(f.pct_logro)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
