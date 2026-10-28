// Una fila de la rúbrica mensual (CU029).
//
// Dos desplegables —Fluidez y Comprensión—, el resultado calculado y el estado.
//
// EL 0 ES UN VALOR, NO UN VACÍO. "Pre-inicio" vale 0 y "sin evaluar" es `null`:
// confundirlos haría que un alumno sin evaluar apareciera como el peor de la
// clase. Por eso ninguna comparación de aquí usa la veracidad del número, y el
// `<select>` distingue la cadena vacía del "0".
//
// Y LA ESCALA DEPENDE DEL SUBPROGRAMA: Alfabetización admite 0 en Fluidez
// —hay alumnos que todavía no reconocen las letras— y Comprensión Lectora
// empieza en 1. Ofrecer una opción que el servidor va a rechazar sería mandar
// al docente a un error evitable, así que la lista ya viene filtrada.
import Select from '../../components/ui/Select'
import { ESTADO_RUBRICA, comoNota, nivelesDe } from '../../api/resources/rubricaMensual'

const TONO = {
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  neutral: 'bg-surface-100 text-ink-500',
}

/** `''` es "sin evaluar"; `'0'` es Pre-inicio. No se pueden mezclar. */
const aValor = (texto) => (texto === '' ? null : Number(texto))

export default function FilaRubrica({ fila, nombrePrograma, soloLectura, rechazo, onGuardar }) {
  const estado = ESTADO_RUBRICA[fila.estado] ?? ESTADO_RUBRICA.pendiente
  const nota = comoNota(fila.resultado_decimas)

  const cambiar = (dimension) => (e) => {
    const valor = aValor(e.target.value)
    if (valor === (fila[dimension] ?? null)) return
    // Solo viaja la dimensión que cambió: la otra se queda como está, y
    // mandarla en null la borraría sin que nadie lo pidiera.
    onGuardar(fila, { [dimension]: valor })
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2">
        <span className="font-medium text-ink-900">{fila.nombre}</span>
        {fila.inactivo && (
          <span
            title="Hoy está inactivo, pero corresponde evaluarlo en este mes"
            className="ml-2 whitespace-nowrap rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-ink-500"
          >
            Inactivo
          </span>
        )}

        {/*
          EL RECHAZO DEL SERVIDOR VA AQUÍ, en la fila de su alumno.

          Lo pide el contrato de la tanda 0 para `evaluacion_en_otro_grupo`, y
          con razón: en una tabla de cuarenta alumnos, un aviso arriba obliga a
          buscar de quién hablaba. El aviso general sigue estando porque es el
          que lleva la acción de descartar y el que aparece cuando el rechazo
          llega con la pantalla cerrada.
        */}
        {rechazo?.detail && <p className="mt-1 text-xs text-danger-600">{rechazo.detail}</p>}
      </td>

      <td className="px-3 py-2">
        <Select
          aria-label={`Fluidez de ${fila.nombre}`}
          value={fila.fluidez ?? ''}
          placeholder="Sin evaluar"
          disabled={soloLectura}
          onChange={cambiar('fluidez')}
          options={nivelesDe(nombrePrograma, 'fluidez').map((n) => ({ value: n.valor, label: n.nombre }))}
        />
      </td>

      <td className="px-3 py-2">
        <Select
          aria-label={`Comprensión de ${fila.nombre}`}
          value={fila.comprension ?? ''}
          placeholder="Sin evaluar"
          disabled={soloLectura}
          onChange={cambiar('comprension')}
          options={nivelesDe(nombrePrograma, 'comprension').map((n) => ({ value: n.valor, label: n.nombre }))}
        />
      </td>

      {/*
        El resultado lo calcula el SERVIDOR y llega en décimas: 4·F + 6·C, que
        es F×0,40 + C×0,60. Se pinta con un decimal, y en blanco mientras falte
        una dimensión: una nota a medias no es una nota.
      */}
      <td className="px-3 py-2 text-center font-semibold text-ink-900">{nota ?? '—'}</td>

      <td className="px-3 py-2 text-center">
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONO[estado.tono]}`}>
          {estado.texto}
        </span>
      </td>
    </tr>
  )
}
