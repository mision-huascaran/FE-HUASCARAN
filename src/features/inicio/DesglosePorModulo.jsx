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
//
// Y CADA MÓDULO CON ALGO PENDIENTE LLEVA A SU PANTALLA (auditoría de UX #737,
// U12): el Supervisor veía "Rúbrica 72" y no tenía forma de ir a corregirlo.
import { Link } from 'react-router-dom'

const MODULOS = [
  { clave: 'asistencias', nombre: 'Asistencias', ruta: '/asistencia' },
  { clave: 'lectura', nombre: 'Lectura', ruta: '/seguimiento-lectura' },
  { clave: 'rubrica', nombre: 'Rúbrica', ruta: '/rubrica' },
  { clave: 'registro_vuelo', nombre: 'Registro de Vuelo', ruta: '/registro-vuelo' },
]

const CHIP = 'flex items-baseline gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm'

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
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {MODULOS.map(({ clave, nombre, ruta }) => {
          const cuantos = desglose[clave]
          // Un módulo que el servidor no nombró se omite; uno en 0 se pinta.
          if (cuantos == null) return null
          const contenido = (
            <>
              <span className="text-ink-700">{nombre}</span>
              <span className={cuantos > 0 ? 'font-bold text-warning-600' : 'font-semibold text-ink-500'}>{cuantos}</span>
            </>
          )
          return (
            <li key={clave}>
              {cuantos > 0 ? (
                <Link
                  to={ruta}
                  title={`Ir a ${nombre}`}
                  className={`${CHIP} border-warning-600/30 bg-warning-100 transition-colors hover:border-warning-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
                >
                  {contenido}
                </Link>
              ) : (
                <span className={`${CHIP} border-line bg-surface-0`}>{contenido}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
