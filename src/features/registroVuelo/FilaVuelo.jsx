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
import { AlertTriangle, BookOpen, Info, MessageSquare, MessageSquareText } from 'lucide-react'
import Select from '../../components/ui/Select'
import Tooltip from '../../components/ui/Tooltip'
import { ACCION_SUGERIDA } from '../../api/resources/registroVueloAnual'
import { CELDA_ALUMNO } from '../../lib/tablaAlumnos'

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

  /**
   * TANDA N — EL ALUMNO NO ESTABA EN EL GRUPO EN ESTE PA.
   *
   * Se decide por el campo `pertenece`, NUNCA comparando el texto del aviso:
   * un mensaje se reescribe cualquier día y el que compara textos se entera
   * cuando el docente ya perdió el trabajo.
   *
   * Es por alumno Y periodo, y se suma a `soloLectura` en vez de sustituirlo:
   * `escritura` decide si el PA se puede escribir para TODO el grupo, y esto
   * decide si esta fila concreta entra en ese PA. Las dos tienen que valer.
   *
   * Por qué deshabilitar y no dejar intentarlo: el servidor rechaza ese
   * guardado con `alumno_fuera_del_grupo`, y ese rechazo no se evapora —queda
   * como operación rechazada y deja al Docente en "Error" en Seguimiento
   * (CU020) hasta que lo descarte—. El docente no hizo nada mal: la pantalla
   * no debería haberle dejado pulsar.
   */
  const fueraDelGrupo = periodo.pertenece === false
  const bloqueada = soloLectura || fueraDelGrupo

  const opciones = niveles.map((n) => ({ value: n.id_nivel_razkids, label: n.letra }))

  const cambiar = (campo, valorPrevio) => (e) => {
    const valor = aId(e.target.value)
    if (valor === (valorPrevio ?? null)) return
    onGuardar(alumno, periodo, { [campo]: valor })
  }

  return (
    <tr className="border-t border-line">
      <td className={`px-3 py-2 ${CELDA_ALUMNO}`}>
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
          EL AVISO DEL SERVIDOR, TAL COMO LLEGA (Tanda N).

          Cubre los dos casos con el mismo hueco: la entrada que cambió
          después de decidir —alguien corrigió el PA anterior, y no se
          recalcula la decisión del docente porque sería decidir por él— y el
          alumno que no pertenecía al grupo en este PA.

          No se arma texto aquí: el servidor manda UNO solo, ya elegido, y si
          hay dos motivos a la vez decide él cuál pesa más. El respaldo se
          queda únicamente para `aviso_entrada_cambio`, que es anterior a este
          contrato y podría llegar sin texto.
        */}
        {(periodo.aviso || periodo.aviso_entrada_cambio) && (
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
      <td className="px-3 py-2 text-center">
        {periodo.entrada?.nivel ? (
          <span className="inline-flex items-center gap-1">
            <span className="font-semibold text-ink-900">{periodo.entrada.nivel.letra}</span>
            {/*
              DE DÓNDE SALE ESA LETRA, SIN DEPENDER DEL CURSOR (CU031).

              El texto estaba solo en un `title`, que en un teléfono no existe
              —no hay hover— y con teclado tampoco. Y es justo el dato que
              responde la pregunta que se hace el Docente al ver una letra que
              él no puso: "¿de dónde salió?". El `Tooltip` de la casa lo abre
              con el cursor, con el foco Y con el toque.

              Cuando NO hay nivel, el mismo texto ya se lee a secas en la
              celda ("Pendiente del periodo anterior"), así que ahí no hace
              falta el botón: sería repetir lo que ya está escrito.
            */}
            {periodo.entrada.texto && (
              <Tooltip content={periodo.entrada.texto}>
                <button
                  type="button"
                  aria-label={`De dónde viene la entrada de ${alumno.nombre}`}
                  className="inline-flex rounded-full text-ink-400 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            )}
          </span>
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

      {/* Ancho mínimo: con "Pendiente del periodo anterior" en Entrada, la
          columna se angostaba y el texto quedaba en "Sin decid" (U22). */}
      <td className="min-w-[9.5rem] px-3 py-2">
        <Select
          aria-label={`Nivel colocado de ${alumno.nombre}`}
          value={periodo.nivel_colocado?.id ?? ''}
          placeholder="Sin decidir"
          disabled={bloqueada}
          onChange={cambiar('id_nivel_colocado', periodo.nivel_colocado?.id)}
          options={opciones}
        />
      </td>

      {/* Lo calcula el servidor a partir del grado y del nivel colocado. */}
      <td className="px-3 py-2 text-center text-sm text-ink-700">{periodo.nivel_programa ?? '—'}</td>

      {/* Ancho mínimo: con "Pendiente del periodo anterior" en Entrada, la
          columna se angostaba y el texto quedaba en "Sin decid" (U22). */}
      <td className="min-w-[9.5rem] px-3 py-2">
        <Select
          aria-label={`Proyección de ${alumno.nombre}`}
          value={periodo.proyeccion?.id ?? ''}
          placeholder="Sin proyectar"
          disabled={bloqueada}
          onChange={cambiar('id_nivel_proyeccion', periodo.proyeccion?.id)}
          options={opciones}
        />
      </td>

      <td className="px-3 py-2 text-center">
        <button
          type="button"
          // Una nota existente se puede LEER aunque no se pueda escribir.
          disabled={bloqueada && !conNota}
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
      <td
        className="px-3 py-2 text-center text-sm font-semibold text-ink-900"
        title="Periodos del año con nivel colocado: 25 % por cada PA."
      >
        {alumno.avance_anual ?? 0}%
      </td>
    </tr>
  )
}
