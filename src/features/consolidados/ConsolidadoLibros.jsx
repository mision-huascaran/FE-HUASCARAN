// Cubre: RF-016, RF-010
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import BarraExportacion from './BarraExportacion'
import { obtenerConsolidadoLibros } from '../../api/resources/consolidados'
import { mensajeDeError } from '../../api/client'

/**
 * Consolidado de libros: totales de LSB (subir de nivel) y LSL (sala de
 * lectura) por colegio, grado y mes, con total general. RF-016: el total lo
 * calcula el sistema, nadie lo escribe.
 */
export default function ConsolidadoLibros({ filtros }) {
  const consulta = useQuery({
    queryKey: ['consolidado-libros', filtros],
    queryFn: () => obtenerConsolidadoLibros(filtros),
    enabled: Boolean(filtros.mes),
  })

  const datos = consulta.data
  const filas = datos?.filas ?? []
  const general = datos?.total_general

  if (consulta.isError) return <EmptyState title="No se pudo cargar el consolidado" description={mensajeDeError(consulta.error)} />

  return (
    <Card
      title="Consolidado de libros"
      subtitle={datos ? `${datos.semanas} semanas lectivas en el mes` : undefined}
      padded={false}
    >
      <DataTable
        loading={consulta.isLoading}
        rows={filas}
        getRowId={(f) => f.id}
        initialPageSize={25}
        empty={<EmptyState title="Sin reportes" description="No hay reportes semanales con estos filtros." />}
        columns={[
          { key: 'colegio', header: 'Colegio', sortable: true, className: 'font-medium text-ink-900' },
          { key: 'grado', header: 'Grado', align: 'center', sortable: true, sortValue: (f) => f.id_grado },
          { key: 'lsb', header: 'Subir de nivel (LSB)', align: 'right', sortable: true },
          { key: 'lsl', header: 'Sala de lectura (LSL)', align: 'right', sortable: true },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            sortable: true,
            render: (f) => <span className="font-semibold text-ink-900">{f.total}</span>,
          },
        ]}
      />
      {general && filas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 border-t border-line bg-surface-50 px-4 py-3 text-sm sm:grid-cols-4">
          <span className="font-semibold text-ink-900">Total general</span>
          <span className="tabular-nums">LSB: <strong>{general.lsb}</strong></span>
          <span className="tabular-nums">LSL: <strong>{general.lsl}</strong></span>
          <span className="tabular-nums">Total: <strong>{general.total}</strong></span>
        </div>
      )}
      <BarraExportacion
        origen={datos?.origen}
        filas={general ? [...filas, { colegio: 'TOTAL GENERAL', grado: '', ...general }] : filas}
        nombre={`consolidado-libros-${datos?.mes ?? ''}`}
        hoja="Consolidado libros"
        columnas={[
          { titulo: 'Colegio', valor: 'colegio' },
          { titulo: 'Grado', valor: 'grado' },
          { titulo: 'LSB', valor: 'lsb' },
          { titulo: 'LSL', valor: 'lsl' },
          { titulo: 'Total', valor: 'total' },
        ]}
      />
    </Card>
  )
}
