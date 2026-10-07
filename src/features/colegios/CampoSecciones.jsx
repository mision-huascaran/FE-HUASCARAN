// Grados y secciones de un colegio, como estructura y no como texto libre.
//
// Antes era un textarea donde el Supervisor escribía "1.º — A, B" y nadie podía
// usar ese dato: no se puede asignar un alumno a una sección que solo existe
// dentro de una frase. Aquí cada sección es una entrada con su grado.
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

export default function CampoSecciones({ campo, valor, onCambio, modo }) {
  const bloqueado = modo === 'ver'
  const secciones = Array.isArray(valor) ? valor : []

  const cambiarUna = (indice, cambios) =>
    onCambio(
      campo.nombre,
      secciones.map((s, i) => (i === indice ? { ...s, ...cambios } : s)),
    )

  return (
    <div className="md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{campo.etiqueta}</span>

      <ul className="mt-2 flex flex-col gap-2">
        {secciones.map((seccion, indice) => (
          <li key={`${seccion.id_grado}-${seccion.nombre}-${indice}`} className="flex items-end gap-2">
            <Select
              label="Grado"
              className="w-36"
              disabled={bloqueado}
              value={seccion.id_grado ?? ''}
              options={campo.grados ?? []}
              onChange={(e) => cambiarUna(indice, { id_grado: e.target.value })}
            />
            <Input
              label="Sección"
              className="w-28"
              maxLength={4}
              disabled={bloqueado}
              value={seccion.nombre ?? ''}
              placeholder="A"
              onChange={(e) => cambiarUna(indice, { nombre: e.target.value.toUpperCase() })}
            />
            {!bloqueado && (
              <Button
                size="sm"
                variant="ghost"
                iconLeft={Trash2}
                className="mb-1 text-danger-600"
                aria-label={`Quitar la sección ${seccion.nombre || indice + 1}`}
                onClick={() => onCambio(campo.nombre, secciones.filter((_, i) => i !== indice))}
              >
                Quitar
              </Button>
            )}
          </li>
        ))}
      </ul>

      {secciones.length === 0 && (
        <p className="mt-2 text-sm text-ink-400">Todavía no hay secciones registradas.</p>
      )}

      {!bloqueado && (
        <Button
          size="sm"
          variant="ghost"
          iconLeft={Plus}
          className="mt-2"
          onClick={() => onCambio(campo.nombre, [...secciones, { id_grado: '', nombre: '' }])}
        >
          Añadir sección
        </Button>
      )}
    </div>
  )
}
