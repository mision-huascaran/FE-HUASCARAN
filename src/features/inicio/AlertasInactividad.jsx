// CU011 — Alertas Operativas del Supervisor.
//
// El contrato las entrega como `{tipo, mensaje, critica}` y el mensaje viene
// YA REDACTADO ("Sincronización Olvidada - Luis Mendoza: Registros vencidos,
// último inicio de sesión hace más de 3 días."). Se pinta tal cual: anteponerle
// un "Atención:" nuestro duplicaba el encabezado que ya trae.
//
// Solo las CRÍTICAS van en rojo, y nunca solo con color: CU011 exige que el
// color vaya acompañado de icono y etiqueta, porque quien no lo distingue se
// quedaría sin la alerta. Las no críticas van en ámbar, que las diferencia sin
// gritar.
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

const CRITICA = {
  caja: 'border-danger-600/20 bg-danger-100 text-danger-600',
  icono: AlertTriangle,
  etiqueta: 'Crítica',
}

const NORMAL = {
  caja: 'border-warning-600/20 bg-warning-100 text-ink-700',
  icono: Info,
  etiqueta: 'Aviso',
}

export default function AlertasInactividad({ alertas = [], desactualizadas = false }) {
  if (!alertas.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success-600/20 bg-success-100 px-4 py-3 text-sm text-success-600">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>No existen alertas operativas pendientes de atención.</span>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2" aria-label="Alertas operativas">
      {alertas.map((alerta, i) => {
        const tono = alerta.critica ? CRITICA : NORMAL
        const Icono = tono.icono
        return (
          <li
            key={`${alerta.tipo}-${i}`}
            className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${tono.caja}`}
          >
            <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-semibold">{`${tono.etiqueta}: `}</strong>
              {alerta.mensaje}
              {desactualizadas && <span className="ml-1 text-xs text-ink-500">(puede estar desactualizada)</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
