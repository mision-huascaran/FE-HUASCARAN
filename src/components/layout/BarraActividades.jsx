// T18 / CU010 — Botón Inicio/Cierre de actividades y aviso de conexión.
//
// Es el ÚNICO botón de actividad de la aplicación. Antes había dos —uno aquí y
// otro dentro del Módulo de Inicio—, con implementaciones distintas: el de la
// barra encolaba pero no precargaba, así que iniciar desde un sitio o desde el
// otro no dejaba al docente en el mismo estado. Ahora los dos usan `useActividad`.
//
// Vive en la barra superior para que esté a mano desde cualquier módulo, no
// solo desde Inicio.
import { PlayCircle, StopCircle, WifiOff } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import useActividad from '../../features/inicio/useActividad'
import useConexion from '../../hooks/useConexion'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import { ROLES } from '../../auth/roles'

export default function BarraActividades() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const pendientes = useSyncStore((s) => s.pendientes)
  const enLinea = useConexion()
  const { sesion, iniciar, finalizar, sinAsignaciones } = useActividad()

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
            onClick={finalizar}
          >
            Finalizar actividad
          </Button>
        ) : (
          <Button
            variant="success"
            iconLeft={PlayCircle}
            className="shadow-sm ring-2 ring-success-600/20"
            disabled={sinAsignaciones}
            onClick={iniciar}
          >
            Iniciar actividad
          </Button>
        ))}
    </div>
  )
}
