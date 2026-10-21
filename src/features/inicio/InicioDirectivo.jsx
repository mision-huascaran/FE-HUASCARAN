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
     * `salud_sistema` llega hoy en `null` porque depende de la sincronización
     * offline, que el backend todavía no reporta. CU012 prohíbe inventar un
     * porcentaje: se muestra "Sin datos disponibles" y la tarjeta se queda,
     * porque la fórmula ya está definida y el día que el servidor la calcule
     * no hay que volver a montarla.
     */
    queryFn: async () => {
      const datos = await obtenerInicioDirectivo()
      return {
        beneficiarios: datos?.beneficiarios_activos ?? 0,
        colegios: datos?.colegios_operando ?? 0,
        salud: datos?.salud_sistema ?? null,
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
        {/* Sin conexión y sin copia local NO es lo mismo que con conexión y
            el servidor caído, y CU012 da un texto distinto para cada uno.
            Antes los dos decían "sin conexión", que delante de un Directivo
            con internet es sencillamente falso. */}
        <AvisoDatosLocales rol="directivo" sinDatos enLinea={enLinea} />
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
          /**
           * CU012 y §1.5 del contrato: un indicador en `null` se pinta
           * exactamente como "Sin datos disponibles".
           *
           * Y el porcentaje va REDONDEADO al entero más cercano, que el caso
           * de uso lo ejemplifica tal cual: "98 %, no 97.6 %". Redondear aquí
           * es una red, no una regla de negocio duplicada: si el servidor
           * manda el decimal, la tarjeta no lo enseña.
           */
          value={resumen.salud === null ? 'Sin datos disponibles' : `${Math.round(resumen.salud)}%`}
          hint={resumen.salud === null ? undefined : 'Sincronización global'}
        />
      </div>
    </div>
  )
}
