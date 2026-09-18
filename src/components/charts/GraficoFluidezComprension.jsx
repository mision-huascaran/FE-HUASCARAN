// Cubre: RF-006, RN-008, RNF-002
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { EJE, GRILLA, LEYENDA, SERIES_RUBRICA, TOOLTIP, formatoPct } from './tema'

/**
 * Fluidez frente a Comprensión: % de estudiantes en cada nivel, por dimensión.
 * RN-008: barras agrupadas, NUNCA un promedio de las dos dimensiones.
 */
export default function GraficoFluidezComprension({ datos = [], altura = 300 }) {
  if (!datos.length) return <EmptyState title="Sin rúbricas" description="No hay evaluaciones en este corte." />

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey="nivel" {...EJE} />
          <YAxis {...EJE} tickFormatter={formatoPct} />
          <Tooltip {...TOOLTIP} formatter={(valor, nombre) => [formatoPct(valor), nombre]} />
          <Legend {...LEYENDA} />
          <Bar dataKey="fluidez" name={SERIES_RUBRICA.fluidez.nombre} fill={SERIES_RUBRICA.fluidez.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="comprension" name={SERIES_RUBRICA.comprension.nombre} fill={SERIES_RUBRICA.comprension.color} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
