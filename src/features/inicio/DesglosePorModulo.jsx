// El desglose por módulo de los vencidos y los incompletos (CU011, tanda 10).
//
// POR QUÉ HACE FALTA. "40 registros vencidos" no le dice al Supervisor qué
// hacer: 40 asistencias son cuarenta clases sin pasar lista y 40 rúbricas son
// la evaluación del mes sin empezar, y se resuelven de formas distintas. El
// desglose convierte una cifra en una decisión.
//
// Una tabla de dos filas (Vencidos, Incompletos) por los cuatro módulos.
//
// Y LOS CEROS SE PINTAN, en gris. Un módulo en 0 no es un hueco: es la
// información de que ahí no hay nada que perseguir. Ocultarlo dejaría al
// Supervisor sin saber si el módulo está al día o si el servidor no lo calculó.
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

/** Vencidos en rojo y incompletos en ámbar, como sus tarjetas. */
const FILAS = [
  { clave: 'vencidos', nombre: 'Vencidos', color: 'text-danger-600' },
  { clave: 'incompletos', nombre: 'Incompletos', color: 'text-warning-600' },
]

function Celda({ cuantos, fila, modulo }) {
  // Un módulo que el servidor no nombró no se puede afirmar en 0.
  if (cuantos == null) return <span className="text-ink-500">—</span>
  if (cuantos <= 0) return <span className="text-ink-500">{cuantos}</span>
  return (
    <Link
      to={modulo.ruta}
      title={`Ir a ${modulo.nombre}`}
      aria-label={`${fila.nombre} en ${modulo.nombre}: ${cuantos}. Ir a ${modulo.nombre}`}
      className={`inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-md px-1.5 font-bold underline decoration-1 underline-offset-2 hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${fila.color}`}
    >
      {cuantos}
    </Link>
  )
}

/**
 * @param vencidos, incompletos el objeto del contrato, o `null` si el servidor
 *   no lo manda. Un servidor sin actualizar no lo trae, y entonces esa fila no
 *   se pinta en vez de cuatro ceros que serían mentira.
 */
export default function DesglosePorModulo({ vencidos, incompletos }) {
  const desgloses = { vencidos, incompletos }
  const filas = FILAS.filter((f) => desgloses[f.clave])
  if (!filas.length) return null

  return (
    <div className="-mx-1 overflow-x-auto">
      {/* Compacta: en pantallas anchas no se estira a todo el bloque. */}
      <table className="w-full min-w-[18rem] max-w-2xl table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <td className="w-[5.5rem] px-1 pb-2 sm:w-32" />
            {MODULOS.map((m) => (
              <th key={m.clave} scope="col" className="px-0.5 pb-2 text-center text-[11px] font-medium leading-tight text-ink-500 sm:text-xs">
                {m.nombre}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.clave} className="border-b border-line/60 last:border-b-0">
              <th scope="row" className="py-1.5 pl-1 pr-2 text-left text-[13px] font-medium text-ink-700 sm:text-sm">
                {fila.nombre}
              </th>
              {MODULOS.map((m) => (
                <td key={m.clave} className="px-1 py-1.5 text-center tabular-nums">
                  <Celda cuantos={desgloses[fila.clave][m.clave]} fila={fila} modulo={m} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
