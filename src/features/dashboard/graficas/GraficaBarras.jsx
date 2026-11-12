// Barras verticales: "Libros leídos por mes" (CU034) y los repartos por nivel.
//
// LA BARRA DE UN MES SIN INFORMACIÓN NO SE DIBUJA. El literal de CU034 lo dice
// así: "el gráfico no dibuja barras con valor cero". Una barra de altura cero y
// un hueco se ven parecido en pantalla, pero no significan lo mismo, y aquí el
// hueco lleva su etiqueta debajo ("Sin información" o "Futuro") para que no se
// lea como un mes olvidado.
import { LINEA, MARCA, TINTA } from './paleta'
import { esFuturo, sinInformacion } from '../estados'
import { anchoDeTexto, factorDeLetra, letra } from './escala'
import { topeRedondo } from './GraficaLineas'

const ANCHO = 680
const ALTO = 240
const IZQUIERDA = 44
const DERECHA = 12
const ARRIBA = 16
const ABAJO = 44

/**
 * Las letras se dibujan al tamaño que, tras ajustar el SVG a su caja, se lee
 * como el de siempre: ver `escala.js`.
 */

/** Lo que se LEE sobre la barra: un decimal basta; el dato sigue completo en `aria-label`. */
const etiquetaDeValor = (v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toFixed(1)) : v)

export default function GraficaBarras({
  datos = [],
  campo = 'cantidad',
  color = MARCA,
  sufijo = '',
  compacto = false,
  anchoVisible = 0,
}) {
  const valores = datos.filter((d) => !sinInformacion(d, campo)).map((d) => d[campo])
  /**
   * El eje termina en un número redondo, como en `GraficaLineas` (U10): con el
   * máximo tal cual, las marcas salían como 6510 / 4883 / 3255 / 1628.
   */
  const maximo = topeRedondo(Math.max(1, ...valores))
  const factor = factorDeLetra({ anchoBase: ANCHO, anchoVisible, compacto })
  // El margen izquierdo crece con la letra para que el valor del eje no se corte.
  const izquierda = Math.max(IZQUIERDA, 12 + anchoDeTexto(Math.round(maximo), 10 * factor))
  const util = ANCHO - izquierda - DERECHA
  const alturaUtil = ALTO - ARRIBA - ABAJO
  const paso = util / Math.max(1, datos.length)
  const anchoBarra = Math.min(42, paso * 0.6)
  // Si el nombre más largo no cabe en el hueco de su barra, se abrevia a tres
  // letras (y se omite el año): con letra grande, doce meses no caben enteros.
  const nombreMasLargo = Math.max(0, ...datos.map((d) => String(d.nombre ?? '').split(' ')[0].length))
  const abreviar = nombreMasLargo * 10 * factor * 0.58 > paso * 0.95

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
          <line x1={izquierda} x2={ANCHO - DERECHA} y1={y(maximo * f)} y2={y(maximo * f)} stroke={LINEA} />
          <text x={izquierda - 8} y={y(maximo * f) + 4} textAnchor="end" fill={TINTA.suave} fontSize={letra(factor, 10)}>
            {Math.round(maximo * f)}
          </text>
        </g>
      ))}

      {datos.map((dato, i) => {
        const centro = izquierda + paso * i + paso / 2
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
                  fontSize={letra(factor, 10)}
                  fontWeight="600"
                >
                  {etiquetaDeValor(dato[campo])}
                  {sufijo}
                </text>
              </>
            )}

            {vacio && (
              <text x={centro} y={ALTO - ABAJO - 6} textAnchor="middle" fill={TINTA.suave} fontSize={letra(factor, 9)}>
                {esFuturo(dato) ? 'Futuro' : 'Sin inf.'}
              </text>
            )}

            <text x={centro} y={ALTO - 24} textAnchor="middle" fill={TINTA.media} fontSize={letra(factor, 10)}>
              {abreviar ? String(dato.nombre ?? '').slice(0, 3) : String(dato.nombre ?? '').split(' ')[0]}
            </text>
            {dato.anio && !abreviar && (
              <text x={centro} y={Math.min(ALTO - 1, ALTO - 24 + 12 * factor)} textAnchor="middle" fill={TINTA.suave} fontSize={letra(factor, 9)}>
                {dato.anio}
              </text>
            )}
          </g>
        )
      })}

      <line x1={izquierda} x2={ANCHO - DERECHA} y1={ALTO - ABAJO} y2={ALTO - ABAJO} stroke={TINTA.suave} />
    </svg>
  )
}
