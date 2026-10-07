// Cubre: RF-004, RF-002, RN-001 · Sección "Inicio" de la matriz.
//
// Los tres roles entran aquí tras el login y ven cosas distintas, cada una con
// su caso de uso: el Docente sus asignaciones y los botones de actividad
// (CU010), el Supervisor el resumen operativo con alertas (CU011) y el
// Directivo tres indicadores institucionales y nada más (CU012).
import InicioDocente from './InicioDocente'
import InicioSupervisor from './InicioSupervisor'
import InicioDirectivo from './InicioDirectivo'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

export default function InicioPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))

  if (idRol === ROLES.SUPERVISOR) return <InicioSupervisor />
  if (idRol === ROLES.DIRECTIVO) return <InicioDirectivo />
  return <InicioDocente />
}
