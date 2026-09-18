// Cubre: RF-018, RF-019, RF-023, RF-024, RN-009, RN-014, RN-015, RNF-005
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Tooltip from '../../components/ui/Tooltip'
import DrawerAjuste from './DrawerAjuste'
import { listarNivelFinal } from '../../api/resources/nivelFinal'
import {
  useColegios,
  useGrados,
  useNivelGeneral,
  useNivelesRazkids,
  useProgramas,
  useSemanas,
} from '../../hooks/useCatalogos'

/** Menos de tres rúbricas semanales no sustentan un consolidado mensual (RF-018). */
const MINIMO_SEMANAS = 3

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

export default function NivelFinalPage() {
  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data: nivelesGenerales = [] } = useNivelGeneral()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()
  const { data: semanas = [] } = useSemanas()

  // Los meses disponibles son los que tienen semanas lectivas cargadas.
  const meses = useMemo(() => {
    const claves = [...new Set(semanas.map((s) => `${s.anio}-${String(s.mes).padStart(2, '0')}`))]
    return claves.map((clave) => {
      const [anio, mes] = clave.split('-').map(Number)
      return { value: clave, label: `${MESES[mes - 1]} ${anio}` }
    })
  }, [semanas])

  const [filtros, setFiltros] = useState({ mes: '', colegio: '', grado: '', programa: '', estado: '' })
  const [ajustando, setAjustando] = useState(null)

  const mes = filtros.mes || meses.at(-1)?.value || ''

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['nivel-final', { ...filtros, mes }],
    queryFn: () => listarNivelFinal({ ...filtros, mes }),
    enabled: Boolean(mes && filtros.colegio),
  })

  const cambiar = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }))

  const columnas = [
    {
      key: 'nombre',
      header: 'Alumno',
      sortable: true,
      render: (f) => (
        <div className="min-w-[12rem]">
          <Link
            to={`/estudiantes/${f.id_alumno}`}
            className="font-medium text-ink-900 hover:text-brand-700 hover:underline"
          >
            {f.nombre}
          </Link>
          <p className="text-xs text-ink-400">{f.codigo}</p>
        </div>
      ),
    },
    {
      // RN-014: el nivel de Raz-Kids acompaña como referencia, no manda.
      key: 'razkids_referencial',
      header: 'Raz-Kids referencial',
      align: 'center',
      render: (f) => <LevelChip letra={f.razkids_referencial} totalNiveles={catalogoRazkids.length} />,
    },
    {
      key: 'nivel_calculado',
      header: 'Nivel calculado',
      sortable: true,
      render: (f) => <LevelChip nivel={f.nivel_calculado} />,
    },
    {
      key: 'nivel_final',
      header: 'Nivel final',
      sortable: true,
      render: (f) => <LevelChip nivel={f.nivel_final} />,
    },
    {
      // RF-018: cuántas rúbricas semanales sustentan el consolidado.
      key: 'semanas_sustento',
      header: 'Sustento',
      align: 'center',
      sortValue: (f) => f.semanas_sustento,
      render: (f) => {
        const insuficiente = f.semanas_sustento < MINIMO_SEMANAS
        const texto = `${f.semanas_sustento} de ${f.semanas_mes} semanas`
        return insuficiente ? (
          <Tooltip content={`Con menos de ${MINIMO_SEMANAS} rúbricas semanales el consolidado del mes es poco confiable.`}>
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning-100 px-2 py-0.5 text-xs font-semibold text-warning-600">
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {texto}
            </span>
          </Tooltip>
        ) : (
          <span className="whitespace-nowrap text-xs tabular-nums text-ink-500">{texto}</span>
        )
      },
    },
    {
      key: 'ajustado',
      header: '¿Ajustado?',
      align: 'center',
      sortable: true,
      render: (f) => (f.ajustado ? <Badge tone="warning">Ajustado</Badge> : <Badge tone="neutral">No</Badge>),
    },
    {
      key: 'justificacion',
      header: 'Justificación',
      render: (f) => (
        <span className="block max-w-xs truncate text-xs text-ink-500" title={f.justificacion ?? ''}>
          {f.justificacion ?? '—'}
        </span>
      ),
    },
    { key: 'docente', header: 'Docente', render: (f) => <span className="text-xs text-ink-500">{f.docente}</span> },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (f) => (
        <button
          type="button"
          onClick={() => setAjustando(f)}
          aria-label={`Ajustar nivel final de ${f.nombre}`}
          title="Ajustar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Nivel final mensual</h1>
        <p className="mt-1 text-sm text-ink-500">
          El consolidado del mes se deriva de las rúbricas semanales: el sistema lo calcula y el docente
          puede ajustarlo con una justificación.
        </p>
      </header>

      <FilterBar
        onClear={() => setFiltros({ mes: '', colegio: '', grado: '', programa: '', estado: '' })}
        activeCount={Object.values(filtros).filter(Boolean).length}
      >
        <Select
          label="Mes"
          value={mes}
          onChange={cambiar('mes')}
          options={meses}
        />
        <Select
          label="Colegio"
          required
          value={filtros.colegio}
          onChange={cambiar('colegio')}
          placeholder="Seleccione un colegio"
          options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={filtros.grado}
          onChange={cambiar('grado')}
          placeholder="Todos"
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
        />
        <Select
          label="Programa"
          value={filtros.programa}
          onChange={cambiar('programa')}
          placeholder="Todos"
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
        <Select
          label="Estado"
          value={filtros.estado}
          onChange={cambiar('estado')}
          placeholder="Todos"
          options={[
            { value: 'ajustados', label: 'Ajustados' },
            { value: 'sin-ajustar', label: 'Sin ajustar' },
          ]}
        />
      </FilterBar>

      <Card padded={false}>
        {!filtros.colegio ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Elija un colegio"
            description="El consolidado mensual se revisa colegio por colegio."
          />
        ) : (
          <DataTable
            columns={columnas}
            rows={filas}
            loading={isLoading}
            getRowId={(f) => f.id_nivel_final}
            initialPageSize={10}
            stickyFirstColumn
            footNote={`El consolidado se deriva de las rúbricas semanales del mes. Con menos de ${MINIMO_SEMANAS} semanas registradas se marca en advertencia.`}
          />
        )}
      </Card>

      <DrawerAjuste
        open={Boolean(ajustando)}
        onClose={() => setAjustando(null)}
        fila={ajustando}
        nivelesGenerales={nivelesGenerales}
        mes={mes}
      />
    </div>
  )
}
