// La dona de "Distribución de alumnos por subprograma" (CU033, paso 5).
//
// SVG a mano, como el resto de las gráficas del sistema: el stack permite
// recharts, pero una dona de dos sectores no justifica un contenedor que mide
// el ancho con un ResizeObserver, y además el PNG exige colores en atributos
// (ver `lib/descargarGrafica.js`).
//
// Un sector de valor 0 no se dibuja, pero sí se nombra en la leyenda: un 0
// CONFIRMADO es un dato —"no hay ningún alumno de Comprensión Lectora en esta
// selección"— y callarlo lo convertiría en ausencia de información, que es lo
// que CU033 prohíbe confundir.
import { LINEA, TINTA, colorDeSubprograma } from './paleta'

const ANCHO = 420
const ALTO = 220
const CENTRO_X = 110
const CENTRO_Y = 110
const RADIO = 84
const GROSOR = 30

/** Punto del borde del anillo para un ángulo dado, en grados desde arriba. */
function punto(angulo, radio) {
  const radianes = ((angulo - 90) * Math.PI) / 180
  return [CENTRO_X + radio * Math.cos(radianes), CENTRO_Y + radio * Math.sin(radianes)]
}

/** Un sector del anillo, como path cerrado entre el radio exterior e interior. */
function sector(desde, hasta) {
  const externo = RADIO
  const interno = RADIO - GROSOR
  const grande = hasta - desde > 180 ? 1 : 0
  const [x1, y1] = punto(desde, externo)
  const [x2, y2] = punto(hasta, externo)
  const [x3, y3] = punto(hasta, interno)
  const [x4, y4] = punto(desde, interno)
  return [
    `M ${x1} ${y1}`,
    `A ${externo} ${externo} 0 ${grande} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${interno} ${interno} 0 ${grande} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

export default function GraficaDona({ partes = [], total, etiquetaTotal = 'alumnos' }) {
  const suma = partes.reduce((a, p) => a + (p.cantidad ?? 0), 0)
  let angulo = 0

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="h-auto w-full max-w-xl"
      role="img"
      aria-label={partes.map((p) => `${p.nombre}: ${p.cantidad}`).join(', ')}
    >
      <circle cx={CENTRO_X} cy={CENTRO_Y} r={RADIO - GROSOR / 2} fill="none" stroke={LINEA} strokeWidth={GROSOR} />

      {partes.map((parte, i) => {
        const porcion = suma ? ((parte.cantidad ?? 0) / suma) * 360 : 0
        if (porcion <= 0) return null
        const d = sector(angulo, angulo + porcion)
        angulo += porcion
        return <path key={parte.nombre} d={d} fill={colorDeSubprograma(parte.nombre, i)} />
      })}

      {/* El total va en el hueco: es la cifra que se busca primero. */}
      <text x={CENTRO_X} y={CENTRO_Y - 2} textAnchor="middle" fill={TINTA.fuerte} fontSize="22" fontWeight="700">
        {total ?? '—'}
      </text>
      <text x={CENTRO_X} y={CENTRO_Y + 16} textAnchor="middle" fill={TINTA.media} fontSize="11">
        {etiquetaTotal}
      </text>

      {partes.map((parte, i) => (
        <g key={`leyenda-${parte.nombre}`} transform={`translate(230 ${64 + i * 32})`}>
          <rect width="12" height="12" rx="3" fill={colorDeSubprograma(parte.nombre, i)} />
          <text x="20" y="10" fill={TINTA.fuerte} fontSize="12">
            {parte.nombre}
          </text>
          <text x="20" y="26" fill={TINTA.media} fontSize="11">
            {parte.cantidad ?? '—'}
            {parte.porcentaje != null && ` · ${parte.porcentaje.toFixed(1)} %`}
          </text>
        </g>
      ))}
    </svg>
  )
}
