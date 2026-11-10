// Cubre: RF-004, RF-002, RN-001 · Sección "Inicio" de la matriz.
//
// DOS ROLES, no tres: el Docente ve sus asignaciones y los botones de actividad
// (CU010) y el Supervisor el resumen operativo con alertas (CU011).
//
// EL DIRECTIVO YA NO PASA POR AQUÍ. Su Inicio eran tres indicadores
// institucionales que el Dashboard ya da con filtros, así que la sección es
// `[DIRECTIVO]: null` en la matriz y su ruta de aterrizaje es `/dashboard`.
// La guarda de `/inicio` tampoco le deja entrar escribiendo la URL.
import InicioDocente from './InicioDocente'
import useSincronizacionLocal from './useSincronizacionLocal'
import InicioSupervisor from './InicioSupervisor'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

export default function InicioPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))

  // CU003: cada entrada a Inicio con conexión refresca en segundo plano lo que
  // el rol puede usar sin red. No bloquea ni avisa: la pantalla se pinta igual.
  useSincronizacionLocal()

  if (idRol === ROLES.SUPERVISOR) return <InicioSupervisor />
  return <InicioDocente />
}
