// Cubre: RF-019, RF-022
import { Check } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

/** Paso 3 (P7) — resumen de todo lo ingresado antes de guardar. */
export default function PasoRevision({ alumno, nombrePeriodo, valores, nivelInicial, calculo, guardando, onCancelar, onGuardar }) {
  return (
    <Card title="Revisar y guardar" subtitle={`${alumno?.nombre} · ${nombrePeriodo}`}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Resumen termino="Estudiante" valor={alumno?.nombre} />
        <Resumen termino="Código" valor={alumno?.codigo} />
        <Resumen termino="Colegio" valor={alumno?.colegio} />
        <Resumen termino="Ciclo evaluado" valor={alumno?.ciclo_evaluado} />
        <Resumen termino="Periodo" valor={nombrePeriodo} />
        <Resumen termino="Nivel inicial" valor={nivelInicial?.letra ?? '—'} />
        <Resumen termino="Prueba aplicada" valor={valores.nivel_prueba} />
        <Resumen termino="Resultado" valor={`${valores.aciertos} / ${valores.total}`} />
        <Resumen termino="Fluidez" valor={valores.fluidez} />
        <Resumen termino="Comprensión" valor={valores.comprension} />
        <Resumen termino="Nivel sugerido" valor={calculo.nivelSugerido?.letra ?? '—'} />
        <Resumen termino="Nivel final de rúbrica" valor={calculo.nivelGeneral ?? '—'} />
      </dl>

      {valores.observacion && <p className="mt-4 rounded-xl bg-surface-50 p-3 text-sm text-ink-700">{valores.observacion}</p>}

      <p className="mt-5 flex items-center gap-2 rounded-xl border border-success-600/20 bg-success-100 px-4 py-3 text-sm font-medium text-success-600">
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        Todos los campos obligatorios están completos
      </p>

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={() => onGuardar('pendiente')} loading={guardando}>
          Guardar borrador
        </Button>
        <Button onClick={() => onGuardar('revisado')} loading={guardando}>
          Guardar evaluación
        </Button>
      </div>
    </Card>
  )
}

function Resumen({ termino, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{termino}</dt>
      <dd className="text-sm font-medium text-ink-900">{valor ?? '—'}</dd>
    </div>
  )
}
