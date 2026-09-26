// Cubre: RF-012, RF-013, RF-015, RF-016, RN-006, RN-007
import { Plus, Trash2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import Switch from '../../components/ui/Switch'
import Textarea from '../../components/ui/Textarea'
import { totalLibros } from '../../domain/totales'
import { etiquetaDeSemana } from '../../lib/format'

export const libroVacio = () => ({ titulo: '', aciertos: '', total: '' })

/** Reporte semanal de un alumno (P4): asistencia, libros, sala de lectura y observación. */
export default function FormularioSemanal({ semanas, idSemana, onSemana, valores, setValores, cargando, soloLectura }) {
  if (cargando || !valores) return <Skeleton variant="table" rows={4} />
  const editable = !soloLectura && valores.asistio

  const cambiarLibro = (i, campo, valor) =>
    setValores((v) => ({ ...v, libros: v.libros.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)) }))

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Semana"
        value={idSemana}
        onChange={(e) => onSemana(e.target.value)}
        options={semanas.map((s) => ({ value: s.id_semana, label: etiquetaDeSemana(s) }))}
        disabled={soloLectura}
      />

      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-50 p-4">
        <div>
          <p className="text-sm font-semibold text-ink-900">Asistencia</p>
          <p className="text-xs text-ink-500">Sin asistencia no se registran libros ni observación.</p>
        </div>
        <Switch
          checked={valores.asistio}
          onChange={(v) => setValores((s) => ({ ...s, asistio: v }))}
          disabled={soloLectura}
          label="Asistió esta semana"
        />
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">Libros de subir de nivel</p>
            <p className="text-xs text-ink-500">Cada uno con su título y su puntaje (RF-015).</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            iconLeft={Plus}
            disabled={!editable}
            onClick={() => setValores((v) => ({ ...v, libros: [...v.libros, libroVacio()] }))}
          >
            Agregar libro
          </Button>
        </div>

        {valores.libros.length === 0 ? (
          <p className="mt-3 text-xs text-ink-400">Sin libros esta semana. Cero es un valor válido (RN-006).</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {valores.libros.map((libro, i) => (
              <li key={i} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_5rem_5rem_auto]">
                <Input label="Título" value={libro.titulo} disabled={!editable} onChange={(e) => cambiarLibro(i, 'titulo', e.target.value)} />
                <Input label="Aciertos" type="number" min="0" value={libro.aciertos} disabled={!editable} onChange={(e) => cambiarLibro(i, 'aciertos', e.target.value)} />
                <Input label="Total" type="number" min="1" value={libro.total} disabled={!editable} onChange={(e) => cambiarLibro(i, 'total', e.target.value)} />
                <button
                  type="button"
                  aria-label={`Quitar libro ${i + 1}`}
                  disabled={!editable}
                  onClick={() => setValores((v) => ({ ...v, libros: v.libros.filter((_, j) => j !== i) }))}
                  className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-danger-100 hover:text-danger-600 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Sala de lectura"
          type="number"
          min="0"
          value={valores.lsl}
          disabled={!editable}
          onChange={(e) => setValores((v) => ({ ...v, lsl: e.target.value }))}
          hint="Solo la cantidad"
        />
        <div className="flex items-end">
          <p className="mb-2 text-sm text-ink-500">
            Total de la semana:{' '}
            <span className="font-semibold text-ink-900">
              {totalLibros({ asistio: valores.asistio, libros: valores.libros, lsl: valores.lsl })}
            </span>{' '}
            <span className="text-xs">(lo calcula el sistema)</span>
          </p>
        </div>
      </div>

      <Textarea
        label="Observación"
        maxLength={500}
        value={valores.observacion}
        disabled={!editable}
        onChange={(e) => setValores((v) => ({ ...v, observacion: e.target.value }))}
      />
    </div>
  )
}

