// Cubre: RF-005, RF-006, RF-010, RNF-002
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { EJE, GRILLA, LEYENDA, LINEA, TOOLTIP, formatoPct } from './tema'

/**
 * Líneas de % de logro a lo largo de los cuatro cortes. Se usa para la
 * evolución por programa (P12, P17) y para colegio frente al promedio (P13).
 *
 * `series` = [{ clave, nombre, color, punteada }]. Un eje, siempre de 0 a 100:
 * nunca dos escalas en el mismo gráfico.
 */
export default function GraficoLineasPct({ datos = [], series = [], ejeX = 'periodo', altura = 300 }) {
  const hayDatos = datos.some((d) => series.some((s) => d[s.clave] != null))
  if (!hayDatos) return <EmptyState title="Sin datos suficientes" description="Ningún corte tiene evaluaciones que comparar." />

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey={ejeX} {...EJE} />
          <YAxis {...EJE} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={formatoPct} />
          <Tooltip {...TOOLTIP} formatter={(valor, nombre) => [formatoPct(valor), nombre]} />
          <Legend {...LEYENDA} />
          {series.map((s) => (
            <Line
              key={s.clave}
              type="monotone"
              dataKey={s.clave}
              name={s.nombre}
              stroke={s.color}
              {...LINEA}
              strokeDasharray={s.punteada ? '5 4' : undefined}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
