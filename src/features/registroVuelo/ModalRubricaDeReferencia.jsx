// La rúbrica que sustenta la sugerencia (CU031).
//
// El docente tiene que poder ver DE DÓNDE sale la sugerencia antes de seguirla
// o descartarla: una recomendación sin su fundamento es una orden sin motivo, y
// aquí la decisión final es suya.
//
// No pide nada al servidor: la rúbrica de referencia viene dentro de
// `sugerencia.rubrica` en la misma respuesta. Volver a pedirla podría además
// traer OTRA —la última completa pudo cambiar entre medias— y entonces el
// panel no explicaría la sugerencia que hay en pantalla.
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { comoNota } from '../../api/resources/rubricaMensual'

const MESES_CORTOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/** "2026-06" → "junio de 2026". */
function comoMes(texto) {
  const [anio, mes] = String(texto ?? '').split('-')
  const nombre = MESES_CORTOS[Number(mes) - 1]
  return nombre ? `${nombre} de ${anio}` : (texto ?? '—')
}

export default function ModalRubricaDeReferencia({ contexto, onCerrar }) {
  const sugerencia = contexto?.periodo?.sugerencia ?? null
  const rubrica = sugerencia?.rubrica ?? null

  return (
    <Modal
      open={Boolean(contexto)}
      onClose={onCerrar}
      title="Rúbrica de referencia"
      subtitle={contexto ? [contexto.alumno?.nombre, `PA${contexto.periodo?.numero}`].filter(Boolean).join(' · ') : ''}
      size="max-w-lg"
      footer={
        <Button variant="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
      }
    >
      {rubrica ? (
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Mes evaluado</dt>
            <dd className="font-medium text-ink-900">{comoMes(rubrica.mes)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Fluidez</dt>
            <dd className="font-medium text-ink-900">{rubrica.fluidez ?? 'Sin evaluar'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Comprensión</dt>
            <dd className="font-medium text-ink-900">{rubrica.comprension ?? 'Sin evaluar'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3">
            <dt className="text-ink-500">Resultado</dt>
            <dd className="font-semibold text-ink-900">{comoNota(rubrica.resultado_decimas) ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">Sugerencia</dt>
            <dd className="font-medium text-ink-900">
              {sugerencia.texto}
              {sugerencia.nivel ? ` · ${sugerencia.nivel.letra}` : ''}
            </dd>
          </div>
          {/*
            Las excepciones de los extremos: por debajo de "aa" y por encima de
            "Z" no hay nivel al que ir, así que la sugerencia se queda donde
            está. Decirlo evita que parezca que el motor no hizo nada.
          */}
          {sugerencia.excepcion && (
            <p className="rounded-lg bg-surface-100 px-3 py-2 text-ink-700">
              El alumno está en el extremo de la escala ({sugerencia.excepcion}): no hay un nivel al que moverlo, así
              que se mantiene.
            </p>
          )}
        </dl>
      ) : (
        <p className="text-sm text-ink-500">
          Todavía no hay una rúbrica completa de este alumno en el periodo, así que no se puede calcular una
          sugerencia.
        </p>
      )}
    </Modal>
  )
}
