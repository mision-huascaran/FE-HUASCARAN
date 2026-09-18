// Cubre: RF-011, RF-020, RF-021, RF-023, RF-024, RN-005, RN-010, RN-011, RN-014, RN-015
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Eye, Pencil, Plane, Plus } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import LevelChip from '../../components/ui/LevelChip'
import RoleGate from '../../components/ui/RoleGate'
import Select from '../../components/ui/Select'
import TrendIndicator from '../../components/ui/TrendIndicator'
import DrawerEvaluacion from './DrawerEvaluacion'
import ModalTrazabilidad from './ModalTrazabilidad'
import useHistoricoVuelo from './useHistoricoVuelo'
import { ROLES } from '../../auth/roles'
import { aniosDe } from './constantes'

const TONO_ESTADO = {
  revisado: 'success',
  pendiente: 'info',
  error: 'danger',
  'sin-registro': 'neutral',
}

const ETIQUETA_ESTADO = {
  revisado: 'Revisado',
  pendiente: 'Pendiente',
  error: 'Con error',
  'sin-registro': 'Sin registro',
}

export default function RegistroVueloPage() {
  const navegar = useNavigate()
  const { catalogos, borrador, setCampo, aplicar, limpiar, activos, filas, cargando, sinColegio } =
    useHistoricoVuelo()
  const [editando, setEditando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const anios = aniosDe(catalogos.periodos)

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
    { key: 'grado_nombre', header: 'Grado', align: 'center', sortable: true },
    // Un corte por columna: Abril · Julio · Octubre · Diciembre.
    ...catalogos.periodos.map((p) => ({
      key: `periodo-${p.id_periodo}`,
      header: p.nombre,
      align: 'center',
      sortValue: (f) => f.por_periodo?.[p.id_periodo]?.orden ?? null,
      render: (f) => {
        const celda = f.por_periodo?.[p.id_periodo]
        if (!celda) return <span className="text-xs text-ink-400">—</span>
        return <LevelChip letra={celda.letra} orden={celda.orden} totalNiveles={catalogos.catalogoRazkids.length} />
      },
    })),
    {
      key: 'ultimos3',
      header: 'Últimos 3',
      render: (f) => <span className="whitespace-nowrap text-xs font-medium text-ink-700">{f.ultimos3}</span>,
    },
    {
      key: 'tendencia',
      header: 'Tendencia',
      render: (f) => <TrendIndicator dir={f.tendencia} />,
    },
    {
      key: 'sugerencia',
      header: 'Sugerencia',
      render: (f) => (
        <span className="whitespace-nowrap text-xs font-semibold text-ink-700">
          {f.calculo?.accion ?? 'Revisar'}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      sortable: true,
      render: (f) => <Badge tone={TONO_ESTADO[f.estado]}>{ETIQUETA_ESTADO[f.estado]}</Badge>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (f) => (
        <div className="flex items-center justify-center gap-1">
          <RoleGate allow={[ROLES.PROFESOR]}>
            <BotonIcono etiqueta="Editar evaluación" icon={Pencil} onClick={() => setEditando(f)} />
          </RoleGate>
          <BotonIcono
            etiqueta="Ver trazabilidad"
            icon={Clock}
            onClick={() => setViendo(f)}
            disabled={!f.evaluacion}
          />
          <Link
            to={`/estudiantes/${f.id_alumno}`}
            aria-label="Ver detalle del estudiante"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Eye className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Registro de vuelo</h1>
          <p className="mt-1 text-sm text-ink-500">
            Las cuatro evaluaciones diagnósticas del año, alumno por alumno.
          </p>
        </div>
        <RoleGate allow={[ROLES.PROFESOR]}>
          <Button iconLeft={Plus} onClick={() => navegar('/registro-vuelo/nuevo')}>
            Registrar evaluación
          </Button>
        </RoleGate>
      </header>

      <FilterBar
        search={borrador.q}
        onSearchChange={(valor) => setCampo('q', valor)}
        searchPlaceholder="Buscar alumno por nombre o código"
        onApply={() => aplicar()}
        onClear={limpiar}
        activeCount={activos}
      >
        <Select
          label="Colegio"
          required
          value={borrador.colegio}
          onChange={(e) => setCampo('colegio', e.target.value)}
          placeholder="Seleccione un colegio"
          options={catalogos.colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={borrador.grado}
          onChange={(e) => setCampo('grado', e.target.value)}
          placeholder="Todos"
          options={catalogos.grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
        />
        <Select
          label="Programa"
          value={borrador.programa}
          onChange={(e) => setCampo('programa', e.target.value)}
          placeholder="Todos"
          options={catalogos.programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
        <Select
          label="Año"
          value={anios[0]?.value ?? ''}
          onChange={() => {}}
          options={anios}
          disabled={anios.length <= 1}
          hint="Solo el año lectivo en curso"
        />
        <Select
          label="Periodo"
          value={borrador.periodo}
          onChange={(e) => setCampo('periodo', e.target.value)}
          placeholder="Último registrado"
          options={catalogos.periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))}
        />
      </FilterBar>

      <Card padded={false}>
        {sinColegio ? (
          <EmptyState
            icon={Plane}
            title="Elija un colegio para ver el histórico"
            description="El registro de vuelo carga por colegio: son 413 estudiantes en total."
          />
        ) : (
          <DataTable
            columns={columnas}
            rows={filas}
            loading={cargando}
            getRowId={(f) => f.id_alumno}
            initialPageSize={10}
            stickyFirstColumn
            footNote={
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-semibold text-ink-700">Estados:</span>
                <LeyendaEstado tono="info" texto="Pendiente — aún no confirmada por el docente" />
                <LeyendaEstado tono="success" texto="Revisado — confirmada por el docente" />
                <LeyendaEstado tono="danger" texto="Con error — requiere revisión" />
              </span>
            }
          />
        )}
      </Card>

      <DrawerEvaluacion
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        fila={editando}
        periodos={catalogos.periodos}
        catalogoRazkids={catalogos.catalogoRazkids}
        esperadoPorGrado={catalogos.esperadoPorGrado}
      />

      <ModalTrazabilidad open={Boolean(viendo)} onClose={() => setViendo(null)} fila={viendo} />
    </div>
  )
}

function BotonIcono({ etiqueta, icon: Icon, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-surface-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function LeyendaEstado({ tono, texto }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tono}>{texto.split(' — ')[0]}</Badge>
      <span className="text-xs text-ink-500">{texto.split(' — ')[1]}</span>
    </span>
  )
}
