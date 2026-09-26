// Cubre: RF-006, RF-007, RNF-002
import { Bar, BarChart, CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { COLORES, COLOR_PRINCIPAL, EJE, GRILLA, TOOLTIP, formatoPct } from './tema'

/**
 * Cobertura del registro por colegio, con la meta del 100 % marcada (P12).
 * Es lo que distingue "a este colegio le va mal" de "todavía no cargó datos".
 */
export default function GraficoCobertura({ datos = [], altura = 300 }) {
  if (!datos.length) return <EmptyState title="Sin colegios" description="No hay colegios con estos filtros." />

  const filas = datos.map((d) => ({ nombre: d.abreviatura, colegio: d.colegio, cobertura: d.cobertura ?? 0, evaluados: d.evaluados, estudiantes: d.estudiantes }))

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey="nombre" {...EJE} />
          <YAxis {...EJE} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={formatoPct} />
          <Tooltip
            {...TOOLTIP}
            labelFormatter={(_, items) => items?.[0]?.payload?.colegio ?? ''}
            formatter={(valor, _n, item) => [`${formatoPct(valor)} (${item.payload.evaluados} de ${item.payload.estudiantes})`, 'Cobertura']}
          />
          <ReferenceLine y={100} stroke={COLORES.ejes} strokeDasharray="4 4" label={{ value: 'Meta 100%', position: 'insideTopRight', fill: COLORES.texto, fontSize: 11 }} />
          <Bar dataKey="cobertura" fill={COLOR_PRINCIPAL} radius={[4, 4, 0, 0]} maxBarSize={32}>
            <LabelList dataKey="cobertura" position="top" formatter={formatoPct} style={{ fill: COLORES.texto, fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
