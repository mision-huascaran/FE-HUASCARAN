// Subflujo S5 — Ver auditoría.
//
// Quién, cuándo, qué campo, valor anterior y nuevo, y la sesión de actividades
// en la que ocurrió. Un cambio hecho sin conexión distingue la hora de captura
// de la de recepción en el servidor.
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import Badge from '../ui/Badge'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'

export default function PestanaAuditoria({ seccion, registro, cargarAuditoria }) {
  const id = registro?.id ?? registro?.[`id_${seccion}`] ?? null
  const consulta = useQuery({
    queryKey: ['auditoria', seccion, id],
    queryFn: () => cargarAuditoria(id),
    enabled: Boolean(id && cargarAuditoria),
  })

  if (consulta.isError) {
    return <EmptyState title="No se pudo cargar la auditoría" description={mensajeDeError(consulta.error)} />
  }

  return (
    <DataTable
      loading={consulta.isLoading}
      rows={consulta.data ?? []}
      getRowId={(c) => c.id_cambio ?? `${c.campo}-${c.fecha}`}
      initialPageSize={5}
      empty={
        <EmptyState
          icon={History}
          title="Sin cambios registrados"
          description="Todavía no se ha modificado este registro."
        />
      }
      columns={[
        {
          key: 'fecha',
          header: 'Cuándo',
          render: (c) => (
            <span className="flex flex-col">
              <span>{formatearFechaHora(c.fecha ?? c.fecha_servidor)}</span>
              {/* Capturado sin conexión: la hora del aula no es la del servidor. */}
              {c.fecha_cliente && c.fecha_cliente !== c.fecha_servidor && (
                <span className="text-xs text-ink-400">capturado {formatearFechaHora(c.fecha_cliente)}</span>
              )}
            </span>
          ),
        },
        { key: 'usuario', header: 'Quién', className: 'font-medium text-ink-900' },
        { key: 'campo', header: 'Campo' },
        {
          key: 'valor_anterior',
          header: 'Antes',
          render: (c) => <span className="text-ink-500">{c.valor_anterior ?? '—'}</span>,
        },
        {
          key: 'valor_nuevo',
          header: 'Después',
          render: (c) => <span className="font-medium text-ink-900">{c.valor_nuevo ?? '—'}</span>,
        },
        {
          key: 'sesion',
          header: 'Sesión',
          render: (c) =>
            c.diferido ? (
              <Badge tone="warning">Sincronizado de forma diferida</Badge>
            ) : (
              <span className="text-xs text-ink-400">{c.sesion_actividad_id ?? '—'}</span>
            ),
        },
      ]}
    />
  )
}
