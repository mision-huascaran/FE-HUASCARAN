// Cubre: RF-006, RN-012, RN-013, RNF-002
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../ui/EmptyState'
import { COLORES, COLOR_PRINCIPAL, EJE, GRILLA, LEYENDA, TOOLTIP } from './tema'

/**
 * Nivel Raz-Kids alcanzado (promedio del grado) frente al esperado (P12).
 * RN-012: se grafica por `orden` y el eje muestra la letra del catálogo.
 */
export default function GraficoAlcanzadoEsperado({ datos = [], catalogoRazkids = [], altura = 300 }) {
  const filas = datos.filter((d) => d.alcanzado != null)
  if (!filas.length) return <EmptyState title="Sin evaluaciones" description="No hay niveles registrados en este corte." />

  const letraDe = (orden) => catalogoRazkids.find((n) => n.orden === Math.round(orden))?.letra ?? ''
  const maximo = Math.min(catalogoRazkids.length || 29, Math.max(...filas.flatMap((f) => [f.alcanzado, f.esperado ?? 0])) + 2)

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={filas} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey="grado" {...EJE} />
          <YAxis {...EJE} domain={[0, maximo]} tickFormatter={letraDe} allowDecimals={false} width={40} />
          <Tooltip
            {...TOOLTIP}
            formatter={(valor, nombre) => [letraDe(valor) || '—', nombre]}
          />
          <Legend {...LEYENDA} />
          <Bar dataKey="alcanzado" name="Nivel alcanzado (promedio)" fill={COLOR_PRINCIPAL} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="esperado" name="Nivel esperado para el grado" fill={COLORES.referencia} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
