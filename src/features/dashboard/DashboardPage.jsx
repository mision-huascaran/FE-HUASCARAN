// Cubre: RF-005, RF-006, RF-007, RF-010, RN-002, RN-004, RNF-002
import { useQuery } from '@tanstack/react-query'
import { Award, CalendarCheck, TrendingUp, Users } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import Tabs from '../../components/ui/Tabs'
import GraficosDashboard from './GraficosDashboard'
import TablaColegios from './TablaColegios'
import useFiltrosDashboard from './useFiltrosDashboard'
import { obtenerDashboard } from '../../api/resources/dashboard'
import { mensajeDeError } from '../../api/client'
import { useColegios, useGrados, useNivelesRazkids, usePeriodos, useProgramas } from '../../hooks/useCatalogos'
import { formatoPct } from '../../components/charts/tema'

/**
 * Dashboard consolidado de los nueve colegios (P12).
 *
 * RF-006 es explícito: todo en UNA sola vista, con pestañas por colegio,
 * filtros y tarjetas de indicadores, sin navegar entre pantallas. Las pestañas
 * y el selector de colegio son el mismo filtro visto de dos formas.
 */
export default function DashboardPage() {
  const { filtros, cambiar, limpiar, activos } = useFiltrosDashboard()
  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data: periodos = [] } = usePeriodos()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()

  const consulta = useQuery({
    queryKey: ['dashboard', filtros],
    queryFn: () => obtenerDashboard(filtros),
    enabled: Boolean(filtros.periodo),
    placeholderData: (previos) => previos,
  })

  const datos = consulta.data
  const ind = datos?.indicadores
  const periodo = periodos.find((p) => p.id_periodo === Number(filtros.periodo))
  const al = (clave) => (e) => cambiar({ [clave]: e.target.value })

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Dashboard consolidado</h1>
        <p className="mt-1 text-sm text-ink-500">
          Los nueve colegios en una sola vista{periodo ? ` · corte de ${periodo.nombre}` : ''}. Los filtros
          quedan en la dirección de la página: puede compartir esta vista tal cual.
        </p>
      </header>

      <FilterBar
        search={filtros.q}
        onSearchChange={(valor) => cambiar({ q: valor })}
        searchPlaceholder="Estudiante (nombre o código)"
        onClear={limpiar}
        activeCount={activos}
      >
        <Select label="Programa" value={filtros.programa} onChange={al('programa')} placeholder="Todos" options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))} />
        <Select label="Colegio" value={filtros.colegio} onChange={al('colegio')} placeholder="Todos" options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))} />
        <Select label="Grado" value={filtros.grado} onChange={al('grado')} placeholder="Todos" options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))} />
        <Select label="Aula" value={filtros.aula} onChange={al('aula')} placeholder="Todas" options={[{ value: 'A', label: 'Aula A' }, { value: 'B', label: 'Aula B' }]} />
        <Select label="Periodo" value={filtros.periodo} onChange={al('periodo')} options={periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))} />
        <Select
          label="Dimensión"
          value={filtros.dimension}
          onChange={al('dimension')}
          placeholder="Nivel general"
          options={[{ value: 'Fluidez', label: 'Fluidez lectora' }, { value: 'Comprensión', label: 'Comprensión lectora' }]}
        />
      </FilterBar>

      <Tabs
        value={filtros.colegio || 'todos'}
        onChange={(valor) => cambiar({ colegio: valor === 'todos' ? '' : valor })}
        items={[
          { value: 'todos', label: 'Todos los colegios' },
          ...colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre.replace(/^I\.E\. \d+ /, '') })),
        ]}
      />

      {consulta.isError && (
        <EmptyState title="No se pudo cargar el dashboard" description={mensajeDeError(consulta.error)} />
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {!ind ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)
        ) : (
          <>
            <StatCard icon={Users} label="Estudiantes en el programa" value={ind.estudiantes} hint={`${ind.evaluados} evaluados en el corte`} />
            <StatCard icon={Award} label="En Logrado o Destacado" value={formatoPct(ind.pct_logro)} hint={filtros.dimension ? `Según ${filtros.dimension}` : 'Nivel general'} />
            <StatCard icon={CalendarCheck} label="Cobertura del periodo" value={formatoPct(ind.cobertura)} hint="Estudiantes con evaluación registrada" />
            <StatCard
              icon={TrendingUp}
              label="Subió de nivel"
              value={formatoPct(ind.pct_subio)}
              hint={ind.pct_subio == null ? 'Primer corte: no hay con qué comparar' : `Frente al corte anterior · ${ind.comparables} comparables`}
            />
          </>
        )}
      </div>

      <GraficosDashboard datos={datos} catalogoRazkids={catalogoRazkids} dimension={filtros.dimension} />

      <TablaColegios colegios={datos?.colegios ?? []} loading={consulta.isLoading} titulo="Resumen por colegio" />
    </div>
  )
}
