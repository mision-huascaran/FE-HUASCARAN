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
import Select from '../../components/ui/Select'
import { DIAS_DE_CLASE, comoGradosConDia, nombreDelDia } from '../../lib/gradosColegio'

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
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                marcado ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface-0'
              }`}
            >
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
          )
        })}
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}
    </fieldset>
  )
}
