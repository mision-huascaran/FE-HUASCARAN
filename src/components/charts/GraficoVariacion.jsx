// Cubre: RF-006, RF-010, RNF-002
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { LEYENDA, SERIES_VARIACION, TOOLTIP } from './tema'

/**
 * Variación de nivel entre el primer corte del año y el elegido (dona, P12).
 * Cada porción muestra su porcentaje: la identidad nunca depende solo del color.
 */
export default function GraficoVariacion({ datos, altura = 300 }) {
  const categorias = (datos?.categorias ?? []).filter((c) => c.cantidad > 0)

  if (!datos?.total) {
    return (
      <EmptyState
        title="Sin variación que medir"
        description="Hacen falta al menos dos evaluaciones por estudiante."
      />
    )
  }

  return (
    <div className="relative" style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categorias}
            dataKey="cantidad"
            nameKey="nombre"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={1}
            stroke="#FFFFFF"
            strokeWidth={2}
            label={({ pct }) => `${pct}%`}
            labelLine={false}
            isAnimationActive={false}
          >
            {categorias.map((c) => (
              <Cell key={c.nombre} fill={SERIES_VARIACION[c.nombre]} />
            ))}
          </Pie>
          <Tooltip {...TOOLTIP} formatter={(valor, nombre, item) => [`${valor} estudiantes (${item.payload.pct}%)`, nombre]} />
          <Legend {...LEYENDA} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-28px)] text-center">
        <p className="font-display text-2xl font-bold tabular-nums text-ink-900">{datos.total}</p>
        <p className="text-[11px] text-ink-500">estudiantes</p>
      </div>
    </div>
  )
}
