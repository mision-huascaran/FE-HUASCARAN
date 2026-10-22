// CU013 — Grados que ofrece el colegio, cada uno con su día de clase.
//
// El contrato cambió de forma, no solo de contenido: `grados` era `[3, 4]` y
// ahora es `[{id_grado: 3, dia_clase: 2}, …]`, con `dia_clase` OBLIGATORIO en
// el alta y en la edición. Mandar la lista de antes responde 422.
//
// Para qué sirve el día: es la fecha límite de la asistencia de ese grado cada
// semana. Un grado sin día configurado no puede vencer, así que no entra en los
// "registros vencidos" del Inicio del Supervisor (CU011).
//
// LOS COLEGIOS ANTIGUOS TRAEN `dia_clase: null`. No se les inventa un lunes por
// defecto: el campo queda sin elegir, marcado como obligatorio, y el formulario
// no deja guardar hasta que alguien decida cuál es.
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import Select from '../../components/ui/Select'
import { DIAS_DE_CLASE, claveDeSeccion, comoGradosConDia, nombreDelDia } from '../../lib/gradosColegio'

/**
 * Las secciones de UN grado. Solo se añaden.
 *
 * El backend no sabe renombrar ni eliminar: las que no vienen en el request se
 * conservan. Así que una sección ya creada —la que tiene `id`— se muestra pero
 * no se puede quitar; una recién escrita, que todavía no existe en ninguna
 * parte, sí, porque quitarla es deshacer el tecleo, no borrar un dato.
 */
function SeccionesDelGrado({ secciones, onCambio }) {
  const [nueva, setNueva] = useState('')

  const agregar = () => {
    const limpio = nueva.trim()
    if (!limpio) return
    // "A", "a" y " a " son la misma sección, también aquí: si no, el
    // formulario deja añadir una que el servidor va a fusionar con otra.
    const repetida = secciones.some((s) => claveDeSeccion(s.nombre) === claveDeSeccion(limpio))
    if (!repetida) onCambio([...secciones, { id: null, nombre: limpio }])
    setNueva('')
  }

  return (
    <div className="mt-2 border-t border-line pt-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Secciones</span>

      <ul className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {secciones.map((s) => (
          <li
            key={s.id ?? `nueva-${s.nombre}`}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-0 px-2.5 py-0.5 text-xs font-semibold text-ink-700"
          >
            {s.nombre}
            {s.id == null && (
              <button
                type="button"
                aria-label={`Quitar ${s.nombre}`}
                className="rounded-full text-ink-400 transition-colors hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                onClick={() => onCambio(secciones.filter((x) => x !== s))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
        {secciones.length === 0 && <li className="text-xs text-ink-400">Ninguna todavía</li>}
      </ul>

      <div className="mt-1.5 flex items-center gap-1.5">
        <input
          type="text"
          value={nueva}
          maxLength={20}
          placeholder="Añadir sección"
          aria-label="Nombre de la sección"
          className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-0 px-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          onChange={(e) => setNueva(e.target.value)}
          // Enter añade, pero NO envía el formulario entero.
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            agregar()
          }}
        />
        <button
          type="button"
          onClick={agregar}
          disabled={!nueva.trim()}
          aria-label="Añadir sección"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-700 transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default function GradosConDiaDeClase({ campo, valor, onCambio, modo, error }) {
  const opciones = campo.opciones ?? []
  const elegidos = comoGradosConDia(valor)
  const porId = new Map(elegidos.map((g) => [g.id_grado, g]))
  const soloLectura = modo === 'ver'

  const alternar = (idGrado) => {
    const id = Number(idGrado)
    // Se respeta el orden de las opciones (1.º, 2.º…), no el del clic.
    const siguiente = opciones
      .map((o) => Number(o.value))
      .filter((v) => (v === id ? !porId.has(v) : porId.has(v)))
      .map((v) => porId.get(v) ?? { id_grado: v, dia_clase: null })
    onCambio(campo.nombre, siguiente)
  }

  const ponerDia = (idGrado, dia) =>
    onCambio(
      campo.nombre,
      elegidos.map((g) => (g.id_grado === Number(idGrado) ? { ...g, dia_clase: dia ? Number(dia) : null } : g)),
    )

  const ponerSecciones = (idGrado, secciones) =>
    onCambio(
      campo.nombre,
      elegidos.map((g) => (g.id_grado === Number(idGrado) ? { ...g, secciones } : g)),
    )

  if (soloLectura) {
    return (
      <div className="md:col-span-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{campo.etiqueta}</span>
        {elegidos.length === 0 ? (
          <p className="mt-1 text-sm text-ink-400">—</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {elegidos.map((g) => (
              <li
                key={g.id_grado}
                className="rounded-lg border border-brand-600/30 bg-brand-100 px-3 py-1 text-sm text-brand-700"
              >
                <span className="font-semibold">
                  {opciones.find((o) => String(o.value) === String(g.id_grado))?.label ?? g.id_grado}
                </span>
                <span className="ml-2 text-xs">{nombreDelDia(g.dia_clase) ?? 'sin día de clase'}</span>
                <span className="ml-2 text-xs">
                  · {g.secciones.length ? g.secciones.map((s) => s.nombre).join(', ') : 'sin secciones'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2 md:col-span-2">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
        {campo.etiqueta}
        {campo.requerido && <span className="ml-1 text-danger-500">*</span>}
      </legend>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {opciones.map((o) => {
          const marcado = porId.has(Number(o.value))
          const grado = porId.get(Number(o.value))
          return (
            <div
              key={o.value}
              className={`rounded-lg border px-3 py-2 transition-colors ${
                marcado ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface-0'
              }`}
            >
              <div className="flex items-center gap-3">
              <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-sm font-semibold text-ink-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={marcado}
                  onChange={() => alternar(o.value)}
                />
                {o.label}
              </label>

              {/* El día aparece SOLO cuando el grado está marcado: pedirlo para
                  un grado que el colegio no ofrece no significa nada. */}
              {marcado && (
                <Select
                  label="Día de clase"
                  className="min-w-0 flex-1"
                  value={grado?.dia_clase ? String(grado.dia_clase) : ''}
                  placeholder="Seleccione"
                  options={DIAS_DE_CLASE}
                  error={!grado?.dia_clase ? 'Obligatorio' : undefined}
                  onChange={(e) => ponerDia(o.value, e.target.value)}
                />
              )}
              </div>

              {/* Las secciones, igual que el día: solo si el grado está
                  marcado. Un grado que el colegio no ofrece no tiene aulas. */}
              {marcado && (
                <SeccionesDelGrado
                  secciones={grado?.secciones ?? []}
                  onCambio={(secciones) => ponerSecciones(o.value, secciones)}
                />
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
    </fieldset>
  )
}
