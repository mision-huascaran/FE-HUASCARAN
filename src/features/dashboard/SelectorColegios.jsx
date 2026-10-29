// El selector de colegios del dashboard (CU033, CU034 y CU035).
//
// Los tres CU piden lo mismo y con detalle: "selector múltiple con buscador,
// casillas para elegir uno o varios colegios autorizados y la opción 'Todos los
// colegios'".
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
import { useId, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import cn from '../../lib/cn'

/** Sin tildes ni mayúsculas, como busca el resto del sistema. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export default function SelectorColegios({ colegios = [], todos = true, elegidos = [], onChange }) {
  const [busqueda, setBusqueda] = useState('')
  const idBusqueda = useId()
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

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 block text-sm font-medium text-ink-700">
        Colegios
        <span className="ml-2 text-xs font-normal text-ink-500">
          {todos ? 'Todos los colegios' : `${elegidos.length} de ${colegios.length}`}
        </span>
      </legend>

      <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <input
            type="checkbox"
            checked={todos}
            onChange={(e) => onChange({ todos: e.target.checked, elegidos: [] })}
            className="h-4 w-4 rounded border-line-strong text-brand-600"
          />
          Todos los colegios
        </label>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
          <input
            id={idBusqueda}
            type="search"
            value={busqueda}
            placeholder="Buscar colegio"
            aria-label="Buscar colegio"
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
      </div>

      {vacio && (
        <p className="mt-1 text-xs text-warning-600">
          Elige al menos un colegio: una selección vacía no equivale a “Todos los colegios”.
        </p>
      )}
    </fieldset>
  )
}
