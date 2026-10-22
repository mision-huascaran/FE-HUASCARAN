// Los registros que el servidor rechazó al sincronizar, cada uno con su
// `detail`. Un `modificacion_concurrente` (otra persona guardó antes) ofrece
// "Cargar versión actual"; los demás, "Descartar". Las dos acciones descartan
// la operación en el servidor, que así deja de contar como error.
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'
import useRechazosStore from '../../store/rechazosStore'
import { cargarVersionActual, descartarRechazo } from '../../lib/registrosOffline'

/** @param modulo 'lectura' | 'rubrica' | 'vuelo'; sin él, todos (panel de sincronización). */
export default function AvisoConflictos({ modulo }) {
  const rechazos = useRechazosStore((s) => s.rechazos)
  const [cargando, setCargando] = useState(null)
  const visibles = modulo ? rechazos.filter((r) => r.modulo === modulo) : rechazos
  if (!visibles.length) return null

  const resolver = async (rechazo) => {
    setCargando(rechazo.clave)
    try {
      await (rechazo.motivo === 'modificacion_concurrente'
        ? cargarVersionActual(rechazo.clave)
        : descartarRechazo(rechazo.clave))
    } finally {
      setCargando(null)
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700"
    >
      {visibles.map((r) => (
        <div key={r.clave} className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
            <span>
              {r.nombre ? <strong>{r.nombre}: </strong> : null}
              {r.detail}
            </span>
          </span>
          <Button size="sm" variant="secondary" loading={cargando === r.clave} onClick={() => resolver(r)}>
            {r.motivo === 'modificacion_concurrente' ? 'Cargar versión actual' : 'Descartar'}
          </Button>
        </div>
      ))}
    </div>
  )
}
