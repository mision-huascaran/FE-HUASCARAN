// Cubre: RF-004, RN-004, RN-019
import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import LevelChip from '../../components/ui/LevelChip'

const TONO_ESTADO = { revisado: 'success', pendiente: 'info', error: 'danger', 'sin-registro': 'neutral' }

const ETIQUETA_ESTADO = {
  revisado: 'Evaluado',
  pendiente: 'Pendiente',
  error: 'Con error',
  'sin-registro': 'Sin evaluación',
}

/** Columnas del listado de estudiantes (P10). RN-019: solo nombre, código y datos académicos. */
export default function columnasEstudiantes({ programas, catalogoRazkids }) {
  return [
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
}
