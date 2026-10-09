// CU020 y CU021 — Seguimiento del equipo de docentes. Solo del Supervisor.
//
// Sirve para una cosa concreta: ver de un vistazo quién tiene trabajo sin
// sincronizar o lleva días sin conectarse. Por eso el ORDEN no se toca en el
// cliente: el servidor manda primero a los que están `pendiente` y después
// alfabéticamente, y reordenar aquí rompería justamente eso.
//
// Todo el módulo es SOLO EN LÍNEA y de solo lectura: los casos de uso prohíben
// descargar el historial de auditoría al dispositivo.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Users, WifiOff } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DetalleDocente from './DetalleDocente'
import { listarSeguimiento } from '../../api/resources/seguimiento'
import { listarColegiosAdmin } from '../../api/resources/administracion'
import { ETIQUETA_SINCRONIZACION } from '../../api/resources/actividades'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'
import useConexion from '../../hooks/useConexion'

const SINCRONIZACIONES = [
  { value: 'al_dia', label: 'Al día' },
  { value: 'pendiente', label: 'Pendiente' },
]

export default function SeguimientoPage() {
  const enLinea = useConexion()
  const [filtros, setFiltros] = useState({ id_colegio: '', desde: '', hasta: '', sincronizacion: '' })
  const [docente, setDocente] = useState(null)

  const { data: colegios = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'colegios'],
    queryFn: async () => (await listarColegiosAdmin()).items,
    staleTime: Infinity,
    enabled: enLinea,
  })

  const consulta = useQuery({
    queryKey: ['seguimiento', filtros],
    queryFn: () => listarSeguimiento(filtros),
    enabled: enLinea,
  })

  const cambiar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }))

  if (!enLinea) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Seguimiento</h1>
        </header>
        <Card>
          <EmptyState
            icon={WifiOff}
            title="Módulo de seguimiento no disponible sin conexión"
            description="Conéctate a internet para auditar la actividad de los docentes."
          />
        </Card>
      </div>
    )
  }

  // El detalle ocupa la pantalla entera y oculta la grilla general (CU021).
  if (docente) return <DetalleDocente docente={docente} onVolver={() => setDocente(null)} />

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Seguimiento</h1>
        <p className="mt-1 text-sm text-ink-500">Actividad y estado de sincronización de su equipo.</p>
      </header>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <Select
            label="Colegio"
            placeholder="Todos"
            value={filtros.id_colegio}
            options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
            onChange={(e) => cambiar('id_colegio', e.target.value)}
          />
          {/* El rango es sobre la ÚLTIMA CONEXIÓN: quien nunca entró queda
              fuera en cuanto se usa, y conviene saberlo antes de extrañarse. */}
          <Input label="Conectado desde" type="date" value={filtros.desde} onChange={(e) => cambiar('desde', e.target.value)} />
          <Input label="Hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
          <Select
            label="Sincronización"
            placeholder="Todas"
            value={filtros.sincronizacion}
            options={SINCRONIZACIONES}
            onChange={(e) => cambiar('sincronizacion', e.target.value)}
          />
        </div>

        {consulta.isError ? (
          <EmptyState title="No se pudo cargar el seguimiento" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data?.items ?? []}
            getRowId={(d) => d.id_docente}
            empty={<EmptyState icon={Users} title="Sin docentes que mostrar" description="Pruebe a quitar algún filtro." />}
            columns={[
              {
                key: 'nombre',
                header: 'Docente',
                render: (d) => [d.nombres, d.apellidos].filter(Boolean).join(' '),
              },
              {
                key: 'colegios',
                header: 'Colegios asignados',
                // Llegan como lista; se unen con comas, que es como se lee.
                render: (d) => (d.colegios ?? []).map((c) => c.nombre).join(', ') || '—',
              },
              {
                key: 'ultima_conexion',
                header: 'Última conexión',
                render: (d) => (d.ultima_conexion ? formatearFechaHora(d.ultima_conexion) : 'Nunca'),
              },
              {
                key: 'sincronizacion',
                header: 'Sincronización',
                render: (d) => (
                  <Badge tone={d.sincronizacion === 'pendiente' ? 'warning' : 'success'}>
                    {ETIQUETA_SINCRONIZACION[d.sincronizacion] ?? d.sincronizacion}
                  </Badge>
                ),
              },
              { key: 'registros_pendientes', header: 'Pendientes', align: 'center' },
              {
                key: 'acciones',
                header: '',
                render: (d) => (
                  <Button size="sm" variant="ghost" iconLeft={Eye} onClick={() => setDocente(d)}>
                    Ver detalle
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
