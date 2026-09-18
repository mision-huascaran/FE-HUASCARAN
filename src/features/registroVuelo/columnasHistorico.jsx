// Cubre: RF-011, RF-021, RF-023, RF-024, RN-012, RN-014
import { Link } from 'react-router-dom'
import { Clock, Eye, Pencil } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import LevelChip from '../../components/ui/LevelChip'
import RoleGate from '../../components/ui/RoleGate'
import TrendIndicator from '../../components/ui/TrendIndicator'
import { ROLES } from '../../auth/roles'

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

/**
 * Columnas del histórico del registro de vuelo (P6):
 * Alumno · Grado · Abril · Julio · Octubre · Diciembre · Últimos 3 · Tendencia ·
 * Sugerencia · Estado · Acciones.
 */
export default function columnasHistorico({ catalogos, onEditar, onVer }) {
  const setEditando = onEditar
  const setViendo = onVer
  return [
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

export function LeyendaEstado({ tono, texto }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tono}>{texto.split(' — ')[0]}</Badge>
      <span className="text-xs text-ink-500">{texto.split(' — ')[1]}</span>
    </span>
  )
}
