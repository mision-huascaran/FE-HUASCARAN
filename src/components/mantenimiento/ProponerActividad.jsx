// CU010 — Cuando el Docente intenta escribir sin una actividad abierta.
//
// Antes los botones salían simplemente deshabilitados con un aviso. Es
// correcto pero poco amable: el docente ve lo que quiere hacer, no puede, y
// tiene que deducir que la solución está en otro botón, arriba del todo, en
// otra parte de la pantalla.
//
// Aquí se le ofrece directamente: "necesitas una actividad, ¿la inicio?". Un
// clic y sigue con lo que iba a hacer, sin salir ni volver a buscar la fila.
//
// Lo que NO cambia es la regla: sin actividad no se escribe. El servidor
// responde 409 `actividad_requerida` igualmente, así que esto no es un atajo,
// es el mismo requisito presentado de forma que se pueda resolver.
import { PlayCircle } from 'lucide-react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export default function ProponerActividad({ abierto, accion, iniciando, onIniciar, onCancelar }) {
  return (
    <Modal
      open={abierto}
      onClose={onCancelar}
      title="Necesitas una actividad de trabajo"
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar}>
            Ahora no
          </Button>
          <Button variant="success" iconLeft={PlayCircle} loading={iniciando} onClick={onIniciar}>
            Iniciar actividad
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        {`Para ${accion ?? 'registrar'} hace falta tener una actividad de trabajo abierta: es lo que permite dejar
        constancia de quién hizo cada cambio y cuándo.`}
      </p>
      <p className="mt-2 text-sm text-ink-500">
        Se inicia ahora y puedes continuar sin salir de esta pantalla. La actividad no acorta tu sesión: termina
        cuando pulses <strong>Finalizar actividad</strong>.
      </p>
    </Modal>
  )
}
