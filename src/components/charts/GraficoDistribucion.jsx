// Cubre: RF-006, RF-010, RN-004, RNF-002
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { EJE, GRILLA, LEYENDA, SERIES_NIVEL, TOOLTIP, formatoPct } from './tema'
import { colorDeNivel } from '../../domain/niveles'

/**
 * Distribución por nivel y periodo, apilada al 100 % (P12).
 *
 * Los colores de nivel no se distinguen bien entre sí para quien tiene
 * daltonismo (ver `tema.js`): por eso cada segmento lleva su porcentaje escrito
 * y un borde blanco de 2 px que lo separa del vecino.
 */
export default function GraficoDistribucion({ datos, altura = 300 }) {
  const niveles = datos?.niveles ?? []
  const filas = (datos?.filas ?? []).filter((f) => f.total > 0)

  if (!filas.length) {
    return <EmptyState title="Sin evaluaciones" description="No hay cortes registrados con estos filtros." />
  }

  const series = filas.map((f) => ({
    periodo: f.periodo,
    total: f.total,
    ...Object.fromEntries(niveles.map((n) => [n, Math.round(((f.conteos[n] ?? 0) / f.total) * 100)])),
    ...Object.fromEntries(niveles.map((n) => [`n_${n}`, f.conteos[n] ?? 0])),
  }))

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey="periodo" {...EJE} />
          <YAxis {...EJE} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={formatoPct} />
          <Tooltip
            {...TOOLTIP}
            formatter={(valor, nombre, item) => [`${formatoPct(valor)} (${item.payload[`n_${nombre}`]} de ${item.payload.total})`, nombre]}
          />
          <Legend {...LEYENDA} />
          {niveles.map((nivel) => (
            <Bar
              key={nivel}
              dataKey={nivel}
              stackId="nivel"
              fill={SERIES_NIVEL[nivel.toLowerCase().replaceAll(/\s/g, '')] ?? colorDeNivel(nivel)}
              stroke="#FFFFFF"
              strokeWidth={2}
              maxBarSize={56}
            >
              <LabelList
                dataKey={nivel}
                position="center"
                formatter={(v) => (v >= 8 ? `${v}%` : '')}
                style={{ fill: '#FFFFFF', fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
