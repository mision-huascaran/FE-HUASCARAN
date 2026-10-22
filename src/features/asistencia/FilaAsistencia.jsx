// Una fila de la lista de asistencia (CU022, paso 6).
//
// Tres columnas: Alumno, Asistencia (el Segmented Control) y Observación (un
// globo de texto que abre el modal).
//
// UNA SOLA SEÑAL, desde la tanda 6: `inactivo`.
//
// Antes eran dos —`activo` y `en_aula`— porque había que distinguir al dado de
// baja del que rotó de aula. Ya no hace falta: la clase CONGELA su lista en la
// primera escritura, así que quien entró sigue en la tabla pase lo que pase
// después, y lo único que interesa decir es si hoy está inactivo.
//
// El nombre llega entero en `nombre`: se acabaron `nombres` y `apellidos` por
// separado, y con ellos el orden que armaba la fila.
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
  const nombre = alumno.nombre ?? ''
  const conNota = Boolean(observacion)
  const Globo = conNota ? MessageSquareText : MessageSquare

  return (
    <tr className="border-t border-line" style={{ height: alto }}>
      <td className="px-4 py-2">
        <span className="font-medium text-ink-900">{nombre}</span>
        {alumno.inactivo && (
          <Etiqueta titulo="Dado de baja: estaba en la clase cuando se registró">Inactivo</Etiqueta>
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
