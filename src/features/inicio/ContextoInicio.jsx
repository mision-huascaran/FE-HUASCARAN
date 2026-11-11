// La línea bajo el título de Inicio: el rol, la fecha de hoy y lo que la
// pantalla ya sepa del calendario.
//
// EL PERIODO ACADÉMICO NO SALE AQUÍ porque ninguno de los dos endpoints de
// Inicio lo trae, y no se pide aparte: el periodo depende del colegio (CU027),
// así que alguien con dos colegios puede estar en PA3 en uno y en receso en el
// otro. El Docente sí tiene la semana en curso, que es del calendario.
import { Fragment } from 'react'
import { hoy } from '../../lib/relojServidor'
import { formatearDiaLargo } from '../../lib/format'

export default function ContextoInicio({ rol, extra }) {
  const partes = [rol, formatearDiaLargo(hoy()), extra].filter(Boolean)
  // Cada parte entera en su línea: en el teléfono "Semana del 9 – 13 nov" no
  // se corta por la mitad.
  return (
    <p className="mt-1 pl-3.5 text-sm text-ink-700">
      {partes.map((parte, i) => (
        <Fragment key={parte}>
          {i > 0 && ' · '}
          <span className="whitespace-nowrap">{parte}</span>
        </Fragment>
      ))}
    </p>
  )
}
