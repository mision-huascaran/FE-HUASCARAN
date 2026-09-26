// Cubre: RF-019, RF-021, RF-022, RN-009, RN-012, RN-013, RNF-005
import { ArrowDown } from 'lucide-react'
import Card from '../../components/ui/Card'
import LevelChip from '../../components/ui/LevelChip'
import Skeleton from '../../components/ui/Skeleton'

/**
 * Panel derecho "Resultados de la evaluación" (P7).
 *
 * Solo pinta: no calcula nada. Todo lo que muestra llega ya resuelto desde
 * `domain/nivelFinal.js`, que es la única fuente del cálculo (RN-009).
 */
export default function PanelResultados({ calculo, nivelInicial, nivelPrueba, aciertos, total, calculando }) {
  return (
    <Card title="Resultados de la evaluación" className="lg:sticky lg:top-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Datos de entrada</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Casilla titulo="Nivel inicial" valor={<LevelChip letra={nivelInicial?.letra} />} />
        <Casilla titulo="Prueba aplicada" valor={<LevelChip letra={nivelPrueba} />} />
        <Casilla
          titulo="Resultado"
          valor={
            <span className="font-display text-lg font-bold tabular-nums text-ink-900">
              {total ? `${aciertos || 0} / ${total}` : '—'}
            </span>
          }
        />
      </div>

      <div className="my-4 flex flex-col items-center gap-1">
        <ArrowDown className="h-5 w-5 text-ink-400" aria-hidden="true" />
        <p className="text-xs text-ink-500">El sistema evalúa los datos y las rúbricas</p>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Resultados calculados</p>

      {/* RNF-005: el cálculo es síncrono en el cliente; el Skeleton solo aparece
          si por alguna razón tardara. */}
      {calculando ? (
        <Skeleton variant="card" className="mt-3" />
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ResultadoCalculado
            titulo="Nivel sugerido"
            valor={<LevelChip letra={calculo?.nivelSugerido?.letra} />}
            detalle={calculo?.accion}
          />
          <ResultadoCalculado
            titulo="Nivel final de rúbrica"
            valor={<LevelChip nivel={calculo?.nivelGeneral} />}
            detalle={calculo?.nivelGeneral ? 'Según RN-013' : 'Faltan las dos dimensiones'}
          />
        </div>
      )}

      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-500">
        El nivel sugerido y el nivel final se calculan con la prueba, los aciertos y las rúbricas
        registradas.
      </p>
    </Card>
  )
}

function Casilla({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-line bg-surface-50 p-3 text-center">
      <p className="text-xs text-ink-400">{titulo}</p>
      <div className="mt-2 flex justify-center">{valor}</div>
    </div>
  )
}

function ResultadoCalculado({ titulo, valor, detalle }) {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
      <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-700">
        CALCULADO AUTOMÁTICAMENTE
      </span>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{titulo}</p>
      <div className="mt-2">{valor}</div>
      {detalle && <p className="mt-1 text-xs text-ink-500">{detalle}</p>}
    </div>
  )
}
