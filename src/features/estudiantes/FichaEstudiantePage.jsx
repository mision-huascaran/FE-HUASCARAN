// Cubre: RF-004, RF-011, RF-016, RF-021, RN-004, RN-005, RN-014, RN-019, RNF-002
import { Suspense, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, CalendarCheck, FileDown, GraduationCap, TrendingUp } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import LevelChip from '../../components/ui/LevelChip'
import RoleGate from '../../components/ui/RoleGate'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import { GraficoEvolucion, GraficoRubricaSemanal } from '../../components/charts'
import { obtenerAlumno, obtenerHistorialAlumno } from '../../api/resources/alumnos'
import { agruparNivelesRubrica, useNivelesRazkids, useNivelesRubrica } from '../../hooks/useCatalogos'
import { totalLibros } from '../../domain/totales'
import { formatearRangoSemana, porcentaje } from '../../lib/format'
import { ROLES } from '../../auth/roles'

export default function FichaEstudiantePage() {
  const { id } = useParams()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()
  const { data: nivelesRubrica = [] } = useNivelesRubrica()

  const { data: alumno, isLoading, error } = useQuery({
    queryKey: ['alumno', id],
    queryFn: () => obtenerAlumno(id),
  })

  const { data: historial } = useQuery({
    queryKey: ['alumno', id, 'historial'],
    queryFn: () => obtenerHistorialAlumno(id),
    enabled: Boolean(alumno),
  })

  const nivelesPorDimension = useMemo(
    () => agruparNivelesRubrica(nivelesRubrica)[alumno?.id_programa] ?? {},
    [nivelesRubrica, alumno],
  )

  if (isLoading) return <Skeleton variant="card" />
  if (error || !alumno) {
    return (
      <EmptyState
        title="No se encontró al estudiante"
        description="Puede que el código ya no exista o que no tenga acceso a ese colegio."
        action={
          <Link
            to="/estudiantes"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          >
            Volver a estudiantes
          </Link>
        }
      />
    )
  }

  const variacion = alumno.variacion ?? {}
  const delta = (variacion.orden_actual ?? 0) - (variacion.orden_anterior ?? 0)
  const dirVariacion =
    variacion.orden_anterior == null ? 'unknown' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  const mes = alumno.mes_actual ?? {}

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/estudiantes"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a estudiantes
      </Link>

      {/* RN-019: nombre, código y datos académicos. Nada más. */}
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-surface-0 p-5 shadow-card">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{alumno.nombre}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {alumno.codigo} · {alumno.colegio}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{alumno.grado_nombre}</Badge>
            {/* RN-004: ciclo nominal y ciclo evaluado son datos separados. */}
            <Badge tone={alumno.id_ciclo_evaluado !== alumno.id_ciclo_nominal ? 'warning' : 'neutral'}>
              Ciclo nominal {alumno.ciclo_nominal} · evaluado {alumno.ciclo_evaluado}
            </Badge>
            <Badge tone="info">{alumno.programa}</Badge>
            {alumno.aula && <Badge tone="neutral">Aula {alumno.aula}</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <LevelChip
            letra={alumno.nivel_actual}
            orden={alumno.orden_actual}
            totalNiveles={catalogoRazkids.length}
          />
          <RoleGate allow={[ROLES.JEFA, ROLES.DIRECTIVOS]}>
            {/* TODO: la exportación a PDF llega en la Fase 7 con `lib/export.js`. */}
            <Button variant="outline" size="sm" iconLeft={FileDown} disabled>
              Exportar ficha
            </Button>
          </RoleGate>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Nivel actual"
          value={alumno.nivel_actual ?? '—'}
          hint={`Esperado para su grado: ${alumno.nivel_esperado ?? '—'}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Variación"
          value={variacion.orden_anterior == null ? '—' : `${delta > 0 ? '+' : ''}${delta}`}
          hint={
            variacion.anterior
              ? `${variacion.anterior} → ${variacion.actual ?? '—'}`
              : 'Sin periodo anterior'
          }
          trend={{ dir: dirVariacion }}
        />
        <StatCard
          icon={BookOpen}
          label="Libros del mes"
          value={mes.total_libros ?? 0}
          hint={`${mes.lsb ?? 0} de subir de nivel · ${mes.lsl ?? 0} de sala de lectura`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Asistencia del mes"
          value={`${porcentaje(mes.asistencias ?? 0, mes.semanas_registradas ?? 0)}%`}
          hint={`${mes.asistencias ?? 0} de ${mes.semanas_registradas ?? 0} semanas registradas`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card
          title="Evolución entre evaluaciones diagnósticas"
          subtitle="El nivel de la prueba y el ajustado por el docente conviven como series distintas"
        >
          <Suspense fallback={<Skeleton variant="chart" />}>
            <GraficoEvolucion datos={historial?.evolucion ?? []} catalogoRazkids={catalogoRazkids} />
          </Suspense>
        </Card>

        <Card title="Rúbrica semanal del mes" subtitle="Fluidez y Comprensión nunca se promedian">
          <Suspense fallback={<Skeleton variant="chart" />}>
            <GraficoRubricaSemanal
              datos={historial?.rubrica_mensual ?? []}
              nivelesPorDimension={nivelesPorDimension}
            />
          </Suspense>
        </Card>
      </div>

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
          rows={historial?.libros ?? []}
          getRowId={(s) => s.id_semana}
          initialPageSize={8}
          footNote="Cero libros es un valor válido en semanas sin actividad lectiva."
        />
      </Card>

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
          rows={historial?.evaluaciones ?? []}
          getRowId={(e) => e.id_evaluacion}
          paginated={false}
          empty={<EmptyState title="Sin evaluaciones" description="Este estudiante aún no tiene cortes registrados." />}
        />
      </Card>
    </div>
  )
}
