// Cubre: RF-002, RN-019
import TablaAlumnos from './TablaAlumnos'

/**
 * Módulo Alumnos (CU008, CU009).
 *
 * Único sitio donde se consultan y gestionan los estudiantes: antes convivía
 * con una pantalla «Estudiantes» separada que leía otra fuente de datos, así
 * que un alumno recién creado no aparecía en ella.
 */
export default function AlumnosPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Alumnos</h1>
      </header>

      <TablaAlumnos />
    </div>
  )
}
