// CU011 / CU012 — Aviso de que el resumen viene de la copia local.
//
// Sin conexión se muestra el último resumen guardado, pero hay que decir que
// puede estar desactualizado: tomar una decisión con números viejos creyéndolos
// de hoy es peor que no verlos.
import { WifiOff } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'

export default function AvisoDatosLocales({ sinDatos = false }) {
  if (sinDatos) {
    return (
      <EmptyState
        icon={WifiOff}
        title="No hay información disponible sin conexión"
        description="Todavía no se ha guardado ningún resumen en este dispositivo. Conéctese para verlo por primera vez."
      />
    )
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-warning-600"
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Sin conexión: se muestra el último resumen guardado y <strong>puede estar desactualizado</strong>.
      </span>
    </div>
  )
}
