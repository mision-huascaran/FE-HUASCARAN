// La observación de una decisión del Registro de Vuelo (CU031).
//
// Es uno de los tres campos que el docente SÍ escribe —los otros son el nivel
// colocado y la proyección—, y va en un modal porque la fila ya tiene ocho
// columnas. Vaciarla la BORRA: el contrato acepta `null` para eso.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'

export default function ModalObservacionVuelo({ contexto, guardando, soloLectura = false, onGuardar, onCerrar }) {
  const [texto, setTexto] = useState('')

  // El modal se reutiliza para cada alumno: hay que repoblarlo al abrir.
  useEffect(() => {
    if (contexto) setTexto(contexto.periodo?.observacion ?? '')
  }, [contexto])

  const titulo = contexto
    ? [contexto.alumno?.nombre, `PA${contexto.periodo?.numero}`].filter(Boolean).join(' · ')
    : ''

  return (
    <Modal
      open={Boolean(contexto)}
      onClose={onCerrar}
      title="Observación de la decisión"
      subtitle={titulo}
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
            : 'Por ejemplo: por qué se colocó un nivel distinto del sugerido. Déjalo vacío para quitarla.'
        }
        onChange={(e) => setTexto(e.target.value)}
      />
    </Modal>
  )
}
