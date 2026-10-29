// La trayectoria del alumno a lo largo del año (CU015, D64).
//
// EL EJE Y SON LOS CUATRO NIVELES DESCRIPTIVOS del programa —Inicio, En
// proceso, Logrado y Avanzado—, no las letras Raz-Kids. Lo pide CU015 con
// nombre y apellido, y tiene sentido: una "J" no significa lo mismo en 3.º que
// en 5.º, así que una línea de letras compararía al alumno consigo mismo en
// una escala que se mueve con el grado. "Pre-inicio" queda fuera a propósito:
// pertenece a los criterios internos de la Rúbrica, no a esta gráfica.
//
// Esa correspondencia letra → nivel descriptivo la calcula el SERVIDOR con la
// matriz por grado de CU015 y llega en `nivel_programa`. Aquí no se traduce
// ninguna letra: hacerlo sería mantener una segunda matriz que puede quedar
// desalineada con la del backend, y de paso obligaría a comparar letras, que
// como texto da "Z" > "aa" y pondría al alumno más avanzado abajo (RN-012).
//
// `GET /alumnos/{id}/registro-vuelo` devuelve SIEMPRE los cuatro PA, incluso
// los que aún no tienen decisión, justamente para esto: lo que se quiere ver
// de un vistazo es si el alumno sube, se mantiene o baja.
import { TrendingUp } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'

/** De abajo a arriba, como se dibuja el eje. El orden es el de CU015. */
const NIVELES = ['Inicio', 'En proceso', 'Logrado', 'Avanzado']

/** "PA2 Logrado (M)": un punto de la gráfica, para su texto alternativo. */
function textoDePunto(p) {
  const letra = p.letra ? ` (${p.letra})` : ''
  return `PA${p.numero} ${NIVELES[p.fila]}${letra}`
}

const ANCHO = 420
const ALTO = 200
const IZQUIERDA = 86
const DERECHA = 16
const ARRIBA = 14
const ABAJO = 30

export default function GraficaDeVuelo({ periodos = [] }) {
  const puntos = periodos.map((p) => ({
    numero: p.numero,
    letra: p.nivel_colocado ?? null,
    // El índice en la escala descriptiva, o `null` si el periodo no tiene
    // decisión todavía.
    fila: NIVELES.indexOf(p.nivel_programa),
  }))

  const conDato = puntos.filter((p) => p.fila >= 0)

  // Sin ninguna evaluación del año se OCULTAN LOS EJES: unos ejes vacíos
  // parecen un error de carga, y el texto de CU015 dice justo lo que pasa.
  if (conDato.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Aún no hay datos suficientes para graficar el progreso"
        description="La gráfica aparece en cuanto el alumno tenga su primera decisión de Registro de Vuelo en el año."
      />
    )
  }

  const x = (i) => IZQUIERDA + (i * (ANCHO - IZQUIERDA - DERECHA)) / Math.max(1, puntos.length - 1)
  const y = (fila) => ALTO - ABAJO - (fila * (ALTO - ARRIBA - ABAJO)) / (NIVELES.length - 1)

  const linea = conDato.map((p) => `${x(puntos.indexOf(p))},${y(p.fila)}`).join(' ')
  const sinDecision = puntos.filter((p) => p.fila < 0)

  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-sm font-medium text-ink-700">Evolución del nivel en el año</figcaption>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="h-auto w-full max-w-xl"
        role="img"
        aria-label={`Evolución del nivel por periodo: ${conDato.map(textoDePunto).join(', ')}`}
      >
        {/* El eje Y: una línea guía por nivel descriptivo. */}
        {NIVELES.map((nivel, fila) => (
          <g key={nivel}>
            <line
              x1={IZQUIERDA}
              x2={ANCHO - DERECHA}
              y1={y(fila)}
              y2={y(fila)}
              className="stroke-line"
              strokeWidth="1"
            />
            <text x={IZQUIERDA - 8} y={y(fila) + 4} textAnchor="end" className="fill-ink-500 text-[11px]">
              {nivel}
            </text>
          </g>
        ))}

        <polyline points={linea} fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600" />

        {puntos.map((p, i) => (
          <g key={p.numero}>
            {p.fila >= 0 && (
              <>
                <circle cx={x(i)} cy={y(p.fila)} r="4" className="fill-brand-600" />
                {/* La letra se mantiene junto al punto: es el dato que el
                    Docente registró, y el nivel descriptivo solo lo agrupa. */}
                {p.letra && (
                  <text
                    x={x(i)}
                    y={y(p.fila) - 10}
                    textAnchor="middle"
                    className="fill-ink-900 text-[11px] font-semibold"
                  >
                    {p.letra}
                  </text>
                )}
              </>
            )}
            <text x={x(i)} y={ALTO - 8} textAnchor="middle" className="fill-ink-500 text-[11px]">
              PA{p.numero}
            </text>
          </g>
        ))}
      </svg>

      {/* Los PA sin decisión no se dibujan, pero se nombran: un hueco en la
          línea es un dato, y callarlo haría parecer que el año tiene menos
          periodos de los que tiene. */}
      {sinDecision.length > 0 && (
        <p className="mt-1 text-xs text-ink-500">
          Sin decisión en {sinDecision.map((p) => `PA${p.numero}`).join(', ')}.
        </p>
      )}
    </figure>
  )
}
