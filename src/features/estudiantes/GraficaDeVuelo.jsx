// La trayectoria del alumno a lo largo del año (CU015, D64).
//
// `GET /alumnos/{id}/registro-vuelo` devuelve SIEMPRE los cuatro PA, incluso
// los que aún no tienen decisión, justamente para esto: lo que se quiere ver
// de un vistazo es si el alumno sube, se mantiene o baja, y para eso hacen
// falta los cuatro puntos aunque algunos estén vacíos.
//
// SE COMPARA POR `orden`, NUNCA POR LA LETRA. La escala Raz-Kids va de "aa" a
// "Z", y como texto "Z" > "aa": ordenar por la letra pondría al alumno más
// avanzado abajo del todo (RN-012). El eje usa el orden del catálogo.
import { useMemo } from 'react'
import { useNivelesRazkids } from '../../hooks/useCatalogos'

const ALTO = 140
const MARGEN = 24

export default function GraficaDeVuelo({ periodos = [] }) {
  const { data: niveles = [] } = useNivelesRazkids()

  /** El `orden` de cada letra, que es con lo que se compara de verdad. */
  const ordenDe = useMemo(() => {
    const mapa = new Map(niveles.map((n) => [n.letra, n.orden]))
    return (letra) => mapa.get(letra) ?? null
  }, [niveles])

  const puntos = periodos.map((p) => ({
    numero: p.numero,
    letra: p.nivel_colocado ?? null,
    orden: ordenDe(p.nivel_colocado),
  }))

  const conDato = puntos.filter((p) => p.orden != null)

  // Con un solo punto no hay trayectoria que dibujar: una línea de un punto
  // sugiere una tendencia que nadie ha medido.
  if (conDato.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-ink-500">
        {conDato.length === 0
          ? 'Todavía no hay decisiones registradas este año.'
          : 'Hace falta al menos un segundo periodo decidido para ver la trayectoria.'}
      </p>
    )
  }

  const minimo = Math.min(...conDato.map((p) => p.orden))
  const maximo = Math.max(...conDato.map((p) => p.orden))
  // Con todos los puntos iguales el rango sería 0 y la división explotaría;
  // además, una línea plana es justo lo que hay que enseñar ahí.
  const rango = maximo - minimo || 1

  const ancho = 320
  const x = (i) => MARGEN + (i * (ancho - MARGEN * 2)) / Math.max(1, puntos.length - 1)
  const y = (orden) => ALTO - MARGEN - ((orden - minimo) / rango) * (ALTO - MARGEN * 2)

  const linea = conDato
    .map((p) => `${x(puntos.indexOf(p))},${y(p.orden)}`)
    .join(' ')

  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-sm font-medium text-ink-700">
        Nivel colocado por periodo
      </figcaption>

      <svg
        viewBox={`0 0 ${ancho} ${ALTO}`}
        className="h-auto w-full max-w-md"
        role="img"
        aria-label={`Nivel colocado por periodo: ${conDato.map((p) => `PA${p.numero} ${p.letra}`).join(', ')}`}
      >
        <polyline points={linea} fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-600" />

        {puntos.map((p, i) => (
          <g key={p.numero}>
            {p.orden != null && (
              <>
                <circle cx={x(i)} cy={y(p.orden)} r="4" className="fill-brand-600" />
                <text x={x(i)} y={y(p.orden) - 10} textAnchor="middle" className="fill-ink-900 text-[11px] font-semibold">
                  {p.letra}
                </text>
              </>
            )}
            <text x={x(i)} y={ALTO - 4} textAnchor="middle" className="fill-ink-500 text-[11px]">
              PA{p.numero}
            </text>
          </g>
        ))}
      </svg>

      {/* Los PA sin decisión no se dibujan, pero se nombran: un hueco en la
          línea es un dato, y callarlo haría parecer que el año tiene menos
          periodos de los que tiene. */}
      {puntos.some((p) => p.orden == null) && (
        <p className="mt-1 text-xs text-ink-500">
          Sin decisión en {puntos.filter((p) => p.orden == null).map((p) => `PA${p.numero}`).join(', ')}.
        </p>
      )}
    </figure>
  )
}
