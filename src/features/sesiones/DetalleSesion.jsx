// T20 / CU025 — Detalle de una sesión de actividades. Solo lectura.
//
// Muestra qué registro se tocó, qué campo, y el valor anterior y el nuevo. Para
// los cambios hechos sin conexión se distingue la hora de CAPTURA en el aula de
// la de RECEPCIÓN en el servidor: sin esa distinción, un cambio sincronizado
// tres horas después parecería hecho a esa hora.
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import { detalleSesion } from '../../api/resources/sesiones'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'

export default function DetalleSesion({ sesion, onCerrar }) {
  const consulta = useQuery({
    queryKey: ['sesiones', 'detalle', sesion?.id],
    queryFn: () => detalleSesion(sesion.id),
    enabled: Boolean(sesion),
  })

  return (
    <Modal
      open={Boolean(sesion)}
      onClose={onCerrar}
      title={`Sesión ${sesion?.id ?? ''}`}
      subtitle={sesion ? `${sesion.docente} · ${sesion.colegio ?? '—'}` : undefined}
      footer={<Button variant="ghost" onClick={onCerrar}>Cerrar</Button>}
    >
      {consulta.isError ? (
        <EmptyState title="No se pudo cargar el detalle" description={mensajeDeError(consulta.error)} />
      ) : (
        <DataTable
          loading={consulta.isLoading}
          rows={consulta.data?.cambios ?? []}
          getRowId={(c) => c.id_cambio}
          paginated={false}
          empty={
            <EmptyState
              icon={History}
              title="Sin cambios en esta sesión"
              description="La sesión se abrió, pero no se registró ninguna modificación."
            />
          }
          columns={[
            { key: 'entidad', header: 'Registro', className: 'font-medium text-ink-900' },
            { key: 'campo', header: 'Campo' },
            { key: 'valor_anterior', header: 'Antes', render: (c) => <span className="text-ink-500">{c.valor_anterior ?? '—'}</span> },
            { key: 'valor_nuevo', header: 'Después', render: (c) => <span className="font-medium text-ink-900">{c.valor_nuevo ?? '—'}</span> },
            {
              key: 'cuando',
              header: 'Cuándo',
              render: (c) => (
                <span className="flex flex-col">
                  <span>{formatearFechaHora(c.fecha_servidor)}</span>
                  {c.diferido && (
                    <>
                      <span className="text-xs text-ink-400">capturado {formatearFechaHora(c.fecha_cliente)}</span>
                      <Badge tone="warning" className="mt-1 w-fit">Sincronizado de forma diferida</Badge>
                    </>
                  )}
                </span>
              ),
            },
          ]}
        />
      )}
    </Modal>
  )
}
