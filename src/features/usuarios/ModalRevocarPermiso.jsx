// Revocar un permiso de corrección (CU028, D77 y D78).
//
// Antes esto vivía dentro de "Ver permiso", así que revocar era un efecto
// secundario de consultar. CU028 lo separa: la columna Acciones tiene "Ver
// permiso" y, para los programados o vigentes, "Revocar", y cada uno abre lo
// suyo.
//
// LO QUE HAY QUE DEJAR CLARO es desde cuándo deja de valer: la revocación
// corta las operaciones NUEVAS desde que el servidor la confirma, pero no
// deshace las correcciones ya hechas. Un Supervisor que crea que revocar
// revierte el trabajo del Docente estaría equivocándose en lo importante.
//
// D78 — Pulsar fuera NO cierra, la X se comporta como "Cancelar", y con el
// motivo escrito se pregunta antes de descartarlo, dentro del mismo modal.
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import { ETIQUETA_ESTADO_PERMISO, MODULOS_PERMISO } from '../../api/resources/permisos'
import { formatearFechaHora } from '../../lib/format'

const texto = (valor) => (valor != null && typeof valor === 'object' ? (valor.nombre ?? '—') : (valor ?? '—'))

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-900">{children ?? '—'}</dd>
    </div>
  )
}

export default function ModalRevocarPermiso({ permiso, docente, revocando, error, onRevocar, onCerrar }) {
  const [motivo, setMotivo] = useState('')
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  useEffect(() => {
    if (!permiso) {
      setMotivo('')
      setConfirmandoDescarte(false)
    }
  }, [permiso])

  // Con texto escrito, cancelar pregunta; sin texto cierra directo, porque no
  // hay nada que perder y preguntar sería un estorbo.
  const cancelar = () => (motivo.trim() ? setConfirmandoDescarte(true) : onCerrar())

  const modulo = MODULOS_PERMISO.find((m) => m.value === permiso?.modulo)?.label ?? permiso?.modulo

  return (
    <Modal
      open={Boolean(permiso)}
      // D78 — Mientras se procesa no se puede cerrar: la solicitud puede
      // haberse aplicado y cerrar daría a entender que no.
      onClose={revocando ? () => {} : cancelar}
      cierreExterior={false}
      title="Revocar permiso de corrección"
      size="max-w-2xl"
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
            <Button variant="ghost" onClick={cancelar} disabled={revocando}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={revocando}
              disabled={!motivo.trim() || revocando}
              onClick={() => onRevocar(motivo.trim())}
            >
              Confirmar revocación
            </Button>
          </>
        )
      }
    >
      {confirmandoDescarte ? (
        <p className="text-sm text-ink-700">Tienes datos sin guardar. ¿Deseas descartarlos?</p>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-surface-100 px-4 py-3 md:grid-cols-3">
            <Dato etiqueta="Docente">{docente?.nombre ?? docente?.nombres}</Dato>
            <Dato etiqueta="Año escolar">{texto(permiso?.anio_escolar)}</Dato>
            <Dato etiqueta="Colegio">{texto(permiso?.colegio)}</Dato>
            <Dato etiqueta="Grado">{texto(permiso?.grado)}</Dato>
            <Dato etiqueta="Periodo académico">{texto(permiso?.periodo_academico)}</Dato>
            <Dato etiqueta="Módulo">{modulo}</Dato>
            <Dato etiqueta="Estado">{ETIQUETA_ESTADO_PERMISO[permiso?.estado] ?? permiso?.estado}</Dato>
            <Dato etiqueta="Inicio de vigencia">{formatearFechaHora(permiso?.inicio)}</Dato>
            <Dato etiqueta="Fin de vigencia">{formatearFechaHora(permiso?.fin)}</Dato>
          </dl>

          <p className="mb-4 text-sm text-ink-700">
            La revocación impedirá nuevas operaciones con este permiso desde el momento en que sea confirmada por el
            servidor. Las correcciones realizadas anteriormente conservarán su historial.
          </p>

          <Textarea
            label="Motivo de revocación"
            required
            rows={4}
            maxLength={300}
            autoFocus
            value={motivo}
            error={error}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </>
      )}
    </Modal>
  )
}
