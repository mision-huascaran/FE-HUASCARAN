// CU012 — Módulo de Inicio del Directivo.
//
// Interfaz minimalista y ejecutiva: EXACTAMENTE tres tarjetas y nada más. El
// caso de uso lo dice expresamente — sin gráficos, sin análisis históricos, sin
// desagregaciones ni nada del futuro Dashboard de Donantes.
//
// El Directivo no tiene "Iniciar actividad": esos botones son del Docente.
import { useQuery } from '@tanstack/react-query'
import { Activity, School, Users } from 'lucide-react'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import AvisoDatosLocales from './AvisoDatosLocales'
import { listarAlumnosAdmin, listarColegiosAdmin } from '../../api/resources/administracion'
import useConexion from '../../hooks/useConexion'
import useResumenLocal from './useResumenLocal'

export default function InicioDirectivo() {
  const enLinea = useConexion()

  const consulta = useQuery({
    queryKey: ['inicio', 'directivo'],
    queryFn: async () => {
      const [alumnos, colegios] = await Promise.all([
        listarAlumnosAdmin({ estado: 'activo', limit: 1 }),
        listarColegiosAdmin({ estado: 'activo' }),
      ])
      return {
        beneficiarios: alumnos.total ?? 0,
        colegios: colegios.length,
        // "Salud del Sistema" sale de datos reales de sincronización. Si no se
        // puede calcular, el caso de uso prohíbe mostrar un porcentaje
        // inventado: se informa que no está disponible.
        salud: null,
      }
    },
    enabled: enLinea,
  })

  const { resumen, desactualizado } = useResumenLocal('directivo', consulta.data, enLinea)

  if (!resumen) {
    return consulta.isLoading ? (
      <Skeleton className="h-40 w-full" />
    ) : (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Inicio</h1>
        <AvisoDatosLocales sinDatos />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Inicio</h1>
      </header>

      {desactualizado && <AvisoDatosLocales />}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard icon={Users} label="Total de beneficiarios activos" value={resumen.beneficiarios} />
        <StatCard icon={School} label="Total de colegios operando" value={resumen.colegios} />
        <StatCard
          icon={Activity}
          label="Salud del sistema"
          value={resumen.salud === null ? 'No disponible' : `${resumen.salud}%`}
          hint={resumen.salud === null ? 'Sin información de sincronización' : 'Sincronización global'}
        />
      </div>
    </div>
  )
}
