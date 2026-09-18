// Cubre: RF-011, RF-015, RF-016, RF-021, RN-006, RN-014
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import LevelChip from '../../components/ui/LevelChip'
import { totalLibros } from '../../domain/totales'
import { formatearRangoSemana } from '../../lib/format'

/** Libros por semana de la ficha (P11). RF-016: el total lo calcula el sistema. */
export function TablaLibrosSemana({ semanas }) {
  return (
  <Card title="Libros por semana" subtitle="Total calculado por el sistema (RF-016)" padded={false}>
    <DataTable
      columns={[
        {
          key: 'numero',
          header: 'Semana',
          render: (s) => (
            <span className="whitespace-nowrap">
              <span className="font-medium text-ink-900">S{s.numero}</span>
              <span className="ml-2 text-xs text-ink-400">{formatearRangoSemana(s)}</span>
            </span>
          ),
        },
        {
          key: 'asistio',
          header: 'Asistencia',
          align: 'center',
          render: (s) => (
            <Badge tone={s.asistio ? 'success' : 'danger'}>{s.asistio ? 'Sí' : 'No'}</Badge>
          ),
        },
        {
          // RF-015: los LSB llevan título y puntaje; los LSL solo cantidad.
          key: 'libros',
          header: 'Libros de subir de nivel',
          render: (s) =>
            s.libros.length ? (
              <ul className="flex flex-col gap-0.5">
                {s.libros.map((l) => (
                  <li key={l.id_libro} className="text-xs text-ink-700">
                    {l.titulo}{' '}
                    <span className="tabular-nums text-ink-400">
                      ({l.aciertos}/{l.total})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-ink-400">—</span>
            ),
        },
        { key: 'lsl', header: 'Sala de lectura', align: 'right' },
        {
          key: 'total',
          header: 'Total',
          align: 'right',
          render: (s) => <span className="font-semibold text-ink-900">{totalLibros(s)}</span>,
        },
      ]}
      rows={semanas}
      getRowId={(s) => s.id_semana}
      initialPageSize={8}
      footNote="Cero libros es un valor válido en semanas sin actividad lectiva."
    />
  </Card>
  )
}

/** Historial de evaluaciones diagnósticas de la ficha (P11). */
export function TablaHistorialEvaluaciones({ evaluaciones }) {
  return (
  <Card title="Historial de evaluaciones" padded={false}>
    <DataTable
      columns={[
        { key: 'periodo', header: 'Periodo', className: 'font-medium text-ink-900' },
        { key: 'ciclo_evaluado', header: 'Ciclo evaluado', align: 'center' },
        {
          key: 'prueba',
          header: 'Prueba',
          align: 'center',
          render: (e) => (
            <span className="whitespace-nowrap text-xs">
              <LevelChip letra={e.nivel_prueba} size="sm" />{' '}
              <span className="tabular-nums text-ink-500">
                {e.aciertos}/{e.total}
              </span>
            </span>
          ),
        },
        { key: 'fluidez', header: 'Fluidez', render: (e) => <LevelChip nivel={e.fluidez} size="sm" /> },
        {
          key: 'comprension',
          header: 'Comprensión',
          render: (e) => <LevelChip nivel={e.comprension} size="sm" />,
        },
        {
          key: 'nivel_ajustado',
          header: 'Nivel Raz-Kids',
          align: 'center',
          render: (e) => <LevelChip letra={e.nivel_ajustado} size="sm" />,
        },
        {
          key: 'nivel_general',
          header: 'Nivel final',
          render: (e) => <LevelChip nivel={e.nivel_general} size="sm" />,
        },
        {
          key: 'ajustado_por_docente',
          header: '¿Ajustado?',
          align: 'center',
          render: (e) =>
            e.ajustado_por_docente ? <Badge tone="warning">Sí</Badge> : <span className="text-xs text-ink-400">No</span>,
        },
        {
          key: 'justificacion',
          header: 'Observación',
          render: (e) => (
            <span className="block max-w-xs truncate text-xs text-ink-500" title={e.justificacion ?? ''}>
              {e.justificacion ?? e.observacion ?? '—'}
            </span>
          ),
        },
      ]}
      rows={evaluaciones}
      getRowId={(e) => e.id_evaluacion}
      paginated={false}
      empty={<EmptyState title="Sin evaluaciones" description="Este estudiante aún no tiene cortes registrados." />}
    />
  </Card>
  )
}
