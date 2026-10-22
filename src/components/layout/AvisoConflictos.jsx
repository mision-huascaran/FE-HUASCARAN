// Los registros que otra persona cambió antes de que se guardara el del
// docente (`modificacion_concurrente`), cada uno con su "Cargar versión actual".
import { AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'

export default function AvisoConflictos({ conflictos = [], cargando, onCargar }) {
  if (!conflictos.length) return null
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700"
    >
      {conflictos.map((c) => (
        <div key={c.clave} className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <span>
              {c.nombre ? <strong>{c.nombre}: </strong> : null}
              {c.detail}
            </span>
          </span>
          <Button size="sm" variant="secondary" loading={cargando === c.clave} onClick={() => onCargar(c.clave)}>
            Cargar versión actual
          </Button>
        </div>
      ))}
    </div>
  )
}
