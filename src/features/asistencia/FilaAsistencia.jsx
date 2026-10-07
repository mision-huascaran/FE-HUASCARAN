// Una fila de la grilla de asistencia (T30).
import { Check, X } from 'lucide-react'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'

export default function FilaAsistencia({ fila, soloLectura, onCambio }) {
  return (
    <tr className="border-t border-line">
      <td className="px-4 py-3">
        <span className="font-medium text-ink-900">{fila.nombre}</span>
        <span className="ml-2 text-xs text-ink-400">{fila.codigo}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant={fila.presente === true ? 'primary' : 'ghost'}
            iconLeft={Check}
            disabled={soloLectura}
            aria-label={`Marcar presente a ${fila.nombre}`}
            onClick={() => onCambio(fila.id_alumno, { presente: true })}
          >
            Presente
          </Button>
          <Button
            size="sm"
            variant={fila.presente === false ? 'danger' : 'ghost'}
            iconLeft={X}
            disabled={soloLectura}
            aria-label={`Marcar ausente a ${fila.nombre}`}
            onClick={() => onCambio(fila.id_alumno, { presente: false })}
          >
            Ausente
          </Button>
        </div>
      </td>
      <td className="px-4 py-3">
        <Textarea
          rows={1}
          maxLength={200}
          disabled={soloLectura}
          aria-label={`Observación de ${fila.nombre}`}
          value={fila.observacion ?? ''}
          onChange={(e) => onCambio(fila.id_alumno, { observacion: e.target.value })}
        />
      </td>
    </tr>
  )
}
