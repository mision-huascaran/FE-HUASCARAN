// "La lectura de esta semana no se realizó" (CU026).
//
// El motivo es OBLIGATORIO y no por formalismo: marcar la semana pone todas sus
// filas en "no aplica", así que deja de constar como trabajo pendiente del
// docente. Sin una justificación escrita, el Supervisor que revisa después no
// tendría forma de distinguir una semana perdida por un paro de transportistas
// de una que simplemente no se registró.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'

export default function ModalNoRealizada({ open, guardando, onGuardar, onCerrar }) {
  const [motivo, setMotivo] = useState('')

  // Al cerrarse se olvida: si no, la siguiente semana aparecería con la
  // justificación de la anterior ya escrita.
  useEffect(() => {
    if (!open) setMotivo('')
  }, [open])

  const vacio = !motivo.trim()

  return (
    <Modal
      open={open}
      onClose={onCerrar}
      title="Marcar la lectura como no realizada"
      subtitle="Las filas de la semana quedarán en «No aplica» y no contarán como pendientes."
      size="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          {/* Deshabilitado mientras no haya motivo: el servidor lo rechazaría
              con un 422 y es una ida y vuelta que no hace falta. */}
          <Button variant="danger" disabled={vacio} loading={guardando} onClick={() => onGuardar(motivo.trim())}>
            Marcar como no realizada
          </Button>
        </div>
      }
    >
      <Textarea
        label="Motivo"
        required
        rows={4}
        value={motivo}
        placeholder="Por ejemplo: paro de transportistas, suspensión de clases, actividad del colegio."
        onChange={(e) => setMotivo(e.target.value)}
        hint="Solo se puede marcar mientras no haya libros registrados en la semana."
      />
    </Modal>
  )
}
