// CU028 — "Ver permiso": el alcance de la autorización, y su revocación.
//
// Es de SOLO LECTURA salvo por una acción: revocar, y solo si el permiso está
// programado o vigente. Un permiso vencido no se revoca —ya no habilita nada y
// el backend responde 409 `permiso_vencido`—, y uno ya revocado tampoco.
//
// La revocación pide motivo obligatorio, igual que el otorgamiento: las dos
// decisiones quedan registradas con quién las tomó y por qué, que es el sentido
// de que estos permisos existan como figura aparte.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import Textarea from '../../components/ui/Textarea'
import {
  ETIQUETA_ESTADO_PERMISO,
  ETIQUETA_MODULO,
  TONO_ESTADO_PERMISO,
  obtenerPermiso,
} from '../../api/resources/permisos'
import { formatearFechaHora } from '../../lib/format'

const texto = (valor) => (valor != null && typeof valor === 'object' ? (valor.nombre ?? '—') : (valor ?? '—'))

/** Solo lo programado o lo vigente se puede cortar. */
const SE_PUEDE_REVOCAR = new Set(['programado', 'vigente'])

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children ?? '—'}</dd>
    </div>
  )
}

export default function DetallePermiso({ permiso, idUsuario, revocando, onRevocar, onCerrar }) {
  const [motivo, setMotivo] = useState('')
  const [revocandoAhora, setRevocandoAhora] = useState(false)

  // El detalle trae el motivo y los datos de revocación, que el listado omite.
  const consulta = useQuery({
    queryKey: ['permisos', idUsuario, 'detalle', permiso?.id],
    queryFn: () => obtenerPermiso(idUsuario, permiso.id),
    enabled: Boolean(permiso?.id),
  })

  // Cada apertura empieza limpia: el motivo del permiso anterior no dice nada
  // de este, y arrastrarlo sería el tipo de error que nadie revisa.
  useEffect(() => {
    if (!permiso) return
    setMotivo('')
    setRevocandoAhora(false)
  }, [permiso])

  const d = consulta.data ?? permiso
  const puedeRevocar = SE_PUEDE_REVOCAR.has(d?.estado)

  return (
    <Modal
      open={Boolean(permiso)}
      onClose={onCerrar}
      title="Permiso de corrección"
      subtitle={d ? `${texto(d.colegio)} · ${texto(d.grado)} · ${texto(d.periodo)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
          {puedeRevocar &&
            (revocandoAhora ? (
              <Button
                variant="danger"
                loading={revocando}
                disabled={!motivo.trim()}
                onClick={() => onRevocar(motivo.trim())}
              >
                Confirmar revocación
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setRevocandoAhora(true)}>
                Revocar
              </Button>
            ))}
        </>
      }
    >
      {consulta.isLoading && !permiso ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dato etiqueta="Año escolar">{texto(d?.anio_escolar)}</Dato>
            <Dato etiqueta="Colegio">{texto(d?.colegio)}</Dato>
            <Dato etiqueta="Grado">{texto(d?.grado)}</Dato>
            <Dato etiqueta="Periodo académico">{texto(d?.periodo)}</Dato>
            <Dato etiqueta="Módulo autorizado">{ETIQUETA_MODULO[d?.modulo] ?? d?.modulo}</Dato>
            <Dato etiqueta="Estado">
              {d?.estado && (
                <Badge tone={TONO_ESTADO_PERMISO[d.estado] ?? 'neutral'}>
                  {ETIQUETA_ESTADO_PERMISO[d.estado] ?? d.estado}
                </Badge>
              )}
            </Dato>
            <Dato etiqueta="Inicio de vigencia">{d?.inicio && formatearFechaHora(d.inicio)}</Dato>
            <Dato etiqueta="Fin de vigencia">{d?.fin && formatearFechaHora(d.fin)}</Dato>
            <Dato etiqueta="Otorgado por">{texto(d?.otorgado_por)}</Dato>
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-ink-900">Motivo de la autorización</h3>
            <p className="mt-1 text-sm text-ink-700">{d?.motivo ?? '—'}</p>
          </div>

          {/* Si fue revocado, su propio rastro: quién, cuándo y por qué. */}
          {d?.revocado_en && (
            <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-3">
              <h3 className="text-sm font-semibold text-danger-600">Revocado</h3>
              <p className="mt-1 text-sm text-ink-700">{d.motivo_revocacion}</p>
              <p className="mt-1 text-xs text-ink-500">
                {texto(d.revocado_por)} · {formatearFechaHora(d.revocado_en)}
              </p>
            </div>
          )}

          {revocandoAhora && (
            <Textarea
              label="Motivo de la revocación"
              rows={3}
              autoFocus
              required
              maxLength={300}
              value={motivo}
              hint="Queda registrado junto a quién la hizo y cuándo."
              onChange={(e) => setMotivo(e.target.value)}
            />
          )}
        </div>
      )}
    </Modal>
  )
}
