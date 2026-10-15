// El Segmented Control de una fila de asistencia (CU022, pasos 6, 8 y 9).
//
// CUATRO estados, no tres. "Sin marcar" es un estado de pleno derecho: una
// clase nueva nace con TODOS los controles apagados, y es lo que distingue
// "todavía no lo he mirado" de "consta ausente". De ahí que el valor sea
// `'presente' | 'tardanza' | 'ausente' | null`.
//
// OJO: `null` solo existe hacia dentro. Al servidor no se le puede mandar, así
// que una marca puesta se puede CAMBIAR pero no quitar. Por eso un clic sobre
// el lado ya elegido no hace nada: no es un interruptor.
//
// Los colores los fija el caso de uso al detalle: fondo pastel con el icono en
// el tono oscuro del mismo color, y los lados no elegidos en gris claro.
import { Check, Clock, X } from 'lucide-react'

const APAGADO = 'bg-surface-100 text-ink-400 hover:bg-line hover:text-ink-700'

const LADOS = [
  {
    valor: 'presente',
    etiqueta: 'Presente',
    icono: Check,
    encendido: 'bg-success-100 text-success-600',
    redondeo: 'rounded-l-lg',
  },
  {
    valor: 'tardanza',
    etiqueta: 'Tardanza',
    icono: Clock,
    encendido: 'bg-warning-100 text-warning-600',
    redondeo: '',
  },
  {
    valor: 'ausente',
    etiqueta: 'Ausente',
    icono: X,
    encendido: 'bg-danger-100 text-danger-600',
    redondeo: 'rounded-r-lg',
  },
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
            key={lado.valor}
            type="button"
            // `aria-pressed` es lo que permite a un lector de pantalla —y a las
            // pruebas— saber qué lado está encendido sin mirar los colores.
            aria-pressed={elegido}
            aria-label={`${lado.etiqueta}: ${nombre}`}
            title={lado.etiqueta}
            disabled={deshabilitado}
            onClick={() => !elegido && onElegir(lado.valor)}
            className={[
              'flex items-center gap-1.5 border-r border-line px-3 py-1.5 text-sm font-semibold transition-colors last:border-r-0',
              lado.redondeo,
              elegido ? lado.encendido : APAGADO,
              deshabilitado ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          >
            <Icono className="h-4 w-4" aria-hidden="true" />
            {/* El texto se esconde en móvil: la fila tiene que caber en una
                pantalla de teléfono, que es donde se usa esto en el aula. */}
            <span className="hidden sm:inline">{lado.etiqueta}</span>
          </button>
        )
      })}
    </div>
  )
}
