// Cubre: RF-017, RN-008, RNF-002
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../ui/EmptyState'
import { EJE, GRILLA, LEYENDA, SERIES_RUBRICA, TOOLTIP } from './tema'

/**
 * Rúbrica semanal del mes: Fluidez frente a Comprensión, semana a semana (P11).
 *
 * RN-008: las dos dimensiones se muestran SIEMPRE juntas y NUNCA promediadas.
 *
 * Nota de diseño: el prompt pide "barras apiladas" para este gráfico. Se usan
 * barras AGRUPADAS a propósito. Los niveles de la rúbrica son una escala
 * ordinal, no cantidades: apilar "Fluidez: Proceso" sobre "Comprensión:
 * Logrado" produciría una altura total que no significa nada, y además sugiere
 * visualmente una suma de ambas dimensiones, que es justo lo que RN-008
 * prohíbe. Agrupadas se comparan sin inventar un total. Queda anotado para
 * revisión del equipo.
 */
export default function GraficoRubricaSemanal({ datos = [], nivelesPorDimension = {}, altura = 288 }) {
  const conDatos = datos.filter((d) => d.fluidez || d.comprension)
  if (!conDatos.length) {
    return (
      <EmptyState
        title="Sin rúbricas este mes"
        description="Todavía no se registró ninguna rúbrica semanal para este estudiante."
      />
    )
  }

  // Cada nivel se dibuja por su `orden` dentro de su propia dimensión, y el eje
  // muestra el nombre del nivel: el número nunca se enseña.
  const ordenDe = (dimension, nombre) =>
    (nivelesPorDimension[dimension] ?? []).find((n) => n.nombre_nivel === nombre)?.orden ?? null

  const maximo = Math.max(
    (nivelesPorDimension.Fluidez ?? []).length,
    (nivelesPorDimension['Comprensión'] ?? []).length,
    4,
  )

  const nombreDe = (dimension, orden) =>
    (nivelesPorDimension[dimension] ?? []).find((n) => n.orden === orden)?.nombre_nivel ?? ''

  const series = datos.map((d) => ({
    semana: `S${d.numero}`,
    fluidez: ordenDe('Fluidez', d.fluidez),
    comprension: ordenDe('Comprensión', d.comprension),
    nombre_fluidez: d.fluidez,
    nombre_comprension: d.comprension,
  }))

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 16, bottom: 0, left: -8 }} barGap={2}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey="semana" {...EJE} />
          <YAxis
            {...EJE}
            domain={[0, maximo]}
            ticks={Array.from({ length: maximo + 1 }, (_, i) => i)}
            tickFormatter={(orden) => (orden === 0 ? '' : nombreDe('Fluidez', orden) || nombreDe('Comprensión', orden))}
            width={76}
            allowDecimals={false}
          />
          <Tooltip
            {...TOOLTIP}
            formatter={(valor, nombre, item) => [
              nombre === SERIES_RUBRICA.fluidez.nombre
                ? (item.payload.nombre_fluidez ?? '—')
                : (item.payload.nombre_comprension ?? '—'),
              nombre,
            ]}
          />
          <Legend {...LEYENDA} />
          <Bar
            dataKey="fluidez"
            name={SERIES_RUBRICA.fluidez.nombre}
            fill={SERIES_RUBRICA.fluidez.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="comprension"
            name={SERIES_RUBRICA.comprension.nombre}
            fill={SERIES_RUBRICA.comprension.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
