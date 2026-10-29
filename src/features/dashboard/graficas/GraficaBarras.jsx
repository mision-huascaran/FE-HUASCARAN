// Barras verticales: "Libros leídos por mes" (CU034) y los repartos por nivel.
//
// LA BARRA DE UN MES SIN INFORMACIÓN NO SE DIBUJA. El literal de CU034 lo dice
// así: "el gráfico no dibuja barras con valor cero". Una barra de altura cero y
// un hueco se ven parecido en pantalla, pero no significan lo mismo, y aquí el
// hueco lleva su etiqueta debajo ("Sin información" o "Futuro") para que no se
// lea como un mes olvidado.
import { LINEA, MARCA, TINTA } from './paleta'
import { esFuturo, sinInformacion } from '../estados'

const ANCHO = 680
const ALTO = 240
const IZQUIERDA = 44
const DERECHA = 12
const ARRIBA = 16
const ABAJO = 44

export default function GraficaBarras({ datos = [], campo = 'cantidad', color = MARCA, sufijo = '' }) {
  const valores = datos.filter((d) => !sinInformacion(d, campo)).map((d) => d[campo])
  const maximo = Math.max(1, ...valores)
  const util = ANCHO - IZQUIERDA - DERECHA
  const alturaUtil = ALTO - ARRIBA - ABAJO
  const paso = util / Math.max(1, datos.length)
  const anchoBarra = Math.min(42, paso * 0.6)

  const y = (valor) => ALTO - ABAJO - (valor / maximo) * alturaUtil

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="h-auto w-full"
      role="img"
      aria-label={datos
        .map((d) => `${d.nombre}: ${sinInformacion(d, campo) ? 'sin información' : d[campo]}`)
        .join(', ')}
    >
      {/* Cuatro guías y su valor: sin eje, una barra no se puede leer. */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={IZQUIERDA} x2={ANCHO - DERECHA} y1={y(maximo * f)} y2={y(maximo * f)} stroke={LINEA} />
          <text x={IZQUIERDA - 8} y={y(maximo * f) + 4} textAnchor="end" fill={TINTA.suave} fontSize="10">
            {Math.round(maximo * f)}
          </text>
        </g>
      ))}

      {datos.map((dato, i) => {
        const centro = IZQUIERDA + paso * i + paso / 2
        const vacio = sinInformacion(dato, campo)
        return (
          <g key={`${dato.nombre}-${i}`}>
            {!vacio && (
              <>
                <rect
                  x={centro - anchoBarra / 2}
                  y={y(dato[campo])}
                  width={anchoBarra}
                  height={Math.max(0, ALTO - ABAJO - y(dato[campo]))}
                  rx="3"
                  fill={color}
                  // El mes en curso se distingue: es un acumulado, no un cierre.
                  fillOpacity={dato.estado === 'en_curso' ? 0.55 : 1}
                />
                <text
                  x={centro}
                  y={y(dato[campo]) - 5}
                  textAnchor="middle"
                  fill={TINTA.fuerte}
                  fontSize="10"
                  fontWeight="600"
                >
                  {dato[campo]}
                  {sufijo}
                </text>
              </>
            )}

            {vacio && (
              <text x={centro} y={ALTO - ABAJO - 6} textAnchor="middle" fill={TINTA.suave} fontSize="9">
                {esFuturo(dato) ? 'Futuro' : 'Sin inf.'}
              </text>
            )}

            <text x={centro} y={ALTO - 24} textAnchor="middle" fill={TINTA.media} fontSize="10">
              {String(dato.nombre ?? '').split(' ')[0]}
            </text>
            {dato.anio && (
              <text x={centro} y={ALTO - 12} textAnchor="middle" fill={TINTA.suave} fontSize="9">
                {dato.anio}
              </text>
            )}
          </g>
        )
      })}

      <line x1={IZQUIERDA} x2={ANCHO - DERECHA} y1={ALTO - ABAJO} y2={ALTO - ABAJO} stroke={TINTA.suave} />
    </svg>
  )
}
