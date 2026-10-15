// CU015 — Pestaña Resumen del detalle del alumno.
//
// Son TRES tarjetas, ni una más: Nivel colocado, Total de libros leídos en el
// año y Porcentaje de asistencia. El caso de uso las fija así.
//
// EL CONTRATO CAMBIÓ: `nivel_actual` desapareció y ahora es `nivel_colocado`,
// un objeto con la letra Raz-Kids del último Registro de Vuelo del año y su
// `nivel_descriptivo` ("Inicio", "En proceso", "Logrado" o "Avanzado"). Ese
// descriptivo lo calcula el SERVIDOR con la matriz por grado de CU015 —una "J"
// es "Logrado" en 3.º y apenas "Inicio" en 5.º—, así que aquí no se traduce: se
// muestra lo que manda.
//
// Y ya no llegan en `null`: libros y asistencia son 0 cuando no hay datos. Un 0
// se puede pintar; lo que no se podía era inventar un 0 cuando el servidor
// decía "no lo sé".
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck, GraduationCap } from 'lucide-react'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import { obtenerResumenAlumno } from '../../api/resources/alumnos'

/** Sin evaluar: CU015 pide un guion y "Sin evaluar" debajo, no un 0. */
const SIN_EVALUAR = { valor: '-', descripcion: 'Sin evaluar' }

export default function ResumenFicha({ ficha, cargando, idAlumno }) {
  const id = idAlumno ?? ficha?.id_alumno ?? ficha?.id ?? null
  const consulta = useQuery({
    queryKey: ['alumno', 'resumen', id],
    queryFn: () => obtenerResumenAlumno(id),
    enabled: Boolean(id),
  })

  if (cargando || consulta.isLoading) return <Skeleton variant="card" />

  const resumen = consulta.data ?? {}
  const nivel = resumen.nivel_colocado ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={GraduationCap}
          label="Nivel colocado"
          value={nivel?.letra ?? SIN_EVALUAR.valor}
          hint={nivel?.nivel_descriptivo ?? SIN_EVALUAR.descripcion}
        />
        <StatCard
          icon={BookOpen}
          label="Libros leídos en el año"
          value={resumen.libros_leidos_anio ?? 0}
        />
        <StatCard
          icon={CalendarCheck}
          label="Asistencia"
          value={`${Math.round(resumen.asistencia_porcentaje ?? 0)}%`}
          // CU022 §3.4: la TARDANZA cuenta como asistencia.
          hint="Presentes y tardanzas sobre las clases dictadas"
        />
      </div>

      <p className="text-xs text-ink-500">
        La evolución, las rúbricas y el historial completo están en las demás pestañas.
      </p>
    </div>
  )
}
