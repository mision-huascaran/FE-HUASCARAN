// Subflujo S4 — Inactivar / Activar, con confirmación.
//
// Se pide confirmación porque el cambio afecta a un registro que otros pueden
// estar usando. El texto insiste en que no se borra nada: es la diferencia
// entre esta acción y el "Eliminar" que el sprint retiró de todas las secciones.
import Button from '../ui/Button'
import Modal from '../ui/Modal'

export default function ConfirmarEstado({ peticion, entidad, onConfirmar, onCancelar }) {
  const activando = peticion?.activo
  const nombre = peticion?.fila?.nombre ?? entidad

  return (
    <Modal
      open={Boolean(peticion)}
      onClose={onCancelar}
      title={activando ? `Activar ${entidad}` : `Inactivar ${entidad}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variant={activando ? 'primary' : 'danger'} onClick={onConfirmar}>
            {activando ? 'Activar' : 'Inactivar'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        {activando
          ? `Se reactivará «${nombre}» y volverá a aparecer en los listados.`
          : `Se inactivará «${nombre}». No se borra nada: el registro y su historial se conservan, y puede reactivarse cuando haga falta.`}
      </p>
    </Modal>
  )
}
