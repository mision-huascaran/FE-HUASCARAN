// Líneas: "Asistencia mensual" (CU033) y la evolución anual (CU033 y CU035).
//
// LA LÍNEA NO ATRAVIESA LOS HUECOS. Es literal de CU033: "los meses sin estados
// registrados muestran 'Sin información' y la línea no atraviesa esos vacíos".
// Por eso se dibuja un `polyline` por TRAMO de puntos consecutivos con dato, y
// no uno solo con los puntos que haya: unir noviembre con enero saltándose
// diciembre dibuja una tendencia que nadie midió.
//
// Los meses futuros tampoco tienen punto ni valor de cero.
import { LINEA, MARCA, TINTA } from './paleta'
import { esFuturo, sinInformacion } from '../estados'

const ANCHO = 680
const ALTO = 240
const IZQUIERDA = 48
const DERECHA = 16
const ARRIBA = 18
const ABAJO = 44

/** Tramos de puntos consecutivos con dato. Un hueco corta el tramo. */
function tramos(puntos) {
  const salida = []
  let actual = []
  for (const punto of puntos) {
    if (punto.vacio) {
      if (actual.length) salida.push(actual)
      actual = []
    } else {
      actual.push(punto)
    }
  }
  if (actual.length) salida.push(actual)
  return salida
}

export default function GraficaLineas({ datos = [], campo = 'porcentaje', sufijo = ' %', color = MARCA, maximo }) {
  const valores = datos.filter((d) => !sinInformacion(d, campo)).map((d) => d[campo])
  const tope = maximo ?? Math.max(1, ...valores)
  const util = ANCHO - IZQUIERDA - DERECHA
  const alturaUtil = ALTO - ARRIBA - ABAJO
  const paso = datos.length > 1 ? util / (datos.length - 1) : 0

  const puntos = datos.map((dato, i) => ({
    ...dato,
    vacio: sinInformacion(dato, campo),
    x: IZQUIERDA + paso * i + (datos.length === 1 ? util / 2 : 0),
    y: ALTO - ABAJO - ((dato[campo] ?? 0) / tope) * alturaUtil,
  }))

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="h-auto w-full"
      role="img"
      aria-label={datos
        .map((d) => `${d.nombre}: ${sinInformacion(d, campo) ? 'sin información' : String(d[campo]) + sufijo}`)
        .join(', ')}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = ALTO - ABAJO - f * alturaUtil
        return (
          <g key={f}>
            <line x1={IZQUIERDA} x2={ANCHO - DERECHA} y1={y} y2={y} stroke={LINEA} />
            <text x={IZQUIERDA - 8} y={y + 4} textAnchor="end" fill={TINTA.suave} fontSize="10">
              {Math.round(tope * f)}
            </text>
          </g>
        )
      })}

      {tramos(puntos).map((tramo) => (
        <polyline
          key={`tramo-${tramo[0].nombre}`}
          points={tramo.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
      ))}

      {puntos.map((p) => (
        <g key={`${p.nombre}-${p.anio ?? ''}`}>
          {!p.vacio && (
            <>
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill={color}
                // Hueco por dentro para el punto que todavía no cerró: el mes o
                // el año en curso es un acumulado hasta hoy.
                fillOpacity={p.estado === 'en_curso' || p.parcial ? 0.4 : 1}
                stroke={color}
              />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill={TINTA.fuerte} fontSize="10" fontWeight="600">
                {p[campo]}
                {sufijo}
              </text>
            </>
          )}
          {p.vacio && (
            <text x={p.x} y={ALTO - ABAJO - 8} textAnchor="middle" fill={TINTA.suave} fontSize="9">
              {esFuturo(p) ? 'Futuro' : 'Sin inf.'}
            </text>
          )}
          <text x={p.x} y={ALTO - 24} textAnchor="middle" fill={TINTA.media} fontSize="10">
            {String(p.nombre ?? '').split(' ')[0]}
          </text>
          {(p.estado === 'en_curso' || p.parcial) && (
            <text x={p.x} y={ALTO - 12} textAnchor="middle" fill={TINTA.suave} fontSize="9">
              {p.parcial ? 'Parcial' : 'En curso'}
            </text>
          )}
        </g>
      ))}

      <line x1={IZQUIERDA} x2={ANCHO - DERECHA} y1={ALTO - ABAJO} y2={ALTO - ABAJO} stroke={TINTA.suave} />
    </svg>
  )
}
