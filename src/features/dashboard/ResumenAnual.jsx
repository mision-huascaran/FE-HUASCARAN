// El "resumen anual de Primaria" del Directivo (CU035, paso 5).
//
// NO TIENE ENDPOINT PROPIO, y conviene que quede dicho aquí: el contrato lo
// aclara expresamente ("Resumen anual de CU035 = el año seleccionado de
// /dashboard/evolucion-anual + el resumen de /dashboard/libros. No hay otro
// endpoint"). Así que esto no calcula nada nuevo: toma el año seleccionado de un
// bloque y el resumen del otro.
//
// Es ANUAL: "Estos indicadores respetan el año escolar y los colegios
// seleccionados, sin limitarse al periodo académico". Y si el año está en
// curso, se identifican como acumulados hasta la fecha de consulta —por eso la
// tarjeta lo dice en vez de presentarlo como un cierre—.
import { useQuery } from '@tanstack/react-query'
import { BookOpen, School, Users } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import StatCard from '../../components/ui/StatCard'
import Card from '../../components/ui/Card'
import Skeleton from '../../components/ui/Skeleton'
import { obtenerEvolucionAnual, obtenerLibros } from '../../api/resources/dashboard'
import { TOTAL_PARCIAL, celda, formatearCantidad, formatearIndice } from './estados'

export default function ResumenAnual({ filtros, contexto, anio }) {
  const cobertura = useQuery({
    queryKey: ['dashboard', 'evolucion-anual', filtros],
    queryFn: () => obtenerEvolucionAnual(filtros),
    enabled: Boolean(filtros),
  })

  const libros = useQuery({
    queryKey: ['dashboard', 'libros', filtros],
    queryFn: () => obtenerLibros(filtros),
    enabled: Boolean(filtros),
  })

  const delAnio =
    cobertura.data?.anios?.find((a) => String(a.id_anio_escolar) === String(filtros?.idAnioEscolar)) ??
    cobertura.data?.anios?.at(-1) ??
    null
  const resumen = libros.data?.resumen
  const parcial = Boolean(delAnio?.parcial)
  const cargando = cobertura.isLoading || libros.isLoading

  return (
    <Card
      title={`Resumen anual de Primaria${anio ? ` · ${anio}` : ''}`}
      subtitle={contexto.filter(Boolean).join(' · ') || undefined}
      actions={parcial && <Badge tone="warning">Acumulado hasta la fecha de consulta</Badge>}
    >
      {cargando ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Alumnos atendidos"
            value={celda(delAnio, 'alumnos_atendidos', formatearCantidad)}
            hint={parcial ? 'Parcial' : undefined}
          />
          <StatCard
            icon={School}
            label="Colegios atendidos"
            value={celda(delAnio, 'colegios_atendidos', formatearCantidad)}
          />
          <StatCard
            icon={BookOpen}
            label={resumen?.provisional ? TOTAL_PARCIAL : 'Libros leídos'}
            value={celda(resumen, 'total', formatearCantidad)}
          />
          <StatCard
            label="Promedio de libros por alumno"
            value={celda(resumen, 'promedio', formatearIndice)}
            hint={resumen?.provisional ? 'Provisional' : undefined}
          />
        </div>
      )}
    </Card>
  )
}
