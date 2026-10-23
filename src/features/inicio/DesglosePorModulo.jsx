// El desglose por módulo de los vencidos y los incompletos (CU011, tanda 10).
//
// POR QUÉ HACE FALTA. "40 registros vencidos" no le dice al Supervisor qué
// hacer: 40 asistencias son cuarenta clases sin pasar lista y 40 rúbricas son
// la evaluación del mes sin empezar, y se resuelven de formas distintas. El
// desglose convierte una cifra en una decisión.
//
// Y LOS CEROS SE PINTAN. Un módulo en 0 no es un hueco: es la información de
// que ahí no hay nada que perseguir. Ocultarlo dejaría al Supervisor sin saber
// si el módulo está al día o si el servidor no lo calculó.
const MODULOS = [
  { clave: 'asistencias', nombre: 'Asistencias' },
  { clave: 'lectura', nombre: 'Lectura' },
  { clave: 'rubrica', nombre: 'Rúbrica' },
  { clave: 'registro_vuelo', nombre: 'Registro de Vuelo' },
]

/**
 * @param desglose el objeto del contrato, o `null` si el servidor no lo manda.
 *   Un servidor sin actualizar no lo trae, y entonces no se pinta nada en vez
 *   de cuatro ceros que serían mentira.
 */
export default function DesglosePorModulo({ titulo, desglose }) {
  if (!desglose) return null

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{titulo}</h4>
      <dl className="flex flex-wrap gap-2">
        {MODULOS.map(({ clave, nombre }) => {
          const cuantos = desglose[clave]
          // Un módulo que el servidor no nombró se omite; uno en 0 se pinta.
          if (cuantos == null) return null
          return (
            <div
              key={clave}
              className={[
                'flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm',
                cuantos > 0 ? 'border-warning-600/30 bg-warning-100' : 'border-line bg-surface-0',
              ].join(' ')}
            >
              <dt className="text-ink-700">{nombre}</dt>
              <dd className={cuantos > 0 ? 'font-bold text-warning-600' : 'font-semibold text-ink-500'}>{cuantos}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
