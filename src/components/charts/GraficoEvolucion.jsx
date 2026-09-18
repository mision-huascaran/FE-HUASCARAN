// Cubre: RF-011, RN-012, RN-014, RNF-002
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../ui/EmptyState'
import { EJE, GRILLA, LEYENDA, LINEA, SERIES_EVOLUCION, TOOLTIP } from './tema'

/**
 * Evolución de un estudiante entre las cuatro evaluaciones diagnósticas (P11).
 *
 * RN-012: el eje Y trabaja con el campo `orden` del catálogo y solo MUESTRA la
 * letra correspondiente. Nunca se ordenan letras como texto.
 * RN-014: el nivel de la prueba (Raz-Kids) y el nivel ajustado por el docente
 * son dos series distintas; ninguna sobreescribe a la otra.
 */
export default function GraficoEvolucion({ datos = [], catalogoRazkids = [], altura = 288 }) {
  const conDatos = datos.filter((d) => d.orden_prueba != null || d.orden_ajustado != null)
  if (!conDatos.length) {
    return <EmptyState title="Sin evaluaciones registradas" description="Aún no hay cortes diagnósticos para este estudiante." />
  }

  const letraDe = (orden) => catalogoRazkids.find((n) => n.orden === orden)?.letra ?? ''

  // El dominio se ajusta a los datos con un margen de un nivel a cada lado, para
  // que la línea no quede pegada al borde del área de trazado.
  const ordenes = datos.flatMap((d) => [d.orden_prueba, d.orden_ajustado, d.orden_esperado]).filter(Number.isFinite)
  const minimo = Math.max(1, Math.min(...ordenes) - 1)
  const maximo = Math.min(catalogoRazkids.length, Math.max(...ordenes) + 1)
  const marcas = Array.from({ length: maximo - minimo + 1 }, (_, i) => minimo + i)

  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid {...GRILLA} />
          <XAxis dataKey="periodo" {...EJE} />
          <YAxis
            {...EJE}
            domain={[minimo, maximo]}
            ticks={marcas.length <= 12 ? marcas : undefined}
            tickFormatter={letraDe}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            {...TOOLTIP}
            formatter={(valor, nombre) => [letraDe(valor) || '—', nombre]}
          />
          <Legend {...LEYENDA} />
          <Line
            type="monotone"
            dataKey="orden_prueba"
            name={SERIES_EVOLUCION.prueba.nombre}
            stroke={SERIES_EVOLUCION.prueba.color}
            {...LINEA}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="orden_ajustado"
            name={SERIES_EVOLUCION.ajustado.nombre}
            stroke={SERIES_EVOLUCION.ajustado.color}
            {...LINEA}
            connectNulls
          />
          {/* Referencia, no una medición: va punteada y en gris para quedar al fondo. */}
          <Line
            type="monotone"
            dataKey="orden_esperado"
            name={SERIES_EVOLUCION.esperado.nombre}
            stroke={SERIES_EVOLUCION.esperado.color}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
