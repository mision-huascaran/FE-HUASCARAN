// Varias opciones a la vez, con casillas (CU028, lote de permisos).
//
// NO es un `<select multiple>`: en un desplegable nativo hay que saber que se
// mantiene pulsado Ctrl, y quien no lo sabe cree que solo puede elegir una.
// Aquí cada opción es una casilla visible, que además permite marcar el grupo
// entero de una pasada —"todos los módulos" es lo que se pide la mitad de las
// veces— y leer de un vistazo cuántas van elegidas.
//
// Las opciones pueden venir agrupadas (`grupo`), que es lo que distingue los
// grados del Docente de los demás. Agrupar no es filtrar: todas siguen ahí.
import { Check } from 'lucide-react'
import cn from '../../lib/cn'

/** Las opciones por grupo, conservando el orden en que llegaron. */
function porGrupo(opciones) {
  const grupos = new Map()
  for (const opcion of opciones) {
    const clave = opcion.grupo ?? ''
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(opcion)
  }
  return [...grupos.entries()]
}

export default function SelectorMultiple({
  label,
  required,
  valores = [],
  opciones = [],
  error,
  hint,
  deshabilitado = false,
  /** Lo que se dice cuando no hay nada que elegir todavía. */
  vacio = 'Sin opciones',
  onChange,
}) {
  const elegidos = new Set(valores.map(String))

  const alternar = (valor) => {
    const clave = String(valor)
    const siguiente = elegidos.has(clave)
      ? valores.filter((v) => String(v) !== clave)
      : [...valores, valor]
    onChange(siguiente)
  }

  const grupos = porGrupo(opciones)

  return (
    <fieldset disabled={deshabilitado} className="min-w-0">
      <legend className="mb-1 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
        {elegidos.size > 0 && <span className="ml-2 text-xs font-normal text-ink-500">{elegidos.size} elegidos</span>}
      </legend>

      {opciones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-500">{vacio}</p>
      ) : (
        <div
          className={cn(
            'flex flex-col gap-2 rounded-lg border px-3 py-2',
            error ? 'border-danger-600' : 'border-line',
            deshabilitado && 'opacity-60',
          )}
        >
          {grupos.map(([nombre, suyas]) => (
            <div key={nombre || 'sin-grupo'} className="flex flex-col gap-1">
              {nombre && (
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{nombre}</span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {suyas.map((opcion) => {
                  const puesto = elegidos.has(String(opcion.value))
                  // Una casilla NATIVA con aspecto de chip: el lector de
                  // pantalla y el teclado (Espacio) la tratan como lo que es.
                  return (
                    <label
                      key={opcion.value}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500',
                        puesto
                          ? 'border-brand-600 bg-brand-100 font-semibold text-brand-700'
                          : 'border-line bg-surface-0 text-ink-700 hover:bg-surface-50',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={puesto}
                        onChange={() => alternar(opcion.value)}
                      />
                      {puesto && <Check className="h-3.5 w-3.5" aria-hidden />}
                      {opcion.label}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="mt-1 text-xs text-danger-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>
      )}
    </fieldset>
  )
}
