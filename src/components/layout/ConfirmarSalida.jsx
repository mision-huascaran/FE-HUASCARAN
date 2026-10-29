// CU007 — Salir con cambios pendientes de sincronizar.
//
// El cierre de sesión NUNCA borra la cola, pero el docente no tiene cómo
// saberlo: sin este aviso se iría del aula creyendo que perdió el trabajo del
// día. Se le dice qué pasa con sus cambios y se le deja decidir.
import { CloudOff } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export default function ConfirmarSalida({ abierto, pendientes, onSalir, onCerrar }) {
  // D62 — "Quedan 1 cambio… llegaron": la concordancia va entera, no solo la "s".
  const uno = pendientes === 1

  return (
    <Modal
      open={abierto}
      onClose={onCerrar}
      title="Tienes cambios sin sincronizar"
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
            {uno ? 'Queda' : 'Quedan'} <strong>{uno ? '1 cambio' : `${pendientes} cambios`}</strong>{' '}
            {uno ? 'guardado' : 'guardados'} en este dispositivo que todavía no {uno ? 'llegó' : 'llegaron'} al
            servidor.
          </p>
          <p className="mt-2">
            <strong>No se van a perder.</strong> Se conservan aquí y se enviarán solos la próxima vez que
            inicies sesión con conexión.
          </p>
        </div>
      </div>
    </Modal>
  )
}
