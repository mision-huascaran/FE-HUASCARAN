// Una fila del Registro de Vuelo: un alumno en UN periodo académico (CU031).
//
// LA COLUMNA IZQUIERDA ES DEL SERVIDOR Y LA DERECHA DEL DOCENTE, y la fila lo
// enseña en ese orden a propósito:
//
//   Entrada → Sugerencia → | Nivel colocado | Proyección | Obs.
//
// La entrada y la sugerencia se MUESTRAN, no se editan: las calcula el
// servidor y mandarlas desde aquí sería un 422 del lote entero. La sugerencia
// es una sugerencia: colocar la misma letra que la entrada también es una
// decisión, y se guarda como tal.
import { AlertTriangle, BookOpen, MessageSquare, MessageSquareText } from 'lucide-react'
import Select from '../../components/ui/Select'
import { ACCION_SUGERIDA } from '../../api/resources/registroVueloAnual'

const TONO = {
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  neutral: 'bg-surface-100 text-ink-500',
}

/** `''` es "sin elegir". Un nivel nunca es 0, así que aquí no hay trampa. */
const aId = (texto) => (texto === '' ? null : Number(texto))

export default function FilaVuelo({ alumno, periodo, niveles, soloLectura, onGuardar, onObservar, onVerRubrica }) {
  const sugerencia = periodo.sugerencia ?? {}
  const accion = ACCION_SUGERIDA[sugerencia.accion] ?? null
  const conNota = Boolean(periodo.observacion)
  const Globo = conNota ? MessageSquareText : MessageSquare

  const opciones = niveles.map((n) => ({ value: n.id_nivel_razkids, label: n.letra }))

  const cambiar = (campo, valorPrevio) => (e) => {
    const valor = aId(e.target.value)
    if (valor === (valorPrevio ?? null)) return
    onGuardar(alumno, periodo, { [campo]: valor })
  }

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2">
        <span className="font-medium text-ink-900">{alumno.nombre}</span>
        {alumno.inactivo && (
          <span
            title="Hoy está inactivo, pero perteneció al grupo este año"
            className="ml-2 whitespace-nowrap rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-ink-500"
          >
            Inactivo
          </span>
        )}
        {/*
          La entrada cambió DESPUÉS de decidir: alguien corrigió el periodo
          anterior. No se recalcula la decisión del docente —eso sería
          decidir por él—, se avisa con el texto del servidor.
        */}
        {periodo.aviso_entrada_cambio && (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {periodo.aviso ?? 'La entrada de este periodo cambió después de registrar el nivel colocado.'}
          </span>
        )}
      </td>

      {/*
        La ENTRADA. Sin nivel se dice "Pendiente del periodo anterior" y NO la
        letra del grado: eso solo vale para PA1, y ponerla aquí daría por buena
        una entrada inventada que se arrastraría a los periodos siguientes.
      */}
      <td className="px-3 py-2 text-center" title={periodo.entrada?.texto ?? undefined}>
        {periodo.entrada?.nivel ? (
          <span className="font-semibold text-ink-900">{periodo.entrada.nivel.letra}</span>
        ) : (
          <span className="text-xs text-ink-500">{periodo.entrada?.texto ?? 'Pendiente'}</span>
        )}

        {/*
          TANDA A3 — La entrada viene de una decisión tomada en OTRO colegio,
          antes del traslado. Se destaca porque explica una letra que, de otro
          modo, parecería salida de la nada: el alumno no tiene ningún registro
          anterior en este colegio.

          Y NO SE ENLAZA a la decisión de origen: ver la letra como antecedente
          no da permiso sobre las evaluaciones del colegio de procedencia.
        */}
        {periodo.entrada?.de_otro_colegio && (
          <span className="mt-1 block whitespace-nowrap text-xs text-ink-500">Registrado antes del traslado</span>
        )}
      </td>

      <td className="px-3 py-2 text-center">
        {accion ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONO[accion.tono]}`}>
              {sugerencia.texto ?? accion.texto}
            </span>
            {sugerencia.nivel && <span className="text-sm font-semibold text-ink-700">{sugerencia.nivel.letra}</span>}
            {/* La rúbrica de referencia: el docente tiene que poder ver de
                dónde sale la sugerencia antes de seguirla o descartarla. */}
            {sugerencia.rubrica && (
              <button
                type="button"
                onClick={() => onVerRubrica({ alumno, periodo })}
                aria-label={`Ver la rúbrica que sustenta la sugerencia de ${alumno.nombre}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-400 transition-colors hover:border-brand-500/60 hover:text-ink-700"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </span>
        ) : (
          // Sin rúbrica completa o sin entrada no hay sugerencia. Inventar una
          // sería peor: el docente la leería como una recomendación fundada.
          <span className="text-xs text-ink-500">{sugerencia.texto ?? 'Pendiente de evaluar'}</span>
        )}
      </td>

      <td className="px-3 py-2">
        <Select
          aria-label={`Nivel colocado de ${alumno.nombre}`}
          value={periodo.nivel_colocado?.id ?? ''}
          placeholder="Sin decidir"
          disabled={soloLectura}
          onChange={cambiar('id_nivel_colocado', periodo.nivel_colocado?.id)}
          options={opciones}
        />
      </td>

      {/* Lo calcula el servidor a partir del grado y del nivel colocado. */}
      <td className="px-3 py-2 text-center text-sm text-ink-700">{periodo.nivel_programa ?? '—'}</td>

      <td className="px-3 py-2">
        <Select
          aria-label={`Proyección de ${alumno.nombre}`}
          value={periodo.proyeccion?.id ?? ''}
          placeholder="Sin proyectar"
          disabled={soloLectura}
          onChange={cambiar('id_nivel_proyeccion', periodo.proyeccion?.id)}
          options={opciones}
        />
      </td>

      <td className="px-3 py-2 text-center">
        <button
          type="button"
          // Una nota existente se puede LEER aunque no se pueda escribir.
          disabled={soloLectura && !conNota}
          onClick={() => onObservar({ alumno, periodo })}
          aria-label={`${conNota ? 'Ver' : 'Añadir'} observación de ${alumno.nombre}`}
          title={conNota ? periodo.observacion : 'Sin observación'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-400 transition-colors hover:border-brand-500/60 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Globo className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>

      {/* 25 puntos por cada PA con nivel colocado: el avance es del AÑO, no de
          este periodo, así que la misma cifra se repite en los cuatro. */}
      <td className="px-3 py-2 text-center text-sm font-semibold text-ink-900">{alumno.avance_anual ?? 0}%</td>
    </tr>
  )
}
