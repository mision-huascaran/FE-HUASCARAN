// CU022 — "Registrar observación en la asistencia".
//
// La observación va en un modal y no en la propia fila por una razón práctica:
// un campo de texto dentro de la tabla la deforma, y esta pantalla se usa en un
// teléfono, de pie, en el aula. El globo de la fila queda resaltado cuando hay
// nota, para verlo de un vistazo sin abrir nada.
//
// Vaciar el texto BORRA la observación: el contrato acepta texto vacío o `null`
// para eso, y es lo que espera quien se equivocó de alumno.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'

export default function ModalObservacion({ alumno, guardando, soloLectura = false, onGuardar, onCerrar }) {
  const [texto, setTexto] = useState('')

  // Al abrir con otro alumno hay que repoblar: el modal se reutiliza.
  useEffect(() => {
    if (alumno) setTexto(alumno.observacion ?? '')
  }, [alumno])

  const nombre = alumno ? `${alumno.nombres} ${alumno.apellidos}` : ''

  return (
    <Modal
      open={Boolean(alumno)}
      onClose={onCerrar}
      title="Observación"
      subtitle={nombre}
      footer={
        soloLectura ? (
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button loading={guardando} onClick={() => onGuardar(texto.trim())}>
              Guardar observación
            </Button>
          </>
        )
      }
    >
      <Textarea
        label="Motivo o justificación"
        rows={4}
        maxLength={300}
        autoFocus={!soloLectura}
        readOnly={soloLectura}
        value={texto}
        hint={soloLectura ? undefined : 'Por ejemplo: falta por enfermedad, tardanza por transporte. Déjelo vacío para quitarla.'}
        onChange={(e) => setTexto(e.target.value)}
      />
    </Modal>
  )
}
