// T18 / CU010 — Botón Inicio/Cierre de actividades y aviso de conexión.
//
// Es el ÚNICO botón de actividad de la aplicación. Antes había dos —uno aquí y
// otro dentro del Módulo de Inicio—, con implementaciones distintas: el de la
// barra encolaba pero no precargaba, así que iniciar desde un sitio o desde el
// otro no dejaba al docente en el mismo estado. Ahora los dos usan `useActividad`.
//
// Vive en la barra superior para que esté a mano desde cualquier módulo, no
// solo desde Inicio.
import { useState } from 'react'
import { PlayCircle, StopCircle, WifiOff } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import useActividad from '../../features/inicio/useActividad'
import useConexion from '../../hooks/useConexion'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import { ROLES } from '../../auth/roles'

/**
 * Los textos de CU010 para `motivo_no_puede_iniciar`, literales.
 *
 * `actividad_activa` no está: en ese caso el botón que se ve es "Finalizar
 * actividad", así que no hay nada que explicar.
 */
const MOTIVO = {
  sin_asignaciones:
    'No puedes iniciar una actividad porque no tienes asignaciones activas, ya sea para el periodo académico actual o de receso.',
  fuera_de_periodo: 'No puedes iniciar una actividad fuera del calendario operativo.',
}

export default function BarraActividades() {
  // CU010: "la interfaz deshabilita temporalmente el botón para evitar
  // múltiples clics mientras el sistema procesa los cambios". Finalizar
  // sincroniza la cola y llama al servidor: no es instantáneo, y un segundo
  // clic mandaba un cierre por una actividad que ya no existe.
  const [procesando, setProcesando] = useState(false)
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const pendientes = useSyncStore((s) => s.pendientes)
  const enLinea = useConexion()
  const { sesion, iniciar, finalizar, sinAsignaciones, motivoNoPuedeIniciar } = useActividad()

  // Solo el Docente trabaja en el aula: el Supervisor y el Directivo no abren
  // actividades, y así lo dicen CU011 y CU012.
  const esDocente = idRol === ROLES.DOCENTE

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {!enLinea && (
        <Badge tone="warning" icon={WifiOff} className="whitespace-nowrap">
          Sin conexión
          {pendientes > 0 && ` · ${pendientes} pendiente${pendientes === 1 ? '' : 's'}`}
        </Badge>
      )}

      {/* En COLOR, y no en el gris de un botón secundario: es el control que
          habilita todo lo que el docente viene a hacer, y se perdía entre el
          selector de periodo y el indicador de sincronización. Verde para
          abrir, rojo para cerrar, con un anillo que lo separa de la barra. */}
      {esDocente &&
        (sesion ? (
          <Button
            variant="danger"
            iconLeft={StopCircle}
            className="shadow-sm ring-2 ring-danger-600/20"
            loading={procesando}
            disabled={procesando}
            onClick={async () => {
              setProcesando(true)
              try {
                await finalizar()
              } finally {
                setProcesando(false)
              }
            }}
          >
            Finalizar actividad
          </Button>
        ) : (
          <Button
            variant="success"
            iconLeft={PlayCircle}
            className="shadow-sm ring-2 ring-success-600/20"
            disabled={sinAsignaciones}
            // CU010: deshabilitado, NUNCA oculto, y con el motivo a la vista.
            title={MOTIVO[motivoNoPuedeIniciar]}
            onClick={iniciar}
          >
            Iniciar actividad
          </Button>
        ))}
    </div>
  )
}
