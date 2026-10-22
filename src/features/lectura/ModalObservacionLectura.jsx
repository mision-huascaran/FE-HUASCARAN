// La observación de una fila de lectura (CU024).
//
// Va en un modal y no en la propia tabla porque la fila ya tiene siete columnas
// y un campo de texto más la haría ilegible en un teléfono, que es donde se usa.
//
// LA OBSERVACIÓN SE ADMITE AUNQUE EL ALUMNO NO ASISTIERA. Es lo contrario que
// con los libros, y tiene sentido: justificar la falta es justo lo que hace
// falta ahí. Lo único que la bloquea es que la tabla entera esté marcada como
// no realizada, porque entonces no hay nada que justificar por alumno.
//
// Vaciar el texto la BORRA: el contrato acepta `null` para eso, y es lo que
// espera quien se equivocó de alumno.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'

export default function ModalObservacionLectura({ fila, guardando, soloLectura = false, onGuardar, onCerrar }) {
  const [texto, setTexto] = useState('')

  // Al abrir con otro alumno hay que repoblar: el modal se reutiliza.
  useEffect(() => {
    if (fila) setTexto(fila.observacion ?? '')
  }, [fila])

  return (
    <Modal
      open={Boolean(fila)}
      onClose={onCerrar}
      title="Observación de la lectura"
      subtitle={fila?.nombre ?? ''}
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
        label="Observación"
        rows={4}
        maxLength={300}
        autoFocus={!soloLectura}
        readOnly={soloLectura}
        value={texto}
        hint={
          soloLectura
            ? undefined
            : 'Se puede registrar aunque el alumno no asistiera. Déjelo vacío para quitarla.'
        }
        onChange={(e) => setTexto(e.target.value)}
      />
    </Modal>
  )
}
