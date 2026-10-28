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
// Los libros llegan en 0 cuando no hay datos. La asistencia es un OBJETO
// `{porcentaje, asistidas, contabilizadas}` desde T6, y su `porcentaje` sí puede
// ser `null`: "Sin datos de asistencia", que no es lo mismo que un 0 %.
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarCheck, GraduationCap, Info } from 'lucide-react'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import Tooltip from '../../components/ui/Tooltip'
import { obtenerResumenAlumno } from '../../api/resources/alumnos'

/** Sin evaluar: CU015 pide un guion y "Sin evaluar" debajo, no un 0. */
const SIN_EVALUAR = { valor: '-', descripcion: 'Sin evaluar' }

/**
 * Qué entra en el porcentaje, literal de CU015.
 *
 * Es la explicación de por qué el número no cuadra con lo que el Docente
 * recuerda haber dictado: una clase sin lista, o con la lista a medias, todavía
 * no cuenta. Sin esto, el indicador parece simplemente mal calculado.
 */
const QUE_INCLUYE =
  'El porcentaje incluye únicamente clases con listas de asistencia completas. Las clases sin registro o con listas incompletas todavía no participan en el cálculo.'

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
  const asistencia = resumen.asistencia ?? {}

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
          value={asistencia.porcentaje == null ? '-' : `${asistencia.porcentaje}%`}
          // CU022 §3.4: la TARDANZA cuenta como asistencia. Sin clases
          // contabilizadas se omite el detalle numérico: un "0 de 0" no dice
          // nada y se lee como si el alumno no hubiera asistido nunca.
          hint={
            asistencia.porcentaje == null ? (
              'Sin datos de asistencia'
            ) : (
              <span className="inline-flex items-center gap-1">
                {`Presente o con tardanza en ${asistencia.asistidas} de ${asistencia.contabilizadas} clases contabilizadas`}
                <Tooltip content={QUE_INCLUYE}>
                  <button
                    type="button"
                    aria-label="Qué clases incluye el porcentaje"
                    className="inline-flex rounded-full text-ink-400 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
              </span>
            )
          }
        />
      </div>

      <p className="text-xs text-ink-500">
        La evolución, las rúbricas y el historial completo están en las demás pestañas.
      </p>
    </div>
  )
}
