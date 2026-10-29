// El historial de declaraciones de "no realizada" (CU026, tanda D).
//
// POR QUÉ SE ENSEÑA AUNQUE LA TABLA YA ESTÉ NORMAL. Una declaración revertida
// no desaparece: la semana estuvo marcada como no realizada, sus filas no
// contaron como pendientes durante ese tiempo, y después alguien decidió lo
// contrario. El Supervisor que revisa tiene que poder ver las dos cosas y
// quién hizo cada una; si solo se viera el estado de hoy, una semana revertida
// y una que nunca se declaró se leerían igual.
//
// La más reciente va primero: así la manda el contrato y así se lee.
import { History } from 'lucide-react'
import { formatearFechaHora } from '../../lib/format'

const quien = (persona) => persona?.nombre ?? 'Alguien'

export default function HistorialDeclaraciones({ declaraciones = [] }) {
  if (!declaraciones.length) return null

  return (
    <details className="border-b border-line px-4 py-3 text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-ink-700">
        <History className="h-4 w-4 text-ink-400" aria-hidden="true" />
        Historial de declaraciones ({declaraciones.length})
      </summary>

      <ul className="mt-3 flex flex-col gap-3">
        {declaraciones.map((d) => (
          <li key={d.id} className="border-l-2 border-line pl-3">
            <p className="text-ink-900">
              <strong className="font-semibold">{quien(d.declarada_por)}</strong>
              {' declaró la lectura como no realizada el '}
              {formatearFechaHora(d.fecha_registro)}
              {d.vigente && <span className="ml-1 text-xs font-semibold text-warning-600">(vigente)</span>}
            </p>
            <p className="mt-0.5 text-ink-700">{d.motivo}</p>

            {/* La corrección, cuando la hubo. Es la otra mitad del hecho: sin
                ella no se entiende por qué la semana vuelve a ser registrable. */}
            {!d.vigente && d.fecha_registro_reversion && (
              <p className="mt-1 text-xs text-ink-500">
                {quien(d.revertida_por)}
                {' habilitó el registro el '}
                {formatearFechaHora(d.fecha_registro_reversion)}
                {d.motivo_correccion ? `: ${d.motivo_correccion}` : '.'}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
