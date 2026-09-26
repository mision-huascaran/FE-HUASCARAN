// Cubre: RF-018, RF-023, RN-014, RN-015
import { Link } from 'react-router-dom'
import { SlidersHorizontal, TriangleAlert } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import LevelChip from '../../components/ui/LevelChip'
import Tooltip from '../../components/ui/Tooltip'

/** Menos de tres rúbricas semanales no sustentan un consolidado mensual (RF-018). */
export const MINIMO_SEMANAS = 3

/** Columnas del consolidado mensual (P9). */
export default function columnasNivelFinal({ catalogoRazkids, setAjustando }) {
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
}
