// Los colegios de un Docente, con sus grados y su inicio de asignación (CU016, D67).
//
// UN DOCENTE PUEDE ATENDER VARIOS COLEGIOS. El formulario anterior admitía uno
// solo: al editar a quien tenía dos, el segundo no se veía, y al guardar se lo
// quitaba sin que nadie lo pidiera, porque en la edición `colegios` es la
// lista COMPLETA del año.
//
// Y EL INICIO DE ASIGNACIÓN ES POR COLEGIO, no del formulario. Cada colegio
// tiene su calendario: uno puede estar en un PA y otro en receso, y durante un
// receso asignar significa dos cosas distintas —entrar a regularizar el
// periodo que acaba de terminar, o empezar en el que viene—. Por eso el bloque
// aparece solo en los colegios que hoy están en un PR, uno por colegio y con
// su propia respuesta.
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { formatearFecha } from '../../lib/format'

/** Las dos opciones del CU, con "Próximo" fuera en el PR4. */
export function opcionesDeInicio(receso) {
  if (!receso) return []
  return [
    { value: 'retroactivo', label: 'Retroactivo' },
    {
      value: 'proximo',
      label: 'Próximo',
      // En el PR4 no existe un PA siguiente: el backend lo rechaza pidiendo
      // que se elija el año escolar que viene. Se deshabilita en vez de
      // dejarlo elegir para un 422 seguro.
      disabled: Boolean(receso.es_pr4),
    },
  ]
}

/** El texto de ayuda del bloque, según en qué receso esté el colegio. */
function ayudaDelReceso(receso) {
  const hasta = receso.fecha_fin ? ` hasta el ${formatearFecha(receso.fecha_fin)}` : ''
  return receso.es_pr4
    ? `Este colegio está en receso (PR${receso.numero})${hasta}. Para asignarlo al año siguiente, cambia el año escolar.`
    : `Este colegio está en receso (PR${receso.numero})${hasta}.`
}

export default function ColegiosDelDocente({ campo, valor, onCambio, modo, error }) {
  const soloLectura = modo === 'ver'
  const colegios = Array.isArray(valor) ? valor : []
  const { opciones = [], gradosDe, recesoDe, erroresPorIndice = {} } = campo

  const actualizar = (i, cambio) =>
    onCambio(campo.nombre, colegios.map((c, n) => (n === i ? { ...c, ...cambio } : c)))

  const quitar = (i) => onCambio(campo.nombre, colegios.filter((_, n) => n !== i))

  const agregar = () => onCambio(campo.nombre, [...colegios, { id_colegio: '', grados: [], inicio_asignacion: '' }])

  // Un colegio ya elegido no se vuelve a ofrecer: repetirlo es un 422
  // (`asignacion.colegios.{i}.id_colegio`) y no tendría sentido.
  const disponibles = (i) =>
    opciones.filter((o) => !colegios.some((c, n) => n !== i && String(c.id_colegio) === String(o.value)))

  if (soloLectura) {
    return (
      <div className="md:col-span-2">
        <p className="text-xs uppercase tracking-wide text-ink-500">{campo.etiqueta}</p>
        {colegios.length === 0 ? (
          <p className="mt-1 text-sm text-ink-500">Sin colegios asignados</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1 text-sm text-ink-900">
            {colegios.map((c, i) => (
              <li key={`${c.id_colegio}-${i}`}>
                {opciones.find((o) => String(o.value) === String(c.id_colegio))?.label ?? c.nombre ?? '—'}
                <span className="ml-2 text-ink-500">
                  {(c.grados ?? [])
                    .map((g) => gradosDe?.().find((x) => String(x.value) === String(g))?.label ?? g)
                    .join(', ') || 'todos los grados'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="md:col-span-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-ink-700">
          {campo.etiqueta}
          {campo.requerido && <span className="ml-1 font-semibold text-danger-600">*</span>}
        </span>
        <Button size="sm" variant="outline" iconLeft={Plus} onClick={agregar} disabled={!disponibles(-1).length}>
          Añadir colegio
        </Button>
      </div>

      {colegios.length === 0 && (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-500">
          Un Docente necesita al menos un colegio asignado.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {colegios.map((c, i) => {
          const receso = recesoDe?.(c.id_colegio)
          return (
            <div key={`bloque-${i}`} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px] flex-1">
                  <Select
                    label="Colegio"
                    required
                    placeholder="Seleccione"
                    value={c.id_colegio ?? ''}
                    options={disponibles(i)}
                    error={erroresPorIndice[`${i}.id_colegio`]}
                    onChange={(e) => actualizar(i, { id_colegio: e.target.value, grados: [], inicio_asignacion: '' })}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={Trash2}
                  aria-label={`Quitar el colegio ${i + 1}`}
                  className="text-danger-600"
                  onClick={() => quitar(i)}
                >
                  Quitar
                </Button>
              </div>

              <fieldset className="mt-3">
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Grados
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {(gradosDe?.(c.id_colegio) ?? []).map((g) => {
                    const puestos = (c.grados ?? []).map(String)
                    const marcado = puestos.includes(String(g.value))
                    return (
                      <label key={g.value} className="flex items-center gap-1.5 text-sm text-ink-700">
                        <input
                          type="checkbox"
                          checked={marcado}
                          aria-label={`${g.label} en el colegio ${i + 1}`}
                          onChange={() =>
                            actualizar(i, {
                              // Se respeta el orden de los grados, no el del clic.
                              grados: (gradosDe?.(c.id_colegio) ?? [])
                                .map((o) => String(o.value))
                                .filter((v) => (v === String(g.value) ? !marcado : puestos.includes(v))),
                            })
                          }
                        />
                        {g.label}
                      </label>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Un aula (colegio y grado) solo puede tener un docente. Sin ninguno marcado, el servidor decide.
                </p>
                {erroresPorIndice[`${i}.grados`] && (
                  <p className="mt-1 text-sm text-danger-600">{erroresPorIndice[`${i}.grados`]}</p>
                )}
              </fieldset>

              {/*
                El bloque del receso: solo para los colegios que HOY están en
                un PR. En un PA no hay ambigüedad y el servidor lo ignora.
              */}
              {receso && (
                <div className="mt-3 rounded-lg bg-surface-100 p-3">
                  <Select
                    label="Inicio de asignación"
                    required
                    placeholder="Seleccione"
                    value={c.inicio_asignacion ?? ''}
                    options={opcionesDeInicio(receso)}
                    error={erroresPorIndice[`${i}.inicio_asignacion`]}
                    hint={ayudaDelReceso(receso)}
                    onChange={(e) => actualizar(i, { inicio_asignacion: e.target.value })}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
    </div>
  )
}
