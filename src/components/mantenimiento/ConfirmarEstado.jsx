// Subflujo S4 — Inactivar / Activar, con confirmación.
//
// Se pide confirmación porque el cambio afecta a un registro que otros pueden
// estar usando. El texto insiste en que no se borra nada: es la diferencia
// entre esta acción y el "Eliminar" que el sprint retiró de todas las secciones.
//
// LA FECHA EFECTIVA, cuando la sección la pide (hoy solo Alumnos).
//
// No es la fecha del clic: es desde cuándo vale la baja o el alta. Un alumno
// que se fue el día 3 y se inactiva el 20 no estuvo en el aula esas dos
// semanas, y las tablas históricas de esas fechas tienen que poder decirlo.
// Por eso se pregunta en vez de dar por supuesto hoy.
import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { hoy } from '../../lib/relojServidor'

/**
 * @param fechaEfectiva `null` para no pedirla, o `{etiqueta, ayuda}`. Las
 *   secciones cuyo backend no acepta cuerpo —Colegios, Usuarios— no la pasan.
 */
export default function ConfirmarEstado({ peticion, entidad, fechaEfectiva = null, onConfirmar, onCancelar }) {
  const activando = peticion?.activo
  const nombre = peticion?.fila?.nombre ?? entidad
  const [fecha, setFecha] = useState(hoy())

  // Cada apertura empieza en hoy: la fecha del caso anterior no dice nada del
  // siguiente, y arrastrarla sería el tipo de error que nadie revisa.
  useEffect(() => {
    if (peticion) setFecha(hoy())
  }, [peticion])

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
          <Button
            variant={activando ? 'primary' : 'danger'}
            disabled={Boolean(fechaEfectiva) && !fecha}
            onClick={() => onConfirmar(fecha)}
          >
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

      {fechaEfectiva && (
        <div className="mt-4">
          <Input
            label={fechaEfectiva.etiqueta ?? 'Fecha efectiva'}
            type="date"
            required
            // El tope es hoy según el reloj del SERVIDOR: una fecha futura la
            // rechaza el backend con "Selecciona la fecha de hoy o una fecha
            // anterior."
            max={hoy()}
            value={fecha}
            hint={fechaEfectiva.ayuda}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      )}
    </Modal>
  )
}
