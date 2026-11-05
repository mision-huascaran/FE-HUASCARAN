// El tipo de cierre de una actividad, en una palabra.
//
// POR QUÉ NO EL TEXTO COMPLETO. "Manual por finalización de actividad" ocupa
// tres líneas y aparece en casi todas las filas: la columna se convierte en
// una mancha de texto idéntico donde ya no se distingue la fila rara, que es
// justo lo que se viene a buscar en una bitácora. Lo que separa a las tres es
// la PRIMERA palabra —quién cerró: el docente, la salida o el reloj—; el resto
// explica esa palabra y no hace falta leerlo ocho veces seguidas.
//
// El motivo entero no se pierde: está en el tooltip —cursor, foco y toque— y
// completo en "Ver detalle".
import Tooltip from '../ui/Tooltip'
import { SIN_FIN, etiquetaCortaTipoCierre, etiquetaTipoCierre } from '../../api/resources/actividades'

export default function CeldaCierre({ tipo }) {
  const corta = etiquetaCortaTipoCierre(tipo)
  const completa = etiquetaTipoCierre(tipo)

  // Una actividad en curso no tiene cierre: el guion no explica nada y no
  // merece un control que invite a pulsarlo.
  if (!tipo || corta === SIN_FIN) return <span className="text-ink-400">{SIN_FIN}</span>

  // Si no hay nada más que contar, tampoco se ofrece el tooltip.
  if (corta === completa) return <span>{corta}</span>

  return (
    <Tooltip content={completa}>
      <button
        type="button"
        // Subrayado punteado: el gesto universal de "esto se puede consultar",
        // sin el peso visual de un botón ni el color de un enlace, que
        // prometería navegar a otro sitio.
        className="cursor-help rounded underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {corta}
      </button>
    </Tooltip>
  )
}
