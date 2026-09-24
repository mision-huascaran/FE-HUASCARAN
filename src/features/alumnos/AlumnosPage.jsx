// Cubre: RF-002, RN-019
import TablaAlumnos from './TablaAlumnos'
import { ROLES } from '../../auth/roles'
import useSessionStore from '../../store/sessionStore'

/**
 * Módulo Alumnos (CU008, CU009).
 *
 * El Docente gestiona a los estudiantes de sus colegios y grados asignados:
 * los crea, los corrige y los da de baja lógica. El Supervisor entra a la misma
 * pantalla, pero solo a consultar; el servidor le responde 403 si intenta
 * escribir, así que la tabla ni siquiera le ofrece las acciones.
 */
export default function AlumnosPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const esDocente = idRol === ROLES.DOCENTE

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Alumnos</h1>
        <p className="mt-1 text-sm text-ink-500">
          {esDocente
            ? 'Estudiantes de los colegios y grados que tiene asignados este periodo.'
            : 'Consulta de estudiantes. La gestión corresponde al Docente de cada colegio.'}
        </p>
      </header>

      <TablaAlumnos />
    </div>
  )
}
