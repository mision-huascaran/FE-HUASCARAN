// Los modales de confirmación del calendario (CU027, D72 y D75).
//
// Son cuatro y ninguno es decorativo: las fechas del calendario sostienen el
// periodo de cada colegio, qué día es lectivo, cuándo una asignación es
// retroactiva y qué periodos admiten un permiso excepcional. Guardar sin
// confirmar —que es lo que pasaba— deja que un clic cambie todo eso para
// todos los colegios del año.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import { formatearFecha } from '../../lib/format'
import { nombreDePeriodo } from '../../api/resources/calendarios'

/**
 * "Confirmar actualización del calendario" — al guardar la edición del GENERAL.
 *
 * Lo que hay que decir es el ALCANCE: no se está editando un calendario, se
 * están moviendo las fechas de todos los colegios que lo usan.
 */
export function ModalConfirmarActualizacion({ open, guardando, onConfirmar, onSeguirEditando }) {
  return (
    <Modal
      open={open}
      onClose={onSeguirEditando}
      title="Confirmar actualización del calendario"
      size="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onSeguirEditando} disabled={guardando}>
            Seguir editando
          </Button>
          <Button loading={guardando} onClick={onConfirmar}>
            Confirmar cambios
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        Los cambios se aplicarán a todos los colegios que utilizan el calendario general de este año escolar. Los
        colegios con fechas particulares conservarán su configuración.
      </p>
    </Modal>
  )
}

/**
 * "Usar calendario general" — un colegio renuncia a sus fechas propias.
 *
 * El botón de confirmar se deshabilita mientras procesa, y el modal NO se
 * cierra: si la respuesta se pierde, cerrarlo dejaría al Supervisor sin saber
 * si el cambio se aplicó.
 */
export function ModalUsarGeneral({ open, colegio, anio, procesando, onConfirmar, onCancelar }) {
  return (
    <Modal
      open={open}
      onClose={procesando ? () => {} : onCancelar}
      title="Usar calendario general"
      size="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCancelar} disabled={procesando}>
            Cancelar
          </Button>
          <Button loading={procesando} disabled={procesando} onClick={onConfirmar}>
            Confirmar
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        El colegio <strong className="font-semibold">{colegio ?? '—'}</strong> dejará de utilizar sus fechas
        particulares para el año escolar <strong className="font-semibold">{anio ?? '—'}</strong> y adoptará el
        calendario general. Los cambios posteriores del calendario general se aplicarán también a este colegio.
      </p>
    </Modal>
  )
}

/**
 * "Descartar cambios" — al cancelar o salir con la edición a medias.
 *
 * El calendario no se guarda como operación offline ni en `localStorage`: lo
 * escrito vive solo en memoria. Si se pierde, se pierde, y por eso se
 * pregunta antes.
 */
export function ModalDescartarCambios({ open, onDescartar, onSeguirEditando }) {
  return (
    <Modal
      open={open}
      onClose={onSeguirEditando}
      title="Descartar cambios"
      size="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onSeguirEditando}>
            Seguir editando
          </Button>
          <Button variant="danger" onClick={onDescartar}>
            Descartar cambios
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">Tienes cambios sin guardar. Si continúas, se perderán.</p>
    </Modal>
  )
}

/**
 * "Consultar versión actual" — qué guardó el otro Supervisor (D75).
 *
 * Es de SOLO LECTURA y la propuesta sigue detrás: el sistema no combina las
 * dos versiones ni elige por nadie. O se conserva lo escrito, o se carga lo
 * del servidor, y las dos son decisiones de la persona.
 */
export function ModalVersionActual({ open, calendario, onCerrar, onCargar }) {
  const periodos = calendario?.periodos ?? []
  const dias = calendario?.dias_no_lectivos ?? []

  return (
    <Modal
      open={open}
      onClose={onCerrar}
      title="Versión actual del calendario"
      subtitle="Lo que hay guardado en el servidor ahora mismo"
      size="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button onClick={onCargar}>Cargar versión actual</Button>
        </>
      }
    >
      <h4 className="mb-2 text-sm font-semibold text-ink-900">Periodos</h4>
      <table className="mb-5 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="py-1 font-semibold">Periodo</th>
            <th className="py-1 font-semibold">Inicio</th>
            <th className="py-1 font-semibold">Fin</th>
          </tr>
        </thead>
        <tbody>
          {periodos.map((p) => (
            <tr key={nombreDePeriodo(p)} className="border-t border-line">
              <td className="py-1.5">{nombreDePeriodo(p)}</td>
              <td className="py-1.5">{formatearFecha(p.fecha_inicio)}</td>
              <td className="py-1.5">{formatearFecha(p.fecha_fin)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="mb-2 text-sm font-semibold text-ink-900">Días no lectivos</h4>
      {dias.length === 0 ? (
        <p className="text-sm text-ink-500">No hay días no lectivos adicionales configurados.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {dias.map((d, i) => (
            <li key={`${d.motivo}-${i}`} className="flex justify-between gap-4 border-t border-line py-1.5">
              <span className="text-ink-700">{d.motivo}</span>
              <span className="text-ink-500">
                {formatearFecha(d.fecha_inicio)} – {formatearFecha(d.fecha_fin)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

/**
 * Motivo obligatorio con confirmación al cancelar.
 *
 * Lo comparten las acciones que exigen justificar por escrito. Se mantiene
 * aquí para que el texto del aviso y el comportamiento del descarte no se
 * dupliquen en cada pantalla que lo necesite.
 */
export function ModalConMotivo({
  open,
  titulo,
  mensaje,
  etiqueta = 'Motivo',
  ayuda,
  textoConfirmar = 'Confirmar',
  guardando,
  error,
  onConfirmar,
  onCerrar,
}) {
  const [motivo, setMotivo] = useState('')
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  useEffect(() => {
    if (!open) {
      setMotivo('')
      setConfirmandoDescarte(false)
    }
  }, [open])

  // Con texto escrito, cancelar pregunta. Sin texto, cierra directo: no hay
  // nada que perder y preguntar sería un estorbo.
  const cancelar = () => (motivo.trim() ? setConfirmandoDescarte(true) : onCerrar())

  return (
    <Modal
      open={open}
      onClose={cancelar}
      title={titulo}
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
            <Button loading={guardando} disabled={!motivo.trim()} onClick={() => onConfirmar(motivo.trim())}>
              {textoConfirmar}
            </Button>
          </>
        )
      }
    >
      {confirmandoDescarte ? (
        <p className="text-sm text-ink-700">Tienes datos sin guardar. ¿Deseas descartarlos?</p>
      ) : (
        <>
          {mensaje && <p className="mb-4 text-sm text-ink-700">{mensaje}</p>}
          <Textarea
            label={etiqueta}
            required
            rows={4}
            maxLength={300}
            value={motivo}
            error={error}
            hint={ayuda}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </>
      )}
    </Modal>
  )
}
