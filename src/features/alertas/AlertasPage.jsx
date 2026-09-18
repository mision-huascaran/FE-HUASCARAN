// Cubre: RF-014, RN-006
// RF-014 es NICE TO HAVE en el documento de requerimientos.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Eye, ShieldCheck } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { listarAlertas, marcarAlertaRevisada } from '../../api/resources/consolidados'
import { mensajeDeError } from '../../api/client'
import { useColegios } from '../../hooks/useCatalogos'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
const nombreMes = (clave) => {
  const [anio, mes] = String(clave).split('-').map(Number)
  return mes ? `${MESES[mes - 1]} ${anio}` : clave
}

/**
 * Alertas de inconsistencia (P15): estudiantes cuyo total de libros del mes
 * según el reporte semanal no cuadra con el consolidado mensual.
 *
 * TODO RF-014: el documento no define la regla exacta de "no cuadra"; la del
 * mock es la más literal (los dos totales difieren). RN-006: cero libros es un
 * valor válido y no genera alerta por sí solo.
 */
export default function AlertasPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: colegios = [] } = useColegios()
  const [colegio, setColegio] = useState('')
  const [estado, setEstado] = useState('pendiente')

  const consulta = useQuery({ queryKey: ['alertas', colegio], queryFn: () => listarAlertas({ colegio }) })

  const revisar = useMutation({
    mutationFn: marcarAlertaRevisada,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] })
      toast.success('Alerta marcada como revisada')
    },
    onError: (error) => toast.error('No se pudo actualizar', mensajeDeError(error)),
  })

  const todas = consulta.data ?? []
  const filas = estado ? todas.filter((a) => a.estado === estado) : todas
  const pendientes = todas.filter((a) => a.estado === 'pendiente').length

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Alertas de inconsistencias</h1>
        <p className="mt-1 text-sm text-ink-500">
          Estudiantes cuyo reporte semanal no cuadra con el consolidado mensual. {pendientes} pendientes de revisión.
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Colegio" value={colegio} onChange={(e) => setColegio(e.target.value)} placeholder="Todos" options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))} />
          <Select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            placeholder="Todas"
            options={[{ value: 'pendiente', label: 'Pendientes' }, { value: 'revisada', label: 'Revisadas' }]}
          />
        </div>
      </Card>

      <Card padded={false}>
        {consulta.isError ? (
          <EmptyState title="No se pudieron cargar las alertas" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={filas}
            getRowId={(a) => a.id_alerta}
            initialPageSize={10}
            empty={
              <EmptyState
                icon={ShieldCheck}
                title={estado === 'pendiente' ? 'Todo cuadra' : 'Sin alertas'}
                description={
                  estado === 'pendiente'
                    ? 'No hay diferencias pendientes entre el reporte semanal y el consolidado mensual. Buen trabajo.'
                    : 'No hay alertas con estos filtros.'
                }
              />
            }
            columns={[
              {
                key: 'alumno',
                header: 'Estudiante',
                sortable: true,
                render: (a) => (
                  <div className="min-w-[11rem]">
                    <p className="font-medium text-ink-900">{a.alumno}</p>
                    <p className="text-xs text-ink-400">{a.codigo}</p>
                  </div>
                ),
              },
              { key: 'colegio', header: 'Colegio', sortable: true },
              { key: 'mes', header: 'Mes', render: (a) => <span className="whitespace-nowrap">{nombreMes(a.mes)}</span> },
              { key: 'valor_semanal', header: 'Semanal', align: 'right' },
              { key: 'valor_consolidado', header: 'Consolidado', align: 'right' },
              {
                key: 'diferencia',
                header: 'Diferencia',
                align: 'right',
                sortable: true,
                sortValue: (a) => Math.abs(a.diferencia),
                render: (a) => (
                  <span className="font-semibold text-danger-600">
                    {a.diferencia > 0 ? '+' : ''}
                    {a.diferencia}
                  </span>
                ),
              },
              {
                key: 'estado',
                header: 'Estado',
                align: 'center',
                render: (a) => <Badge tone={a.estado === 'revisada' ? 'success' : 'warning'}>{a.estado === 'revisada' ? 'Revisada' : 'Pendiente'}</Badge>,
              },
              {
                key: 'acciones',
                header: 'Acciones',
                align: 'center',
                render: (a) => (
                  <div className="flex items-center justify-center gap-1">
                    <Link
                      to={`/estudiantes/${a.id_alumno}`}
                      aria-label="Ver detalle"
                      title="Ver detalle"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-100 hover:text-brand-700"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      aria-label="Marcar como revisada"
                      title="Marcar como revisada"
                      disabled={a.estado === 'revisada' || revisar.isPending}
                      onClick={() => revisar.mutate(a.id_alerta)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-100 hover:text-success-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  </div>
                ),
              },
            ]}
            footNote="Cero libros es un valor válido en semanas sin actividad lectiva (RN-006): solo alerta una diferencia entre los dos totales."
          />
        )}
      </Card>
    </div>
  )
}
