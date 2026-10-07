// CU007 — Salir con cambios pendientes de sincronizar.
//
// El cierre de sesión NUNCA borra la cola, pero el docente no tiene cómo
// saberlo: sin este aviso se iría del aula creyendo que perdió el trabajo del
// día. Se le dice qué pasa con sus cambios y se le deja decidir.
import { CloudOff } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export default function ConfirmarSalida({ abierto, pendientes, onSalir, onCerrar }) {
  const plural = pendientes === 1 ? '' : 's'

  return (
    <Modal
      open={abierto}
      onClose={onCerrar}
      title="Tiene cambios sin sincronizar"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Seguir trabajando
          </Button>
          <Button onClick={onSalir}>Finalizar sesión igualmente</Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
        <div className="text-sm text-ink-700">
          <p>
            Quedan <strong>{pendientes} cambio{plural}</strong> guardado{plural} en este dispositivo que todavía
            no llegaron al servidor.
          </p>
          <p className="mt-2">
            <strong>No se van a perder.</strong> Se conservan aquí y se enviarán solos la próxima vez que
            inicie sesión con conexión.
          </p>
        </div>
      </div>
    </Modal>
  )
}
