// D4 — Sin actividades iniciadas la grilla se ve, pero no se edita.
//
// No es una restricción de permisos: es que cada cambio tiene que quedar atado
// a una sesión de actividades para poder auditarlo después. Sin esa sesión no
// habría a qué ligarlo.
//
// Auditoría de UX #737, U24: el aviso de "Debes iniciar una actividad" trae su
// propio botón —antes había que buscarlo en la esquina superior derecha— y
// los demás motivos llevan un ícono de información, no el de "play", que
// prometía una acción que no estaba ahí.
import { useState } from 'react'
import { Info, PlayCircle } from 'lucide-react'
import Button from '../ui/Button'
import { SIN_ACTIVIDAD } from '../../api/resources/sincronizacion'
import useActividad from '../../features/inicio/useActividad'

function BotonIniciar() {
  const { iniciar, sinAsignaciones, textoNoPuedeIniciar } = useActividad()
  const [iniciando, setIniciando] = useState(false)

  return (
    <Button
      size="sm"
      variant="success"
      iconLeft={PlayCircle}
      className="shrink-0"
      loading={iniciando}
      disabled={sinAsignaciones}
      title={textoNoPuedeIniciar ?? undefined}
      onClick={async () => {
        setIniciando(true)
        try {
          await iniciar()
        } finally {
          setIniciando(false)
        }
      }}
    >
      Iniciar actividad
    </Button>
  )
}

/**
 * @param mensaje texto completo. Por defecto, el mismo que responde el
 *   servidor al rechazar una escritura sin actividad: así el docente lee lo
 *   mismo antes de intentarlo y después de que se lo rechacen.
 *
 *   Lo habitual es pasarle el `detail` o el `escritura.motivo` que llega; el
 *   valor por defecto es solo para cuando la pantalla sabe por sí misma que no
 *   hay actividad y todavía no ha preguntado al servidor.
 */
export default function AvisoActividades({ mensaje = SIN_ACTIVIDAD }) {
  const faltaActividad = mensaje === SIN_ACTIVIDAD
  const Icono = faltaActividad ? PlayCircle : Info

  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-info-600/20 bg-info-100 px-4 py-3 text-sm text-ink-700"
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Icono className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />
        <span>{mensaje}</span>
      </span>
      {faltaActividad && <BotonIniciar />}
    </div>
  )
}
