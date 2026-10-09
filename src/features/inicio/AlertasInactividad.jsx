// CU011 — Alertas de Inactividad del Supervisor.
//
// Se destacan en rojo, pero NUNCA solo con color: el caso de uso exige que el
// color vaya acompañado de icono y texto, porque quien no distingue el rojo se
// quedaría sin la alerta.
//
// Los umbrales (4 días sin actividad, una semana sin registros) son
// configurables y llegan con la alerta desde el servidor: no se codifican aquí.
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function AlertasInactividad({ alertas = [], desactualizadas = false }) {
  if (!alertas.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success-600/20 bg-success-100 px-4 py-3 text-sm text-success-600">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>No existen alertas de inactividad pendientes de atención.</span>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Alertas de inactividad">
      {alertas.map((alerta) => (
        <li
          key={alerta.id ?? `${alerta.tipo}-${alerta.mensaje}`}
          className="flex items-start gap-2 rounded-xl border border-danger-600/20 bg-danger-100 px-4 py-3 text-sm text-danger-600"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Atención:</strong> {alerta.mensaje}
            {desactualizadas && <span className="ml-1 text-xs text-ink-500">(puede estar desactualizada)</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
