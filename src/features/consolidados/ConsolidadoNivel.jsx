// Cubre: RF-010, RF-006
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import LevelChip from '../../components/ui/LevelChip'
import BarraExportacion from './BarraExportacion'
import { obtenerConsolidadoNivel } from '../../api/resources/consolidados'
import { mensajeDeError } from '../../api/client'

/**
 * Consolidado de niveles: conteo y porcentaje de estudiantes por nivel, por
 * grado y programa. Es el equivalente de la pestaña CONSOLIDADO del Excel.
 */
export default function ConsolidadoNivel({ filtros }) {
  const consulta = useQuery({
    queryKey: ['consolidado-nivel', filtros],
    queryFn: () => obtenerConsolidadoNivel(filtros),
    enabled: Boolean(filtros.periodo),
  })

  const datos = consulta.data
  const niveles = datos?.niveles ?? []
  const filas = datos?.filas ?? []
  const celda = (f, n) => (f.total ? `${f.conteos[n] ?? 0} (${Math.round(((f.conteos[n] ?? 0) / f.total) * 100)}%)` : '—')

  if (consulta.isError) return <EmptyState title="No se pudo cargar el consolidado" description={mensajeDeError(consulta.error)} />

  return (
    <Card
      title={`Consolidado de niveles${datos?.periodo ? ` · ${datos.periodo}` : ''}`}
      subtitle="Estudiantes por nivel general, separados por programa y grado"
      padded={false}
    >
      <DataTable
        loading={consulta.isLoading}
        rows={filas}
        paginated={false}
        getRowId={(f) => `${f.id_programa}-${f.id_grado}`}
        empty={<EmptyState title="Sin evaluaciones" description="No hay evaluaciones con estos filtros." />}
        columns={[
          { key: 'programa', header: 'Programa', className: 'whitespace-nowrap font-medium text-ink-900' },
          { key: 'grado', header: 'Grado', align: 'center' },
          { key: 'total', header: 'Evaluados', align: 'right' },
          ...niveles.map((n) => ({
            key: n,
            header: <LevelChip nivel={n} size="sm" />,
            align: 'right',
            render: (f) => <span className="whitespace-nowrap">{celda(f, n)}</span>,
          })),
        ]}
      />
      <BarraExportacion
        origen={datos?.origen}
        filas={filas}
        nombre={`consolidado-niveles-${datos?.periodo ?? ''}`}
        hoja="Consolidado niveles"
        columnas={[
          { titulo: 'Programa', valor: 'programa' },
          { titulo: 'Grado', valor: 'grado' },
          { titulo: 'Evaluados', valor: 'total' },
          ...niveles.flatMap((n) => [
            { titulo: n, valor: (f) => f.conteos[n] ?? 0 },
            { titulo: `${n} (%)`, valor: (f) => (f.total ? Math.round(((f.conteos[n] ?? 0) / f.total) * 100) : null) },
          ]),
        ]}
      />
    </Card>
  )
}
