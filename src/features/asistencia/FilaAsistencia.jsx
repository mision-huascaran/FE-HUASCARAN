// Una fila de la lista de asistencia (CU022, paso 6).
//
// Tres columnas: Alumno, Asistencia (el Segmented Control) y Observación (un
// globo de texto que abre el modal).
//
// Dos señales que importan y que el contrato manda por separado:
//
//   · `activo: false` — alumno dado de baja que YA constaba ese día. Solo
//     aparece al consultar una fecha pasada, y hay que marcarlo o el docente
//     creerá que sigue matriculado.
//   · `en_aula: false` — tuvo registro en esta clase pero hoy está en otra
//     aula (rotó de colegio, grado o subprograma). Su registro sigue siendo de
//     esta clase, así que se muestra igual.
import { MessageSquare, MessageSquareText } from 'lucide-react'
import ControlSegmentado from './ControlSegmentado'

function Etiqueta({ children, titulo }) {
  return (
    <span
      title={titulo}
      className="ml-2 whitespace-nowrap rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-ink-500"
    >
      {children}
    </span>
  )
}

export default function FilaAsistencia({ alumno, estado, observacion, soloLectura, alto, onMarcar, onObservar }) {
  const nombre = `${alumno.nombres} ${alumno.apellidos}`
  const conNota = Boolean(observacion)
  const Globo = conNota ? MessageSquareText : MessageSquare

  return (
    <tr className="border-t border-line" style={{ height: alto }}>
      <td className="px-4 py-2">
        <span className="font-medium text-ink-900">{alumno.apellidos}</span>
        <span className="text-ink-700">{`, ${alumno.nombres}`}</span>
        {alumno.activo === false && <Etiqueta titulo="Dado de baja: tenía registro este día">Inactivo</Etiqueta>}
        {alumno.en_aula === false && (
          <Etiqueta titulo="Hoy pertenece a otra aula; este registro es de esta clase">Rotó de aula</Etiqueta>
        )}
      </td>

      <td className="px-4 py-2 text-center">
        <ControlSegmentado
          valor={estado}
          nombre={nombre}
          deshabilitado={soloLectura}
          onElegir={(valor) => onMarcar(alumno, valor)}
        />
      </td>

      <td className="px-4 py-2 text-center">
        <button
          type="button"
          // Una nota existente se puede LEER aunque no se pueda escribir.
          disabled={soloLectura && !conNota}
          onClick={() => onObservar(alumno)}
          aria-label={`${conNota ? 'Ver' : 'Añadir'} observación de ${nombre}`}
          title={conNota ? observacion : 'Sin observación'}
          className={[
            'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            // Relleno y en oscuro cuando hay nota: se ve a simple vista cuál
            // de las treinta filas lleva una.
            conNota
              ? 'border-brand-600 bg-brand-100 text-brand-700'
              : 'border-line text-ink-400 hover:border-brand-500/60 hover:text-ink-700',
            soloLectura && !conNota ? 'cursor-not-allowed opacity-60' : '',
          ].join(' ')}
        >
          <Globo className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>
    </tr>
  )
}
