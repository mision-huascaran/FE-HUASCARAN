// Cubre: RF-004, RF-011, RF-016, RN-004, RN-019
import Badge from '../../components/ui/Badge'
import LevelChip from '../../components/ui/LevelChip'
import Skeleton from '../../components/ui/Skeleton'

/** Ficha resumida del alumno, en lectura (P11). */
export default function ResumenFicha({ ficha, cargando, catalogoRazkids }) {
  if (cargando || !ficha) return <Skeleton variant="card" />
  const mes = ficha.mes_actual ?? {}

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{ficha.grado_nombre}</Badge>
        <Badge tone={ficha.id_ciclo_evaluado !== ficha.id_ciclo_nominal ? 'warning' : 'neutral'}>
          Ciclo nominal {ficha.ciclo_nominal} · evaluado {ficha.ciclo_evaluado}
        </Badge>
        <Badge tone="info">{ficha.programa}</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Nivel actual" valor={<LevelChip letra={ficha.nivel_actual} orden={ficha.orden_actual} totalNiveles={catalogoRazkids.length} />} />
        <Dato titulo="Esperado del grado" valor={<LevelChip letra={ficha.nivel_esperado} />} />
        <Dato titulo="Libros del mes" valor={<span className="font-semibold tabular-nums text-ink-900">{mes.total_libros ?? 0}</span>} />
        <Dato
          titulo="Asistencia del mes"
          valor={<span className="font-semibold tabular-nums text-ink-900">{mes.asistencias ?? 0}/{mes.semanas_registradas ?? 0}</span>}
        />
      </dl>

      <p className="text-xs text-ink-500">
        La evolución, las rúbricas semanales y el historial completo están en la ficha del estudiante.
      </p>
    </div>
  )
}

function Dato({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{titulo}</dt>
      <dd className="mt-2">{valor}</dd>
    </div>
  )
}

