// Un campo del popup de mantenimiento, según su tipo.
//
// En modo "ver" TODOS los campos van bloqueados (S3), y en "editar" solo los
// que la sección declare `soloLectura`. El bloqueo se decide aquí y no en cada
// pantalla, para que los tres modos se comporten igual en Alumnos, Usuarios y
// Colegios.
import Input from '../ui/Input'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'

export default function CampoMantenimiento({ campo, valor, onCambio, modo, error }) {
  // Una sección puede traer su propio componente cuando el dato no cabe en un
  // input: por ejemplo los grados y secciones de un colegio, que son una lista.
  if (campo.componente) {
    const Propio = campo.componente
    return <Propio campo={campo} valor={valor} onCambio={onCambio} modo={modo} error={error} />
  }

  const bloqueado = modo === 'ver' || campo.soloLectura || (modo === 'editar' && campo.soloAlCrear)
  const comun = {
    label: campo.etiqueta,
    required: campo.requerido && modo !== 'ver',
    disabled: bloqueado,
    error,
    hint: campo.ayuda,
    className: campo.ancho === 'completo' ? 'md:col-span-2' : undefined,
  }

  if (campo.tipo === 'select') {
    return (
      <Select
        {...comun}
        value={valor ?? ''}
        placeholder={campo.placeholder ?? 'Seleccione'}
        options={campo.opciones ?? []}
        onChange={(e) => onCambio(campo.nombre, e.target.value)}
      />
    )
  }

  if (campo.tipo === 'multiple') {
    return <SeleccionMultiple campo={campo} valor={valor} onCambio={onCambio} modo={modo} error={error} bloqueado={bloqueado} />
  }

  if (campo.tipo === 'textarea') {
    return (
      <Textarea
        {...comun}
        className="md:col-span-2"
        maxLength={campo.maximo ?? 500}
        value={valor ?? ''}
        onChange={(e) => onCambio(campo.nombre, e.target.value)}
      />
    )
  }

  return (
    <Input
      {...comun}
      type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'email' ? 'email' : 'text'}
      value={valor ?? ''}
      onChange={(e) => onCambio(campo.nombre, e.target.value)}
    />
  )
}

/**
 * Varias opciones a la vez (grados de un docente, grados de un colegio), como
 * recuadros que se marcan y desmarcan con un clic.
 *
 * Antes era un <select multiple> nativo: para elegir más de uno había que
 * mantener Ctrl, y un clic suelto borraba la selección anterior sin avisar.
 * Cada recuadro es una casilla real (`checkbox`), así que se maneja también con
 * teclado (Tab + Espacio) y los lectores de pantalla la anuncian como tal.
 */
function SeleccionMultiple({ campo, valor, onCambio, modo, error, bloqueado }) {
  const opciones = campo.opciones ?? []
  const seleccion = Array.isArray(valor) ? valor.map(String) : []
  const marcados = new Set(seleccion)
  const todos = opciones.length > 0 && opciones.every((o) => marcados.has(String(o.value)))

  const alternar = (valorOpcion) => {
    const clave = String(valorOpcion)
    // Se respeta el orden de las opciones (1.º, 2.º…), no el del clic.
    const siguiente = opciones
      .map((o) => String(o.value))
      .filter((v) => (v === clave ? !marcados.has(v) : marcados.has(v)))
    onCambio(campo.nombre, siguiente)
  }

  return (
    <fieldset className={`flex min-w-0 flex-col gap-1.5 ${campo.ancho === 'completo' ? 'md:col-span-2' : ''}`}>
      <legend className="mb-1.5 flex w-full items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {campo.etiqueta}
          {campo.requerido && modo !== 'ver' && <span className="ml-1 text-danger-500">*</span>}
        </span>
        {!bloqueado && opciones.length > 1 && (
          <button
            type="button"
            onClick={() => onCambio(campo.nombre, todos ? [] : opciones.map((o) => String(o.value)))}
            className="rounded text-xs font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {todos ? 'Quitar todos' : 'Marcar todos'}
          </button>
        )}
      </legend>

      {opciones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-400">Sin opciones disponibles</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {opciones.map((o) => {
            const marcado = marcados.has(String(o.value))
            return (
              <label
                key={o.value}
                className={[
                  'flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors',
                  'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-1',
                  marcado
                    ? 'border-brand-600 bg-brand-100 text-brand-700'
                    : 'border-line bg-surface-0 text-ink-700 hover:border-brand-500/60 hover:bg-surface-50',
                  bloqueado ? 'cursor-not-allowed opacity-60' : '',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-brand-600"
                  checked={marcado}
                  disabled={bloqueado}
                  onChange={() => alternar(o.value)}
                />
                {o.label}
              </label>
            )
          })}
        </div>
      )}

      {campo.ayuda && <span className="text-xs text-ink-400">{campo.ayuda}</span>}
      {error && <span className="text-xs font-medium text-danger-600">{error}</span>}
    </fieldset>
  )
}
