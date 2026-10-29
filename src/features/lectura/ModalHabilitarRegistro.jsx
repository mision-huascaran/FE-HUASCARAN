// "Habilitar registro de lectura" (CU026, tanda D).
//
// Deshace la declaración de "no realizada" para poder registrar la semana. NO
// BORRA la justificación anterior: queda en el historial con el motivo de esta
// corrección, quién la hizo y cuándo. Eso es lo que permite que el Supervisor
// que revise después sepa que la semana estuvo declarada y por qué dejó de
// estarlo; sin el rastro, revertir sería indistinguible de no haber declarado
// nunca.
//
// Y NO AMPLÍA EL PLAZO: si la semana ya venció, la tabla vuelve a contar como
// vencida en CU011. Por eso el mensaje habla de registrar, no de "reabrir".
//
// Igual que los demás modales que recogen datos (D78): pulsar fuera no cierra,
// y con el motivo escrito se pregunta antes de descartarlo.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'

/** El mensaje de CU026, literal. */
export const AVISO_HABILITAR =
  'La lectura dejará de figurar como no realizada. Podrás registrar los datos de los alumnos según sus asistencias. La justificación anterior se conservará en el historial.'

export default function ModalHabilitarRegistro({ open, guardando, error, onConfirmar, onCerrar }) {
  const [motivo, setMotivo] = useState('')
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  // Al cerrarse se olvida: si no, la siguiente semana aparecería con el motivo
  // de la anterior ya escrito.
  useEffect(() => {
    if (!open) {
      setMotivo('')
      setConfirmandoDescarte(false)
    }
  }, [open])

  const cancelar = () => (motivo.trim() ? setConfirmandoDescarte(true) : onCerrar())

  return (
    <Modal
      open={open}
      // Mientras procesa no se puede cerrar: la operación puede haberse
      // aplicado ya, y cerrar daría a entender que no.
      onClose={guardando ? () => {} : cancelar}
      cierreExterior={false}
      title="Habilitar registro de lectura"
      size="max-w-lg"
      footer={
        confirmandoDescarte ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmandoDescarte(false)}>
              Continuar completando
            </Button>
            <Button variant="danger" onClick={onCerrar}>
              Descartar datos
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={cancelar} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              loading={guardando}
              disabled={!motivo.trim() || guardando}
              onClick={() => onConfirmar(motivo.trim())}
            >
              Confirmar
            </Button>
          </>
        )
      }
    >
      {confirmandoDescarte ? (
        <p className="text-sm text-ink-700">Tienes datos sin guardar. ¿Deseas descartarlos?</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-700">{AVISO_HABILITAR}</p>

          <Textarea
            label="Motivo de la corrección"
            required
            rows={4}
            maxLength={300}
            autoFocus
            value={motivo}
            // El error del servidor manda: llega en `errores[].campo = "motivo"`
            // con "Ingresa el motivo de la corrección."
            error={error}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </>
      )}
    </Modal>
  )
}
