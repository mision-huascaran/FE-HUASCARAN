// El Segmented Control de una fila de asistencia (CU022, pasos 6, 8 y 9).
//
// Tres estados, no dos. "Sin marcar" es un estado de pleno derecho: una clase
// nueva nace con TODOS los controles apagados, y es lo que distingue
// "todavía no lo he mirado" de "consta ausente". De ahí que el valor sea
// `true | false | null` y no un booleano.
//
// Los colores los fija el caso de uso al detalle: presente en verde con texto
// blanco, ausente en rojo con texto blanco, y el lado que no está elegido en
// gris claro con texto oscuro.
import { Check, X } from 'lucide-react'

const APAGADO = 'bg-surface-100 text-ink-700 hover:bg-line'

const LADOS = [
  { valor: true, etiqueta: 'Presente', icono: Check, encendido: 'bg-success-600 text-white', redondeo: 'rounded-l-lg' },
  { valor: false, etiqueta: 'Ausente', icono: X, encendido: 'bg-danger-600 text-white', redondeo: 'rounded-r-lg' },
]

export default function ControlSegmentado({ valor, nombre, deshabilitado, onElegir }) {
  return (
    <div
      role="group"
      aria-label={`Asistencia de ${nombre}`}
      className="inline-flex overflow-hidden rounded-lg border border-line"
    >
      {LADOS.map((lado) => {
        const elegido = valor === lado.valor
        const Icono = lado.icono
        return (
          <button
            key={lado.etiqueta}
            type="button"
            // `aria-pressed` es lo que permite a un lector de pantalla —y a las
            // pruebas— saber qué lado está encendido sin mirar los colores.
            aria-pressed={elegido}
            aria-label={`${lado.etiqueta}: ${nombre}`}
            disabled={deshabilitado}
            onClick={() => onElegir(lado.valor)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
              lado.redondeo,
              elegido ? lado.encendido : APAGADO,
              deshabilitado ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            <Icono className="h-4 w-4" aria-hidden="true" />
            {lado.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
