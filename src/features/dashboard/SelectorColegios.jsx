// El selector de colegios del dashboard (CU033, CU034 y CU035).
//
// Los tres CU piden lo mismo y con detalle: "selector múltiple con buscador,
// casillas para elegir uno o varios colegios autorizados y la opción 'Todos los
// colegios'".
//
// UN DESPLEGABLE, NO UN PANEL SIEMPRE ABIERTO. La primera versión dejaba la
// lista entera —buscador y casillas— siempre visible en la pantalla, con la
// misma altura sin importar cuántos colegios hubiera. Junto a "Año escolar" y
// "Periodo académico", que son cajas de 40 px, eso desnivelaba toda la fila:
// los dos primeros quedaban varados arriba con un hueco en blanco del alto
// del panel, y encima partía la fila en dos. Cerrado, el disparador mide lo
// mismo que un `Select`; abierto, el panel flota por encima del contenido en
// vez de empujarlo.
//
// Tres decisiones que no son de estilo:
//
//   · EL BUSCADOR FILTRA LO QUE SE VE, NO LO QUE ESTÁ ELEGIDO. Con nueve
//     colegios parece de adorno; con el alcance real deja de serlo, y un
//     buscador que además desmarcara sería una trampa.
//   · "TODOS LOS COLEGIOS" NO ES "MARCAR LOS NUEVE". Viaja como
//     `todos_los_colegios=true` y significa "el alcance autorizado, el que sea
//     hoy". Si mañana se autoriza uno más, entra sin tocar el filtro. Por eso
//     no se puede simular marcando todas las casillas.
//   · UNA SELECCIÓN VACÍA NO EQUIVALE A TODOS: se dice en el propio control,
//     porque el botón "Aplicar" deshabilitado sin explicación parece un fallo.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import useOnEscape from '../../hooks/useOnEscape'
import cn from '../../lib/cn'

/** Sin tildes ni mayúsculas, como busca el resto del sistema. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** El texto del disparador: «Todos los colegios», «Ninguno elegido» o «N de M». */
function resumenDe({ todos, vacio, elegidos, total }) {
  if (todos) return 'Todos los colegios'
  if (vacio) return 'Ninguno elegido'
  return `${elegidos} de ${total}`
}

export default function SelectorColegios({ colegios = [], todos = true, elegidos = [], onChange }) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const idBusqueda = useId()
  const idEtiqueta = useId()
  const contenedor = useRef(null)
  const marcados = new Set(elegidos.map(String))

  const visibles = useMemo(() => {
    const aguja = normalizar(busqueda).trim()
    if (!aguja) return colegios
    return colegios.filter((c) => normalizar(c.nombre).includes(aguja))
  }, [colegios, busqueda])

  const alternar = (idColegio) => {
    const clave = String(idColegio)
    const siguiente = marcados.has(clave)
      ? elegidos.filter((id) => String(id) !== clave)
      : [...elegidos, clave]
    onChange({ todos: false, elegidos: siguiente })
  }

  const vacio = !todos && elegidos.length === 0
  const resumen = resumenDe({ todos, vacio, elegidos: elegidos.length, total: colegios.length })

  useOnEscape(abierto, () => setAbierto(false))

  // Clic fuera del disparador y del panel: lo cierra, como cualquier
  // desplegable. El panel vive DENTRO del mismo contenedor (no en un portal),
  // así que basta con mirar si el clic cayó fuera de él.
  useEffect(() => {
    if (!abierto) return undefined
    const alClicFuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  return (
    <div ref={contenedor} className="relative min-w-0">
      <span id={idEtiqueta} className="mb-1 block text-sm font-medium text-ink-700">
        Colegios
      </span>

      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-labelledby={`${idEtiqueta} ${idBusqueda}-resumen`}
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface-0 px-3 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          vacio ? 'border-danger-600' : 'border-line hover:border-line-strong',
        )}
      >
        <span id={`${idBusqueda}-resumen`} className={cn('truncate', vacio ? 'text-danger-600' : 'text-ink-900')}>
          {resumen}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-ink-400 transition-transform', abierto && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {vacio && !abierto && (
        <p className="mt-1 text-xs text-danger-600">
          Elige al menos un colegio: una selección vacía no equivale a “Todos los colegios”.
        </p>
      )}

      {abierto && (
        <div
          role="dialog"
          aria-labelledby={idEtiqueta}
          className="absolute z-30 mt-1 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-line bg-surface-0 p-3 shadow-card"
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <input
              type="checkbox"
              checked={todos}
              onChange={(e) => onChange({ todos: e.target.checked, elegidos: [] })}
              className="h-4 w-4 rounded border-line-strong text-brand-600"
            />
            {'Todos los colegios'}
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              id={idBusqueda}
              type="search"
              value={busqueda}
              placeholder="Buscar colegio"
              aria-label="Buscar colegio"
              autoFocus
              onChange={(e) => setBusqueda(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface-0 pl-8 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="max-h-44 overflow-y-auto pr-1">
            {visibles.length === 0 ? (
              <p className="px-1 py-2 text-sm text-ink-500">Ningún colegio coincide con la búsqueda.</p>
            ) : (
              visibles.map((colegio) => (
                <label
                  key={colegio.id_colegio}
                  className={cn(
                    'flex items-center gap-2 rounded px-1 py-1 text-sm',
                    todos ? 'text-ink-400' : 'text-ink-700',
                  )}
                >
                  <input
                    type="checkbox"
                    // Con "Todos" marcado, las casillas se ven pero no deciden:
                    // el alcance lo resuelve el servidor.
                    disabled={todos}
                    checked={marcados.has(String(colegio.id_colegio))}
                    onChange={() => alternar(colegio.id_colegio)}
                    className="h-4 w-4 rounded border-line-strong text-brand-600"
                  />
                  {colegio.nombre}
                </label>
              ))
            )}
          </div>

          {vacio && (
            <p className="text-xs text-danger-600">
              Elige al menos un colegio: una selección vacía no equivale a “Todos los colegios”.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
