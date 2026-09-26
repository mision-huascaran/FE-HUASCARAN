import { colorDeNivel } from '../../domain/niveles'

/**
 * Distribución por nivel en una sola barra horizontal, para celdas de tabla
 * (P12, P13). Es HTML puro: no carga recharts.
 *
 * Los segmentos van separados por 2 px y cada uno lleva su título con el
 * conteo, porque los colores de nivel por sí solos no se distinguen bien con
 * daltonismo (ver `components/charts/tema.js`).
 */
const ORDEN = ['Pre Inicio', 'Inicio', 'Proceso', 'Logrado', 'Destacado']

export default function BarraSegmentada({ conteos = {}, className = '' }) {
  const total = Object.values(conteos).reduce((s, n) => s + n, 0)
  if (!total) return <span className="text-xs text-ink-400">Sin datos</span>

  const segmentos = ORDEN.filter((n) => conteos[n]).map((nivel) => ({
    nivel,
    cantidad: conteos[nivel],
    pct: Math.round((conteos[nivel] / total) * 100),
  }))

  return (
    <div
      className={`flex h-3 w-full min-w-[8rem] gap-[2px] overflow-hidden rounded-full ${className}`}
      role="img"
      aria-label={segmentos.map((s) => `${s.nivel} ${s.pct}%`).join(', ')}
    >
      {segmentos.map((s) => (
        <span
          key={s.nivel}
          title={`${s.nivel}: ${s.cantidad} (${s.pct}%)`}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${s.pct}%`, backgroundColor: colorDeNivel(s.nivel) }}
        />
      ))}
    </div>
  )
}
