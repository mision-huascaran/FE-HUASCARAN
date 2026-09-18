// Cubre: RF-002, RF-003, RF-004, RF-007, RF-010, RN-001, RN-004, RN-019
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Switch from '../../components/ui/Switch'
import { listarAlumnos } from '../../api/resources/alumnos'
import { obtenerAsignaciones } from '../../api/resources/docentes'
import { useColegios, useGrados, useNivelesRazkids, useProgramas } from '../../hooks/useCatalogos'
import useFiltrosStore from '../../store/filtrosStore'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

const TONO_ESTADO = { revisado: 'success', pendiente: 'info', error: 'danger', 'sin-registro': 'neutral' }
const ETIQUETA_ESTADO = {
  revisado: 'Evaluado',
  pendiente: 'Pendiente',
  error: 'Con error',
  'sin-registro': 'Sin evaluación',
}

export default function EstudiantesPage() {
  const idRol = useSessionStore((s) => s.usuario?.id_rol)
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)

  const esProfesor = idRol === ROLES.PROFESOR
  const [verOtros, setVerOtros] = useState(false)
  const [filtros, setFiltros] = useState({ colegio: '', grado: '', aula: '', programa: '', estado: '', q: '' })

  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()

  // RN-001 / §5: el Profesor ve por defecto solo los colegios que tiene asignados.
  const { data: asignaciones = [] } = useQuery({
    queryKey: ['asignaciones', idDocente, idPeriodo],
    queryFn: () => obtenerAsignaciones(idDocente, idPeriodo),
    enabled: Boolean(esProfesor && idDocente && idPeriodo),
  })

  const idsAsignados = useMemo(() => new Set(asignaciones.map((a) => a.id_colegio)), [asignaciones])

  const colegiosVisibles = esProfesor && !verOtros
    ? colegios.filter((c) => idsAsignados.has(c.id_colegio))
    : colegios

  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ['alumnos', filtros],
    queryFn: () => listarAlumnos(filtros),
  })

  // RF-003: en modo consulta el Profesor ve otros colegios, pero solo de lectura.
  const enModoConsulta =
    esProfesor && verOtros && Boolean(filtros.colegio) && !idsAsignados.has(Number(filtros.colegio))

  const filas = useMemo(() => {
    const permitidos = new Set(colegiosVisibles.map((c) => c.id_colegio))
    const visibles = alumnos.filter((a) => permitidos.has(a.id_colegio))
    if (!filtros.aula) return visibles
    return visibles.filter((a) => a.aula === filtros.aula)
  }, [alumnos, colegiosVisibles, filtros.aula])

  const cambiar = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }))

  const columnas = [
    {
      key: 'codigo',
      header: 'Código',
      sortable: true,
      className: 'font-medium text-ink-900 whitespace-nowrap',
    },
    {
      key: 'nombre',
      header: 'Estudiante',
      sortable: true,
      render: (a) => (
        <Link
          to={`/estudiantes/${a.id_alumno}`}
          className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
        >
          {a.nombre}
        </Link>
      ),
    },
    { key: 'colegio', header: 'Colegio', sortable: true },
    {
      key: 'grado',
      header: 'Grado y ciclo',
      align: 'center',
      sortValue: (a) => a.id_grado,
      render: (a) => (
        <span className="whitespace-nowrap text-xs">
          {a.id_grado}.° <span className="text-ink-400">· ciclo {a.ciclo_nominal}</span>
        </span>
      ),
    },
    {
      // RN-004: el ciclo evaluado es un dato distinto del ciclo nominal del grado.
      key: 'ciclo_evaluado',
      header: 'Ciclo evaluado',
      align: 'center',
      render: (a) => (
        <span
          className={
            a.id_ciclo_evaluado !== a.id_ciclo_nominal
              ? 'rounded-full bg-warning-100 px-2 py-0.5 text-xs font-semibold text-warning-600'
              : 'text-xs text-ink-700'
          }
        >
          {a.ciclo_evaluado}
        </span>
      ),
    },
    {
      key: 'id_programa',
      header: 'Programa',
      sortable: true,
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-ink-700">
          {programas.find((p) => p.id_programa === a.id_programa)?.nombre ?? '—'}
        </span>
      ),
    },
    {
      key: 'nivel_actual',
      header: 'Nivel actual',
      align: 'center',
      sortValue: (a) => a.orden_actual,
      render: (a) => (
        <LevelChip letra={a.nivel_actual} orden={a.orden_actual} totalNiveles={catalogoRazkids.length} />
      ),
    },
    {
      key: 'ultima_evaluacion',
      header: 'Última evaluación',
      align: 'center',
      render: (a) => (
        <span className="whitespace-nowrap text-xs text-ink-500">{a.ultima_evaluacion?.nombre ?? '—'}</span>
      ),
    },
    {
      key: 'estado_evaluacion',
      header: 'Estado',
      align: 'center',
      sortable: true,
      render: (a) => (
        <Badge tone={TONO_ESTADO[a.estado_evaluacion]}>{ETIQUETA_ESTADO[a.estado_evaluacion]}</Badge>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Estudiantes</h1>
        <p className="mt-1 text-sm text-ink-500">
          Cada estudiante se identifica por su código del sistema, no por el número de lista.
        </p>
      </header>

      {enModoConsulta && <AvisoModoConsulta />}

      {/* RF-003: interruptor para consultar colegios no asignados, en solo lectura. */}
      {esProfesor && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-0 p-4 shadow-card">
          <div>
            <p className="text-sm font-semibold text-ink-900">Ver otros colegios (solo lectura)</p>
            <p className="text-xs text-ink-500">
              Por defecto solo aparecen los colegios que tiene asignados en el periodo vigente.
            </p>
          </div>
          <Switch
            checked={verOtros}
            onChange={setVerOtros}
            label="Ver otros colegios en modo consulta"
          />
        </div>
      )}

      <FilterBar
        search={filtros.q}
        onSearchChange={(valor) => setFiltros((f) => ({ ...f, q: valor }))}
        searchPlaceholder="Buscar por nombre o código"
        onClear={() => setFiltros({ colegio: '', grado: '', aula: '', programa: '', estado: '', q: '' })}
        activeCount={Object.values(filtros).filter(Boolean).length}
      >
        <Select
          label="Colegio"
          value={filtros.colegio}
          onChange={cambiar('colegio')}
          placeholder="Todos"
          options={colegiosVisibles.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={filtros.grado}
          onChange={cambiar('grado')}
          placeholder="Todos"
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
        />
        <Select
          label="Aula"
          value={filtros.aula}
          onChange={cambiar('aula')}
          placeholder="Todas"
          options={[{ value: 'A', label: 'Aula A' }, { value: 'B', label: 'Aula B' }]}
        />
        <Select
          label="Programa"
          value={filtros.programa}
          onChange={cambiar('programa')}
          placeholder="Todos"
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
      </FilterBar>

      <Card padded={false}>
        <DataTable
          columns={columnas}
          rows={filas}
          loading={isLoading}
          getRowId={(a) => a.id_alumno}
          initialPageSize={25}
          stickyFirstColumn
          empty={
            <EmptyState
              icon={Users}
              title="Sin estudiantes"
              description="Ningún estudiante coincide con los filtros seleccionados."
            />
          }
          footNote="Ley N.° 29733: el sistema solo muestra nombre, código y datos académicos del estudiante."
        />
      </Card>
    </div>
  )
}
