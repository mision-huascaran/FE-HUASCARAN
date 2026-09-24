// Cubre: RF-002
import { KeyRound } from 'lucide-react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

/**
 * Contraseña temporal de una cuenta recién creada (docente o administrativa).
 *
 * El backend solo la devuelve cuando el correo de bienvenida falla; en ese caso
 * es la única copia, así que se muestra una vez y se entrega en mano.
 */
export default function ModalCredencialDocente({ credencial, onCerrar }) {
  return (
    <Modal
      open={Boolean(credencial)}
      onClose={onCerrar}
      title="Entregue esta contraseña"
      subtitle="No se pudo enviar el correo de bienvenida, así que debe dársela usted"
      size="max-w-lg"
      footer={<Button onClick={onCerrar}>Entendido</Button>}
    >
      <div className="flex items-start gap-3 rounded-xl border border-warning-600/20 bg-warning-100 p-4">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="text-ink-700">
            Correo: <span className="font-semibold text-ink-900">{credencial?.correo}</span>
          </p>
          <p className="mt-2 text-ink-700">Contraseña temporal:</p>
          <p className="mt-1 select-all break-all rounded-lg bg-surface-0 px-3 py-2 font-mono text-base font-semibold text-ink-900">
            {credencial?.password}
          </p>
          <p className="mt-3 text-xs text-ink-500">
            Esta contraseña no se vuelve a mostrar. Puede cambiarla desde su propio perfil.
          </p>
        </div>
      </div>
    </Modal>
  )
}
