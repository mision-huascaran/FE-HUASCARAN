// CU012 — Módulo de Inicio del Directivo.
//
// Interfaz minimalista y ejecutiva: sin gráficos, sin análisis históricos, sin
// desagregaciones ni nada del futuro Dashboard de Donantes.
//
// DOS tarjetas, no tres. CU012 enumera tres e incluye "Salud del sistema",
// pero esa depende de la sincronización offline que el backend todavía no
// tiene, así que lo único que podía mostrar era "Sin datos disponibles". Una
// tarjeta que nunca ha enseñado un dato no informa: ocupa sitio y hace dudar
// de las dos que sí valen. Se retira hasta que haya qué poner en ella.
//
// El Directivo no tiene "Iniciar actividad": esos botones son del Docente.
import { useQuery } from '@tanstack/react-query'
import { School, Users } from 'lucide-react'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import AvisoDatosLocales from './AvisoDatosLocales'
import { obtenerInicioDirectivo } from '../../api/resources/inicio'
import useConexion from '../../hooks/useConexion'
import useResumenLocal from './useResumenLocal'

export default function InicioDirectivo() {
  const enLinea = useConexion()

  const consulta = useQuery({
    queryKey: ['inicio', 'directivo'],
    /**
     * Una sola llamada: `GET /inicio/directivo`. Antes esto se componía con dos
     * peticiones y un conteo en el cliente, que con la conectividad de los
     * colegios era justo lo que no convenía.
     *
     */
    queryFn: async () => {
      const datos = await obtenerInicioDirectivo()
      return {
        beneficiarios: datos?.beneficiarios_activos ?? 0,
        colegios: datos?.colegios_operando ?? 0,
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <StatCard icon={Users} label="Total de beneficiarios activos" value={resumen.beneficiarios} />
        <StatCard icon={School} label="Total de colegios operando" value={resumen.colegios} />
      </div>
    </div>
  )
}
