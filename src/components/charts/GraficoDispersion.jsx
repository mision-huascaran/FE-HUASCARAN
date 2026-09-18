// Cubre: RF-007, RF-009, RNF-002
import { CartesianGrid, LabelList, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { COLORES, COLOR_PRINCIPAL, EJE, GRILLA, TOOLTIP, formatoPct } from './tema'

/**
 * Logro frente a cobertura, un punto por colegio (P13).
 *
 * Evita confundir "va mal" con "todavía no cargó datos": un colegio abajo a la
 * izquierda tiene poco logro Y poca cobertura, y su logro aún no es confiable.
 */
export default function GraficoDispersion({ datos = [], altura = 320 }) {
  const puntos = datos.filter((d) => d.cobertura != null && d.pct_logro != null)
  if (!puntos.length) return <EmptyState title="Sin datos" description="Ningún colegio tiene evaluaciones en este corte." />

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: -4 }}>
          <CartesianGrid stroke={GRILLA.stroke} strokeDasharray={GRILLA.strokeDasharray} />
          <XAxis
            type="number"
            dataKey="cobertura"
            name="Cobertura"
            domain={[0, 100]}
            tickFormatter={formatoPct}
            {...EJE}
            label={{ value: 'Cobertura del registro', position: 'insideBottom', offset: -8, fill: COLORES.texto, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="pct_logro"
            name="Logro"
            domain={[0, 100]}
            tickFormatter={formatoPct}
            {...EJE}
          />
          <ReferenceLine x={50} stroke={COLORES.grilla} />
          <ReferenceLine y={50} stroke={COLORES.grilla} />
          <Tooltip
            {...TOOLTIP}
            cursor={{ strokeDasharray: '3 3' }}
            formatter={(valor, nombre) => [formatoPct(valor), nombre]}
            labelFormatter={() => ''}
          />
          <Scatter data={puntos} fill={COLOR_PRINCIPAL} stroke="#FFFFFF" strokeWidth={2}>
            <LabelList dataKey="abreviatura" position="top" style={{ fill: COLORES.texto, fontSize: 11, fontWeight: 600 }} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
