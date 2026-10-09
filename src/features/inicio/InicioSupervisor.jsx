// CU011 — Módulo de Inicio del Supervisor.
//
// Resumen operativo: colegios registrados, docentes activos, docentes con
// actividad en curso, registros pendientes y las Alertas de Inactividad.
//
// El Supervisor NO tiene "Iniciar actividad": esos botones son del Docente.
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ClipboardList, School, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import AlertasInactividad from './AlertasInactividad'
import AvisoDatosLocales from './AvisoDatosLocales'
import useResumenLocal from './useResumenLocal'
import { obtenerResumenSupervisor } from '../../api/resources/inicio'
import useConexion from '../../hooks/useConexion'

const ACCESOS = [
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/alumnos', label: 'Alumnos' },
  { to: '/colegios', label: 'Colegios' },
  // El Supervisor sigue a sus docentes en Seguimiento (CU020): Sesiones es
  // solo del Docente y lo mandaba a /403.
  { to: '/seguimiento', label: 'Seguimiento de los docentes' },
  { to: '/dashboard', label: 'Dashboard' },
]

/** Lo que se pinta cuando el servidor no puede calcular un indicador. */
const SIN_DATOS = 'Sin datos disponibles'

export default function InicioSupervisor() {
  const enLinea = useConexion()
  const consulta = useQuery({
    queryKey: ['inicio', 'supervisor'],
    /**
     * `GET /inicio/supervisor`. `pendientes` e `incompletos` llegan hoy en
     * `null` porque dependen de las grillas, que el backend todavía no tiene.
     * CU012 y §1.5 del contrato prohíben pintar un 0 en ese caso: un cero dice
     * "no hay nada que hacer", y lo cierto es que no se sabe.
     */
    queryFn: async () => {
      const d = await obtenerResumenSupervisor()
      return {
        colegios: d?.colegios ?? d?.colegios_registrados ?? 0,
        docentesActivos: d?.docentes_activos ?? d?.docentesActivos ?? 0,
        // El backend lo llama `docentes_con_actividad_activa`. Se leía solo
        // `docentes_con_actividad`, que no existe, y el indicador salía
        // siempre en 0 (D15).
        docentesConActividad:
          d?.docentes_con_actividad_activa ?? d?.docentes_con_actividad ?? d?.docentesConActividad ?? 0,
        registrosPendientes: d?.pendientes ?? null,
        registrosIncompletos: d?.incompletos ?? null,
        alertas: d?.alertas ?? [],
      }
    },
    enabled: enLinea,
  })

  const { resumen, desactualizado } = useResumenLocal('supervisor', consulta.data, enLinea)

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={School} label="Colegios registrados" value={resumen.colegios} />
        <StatCard icon={Users} label="Docentes activos" value={resumen.docentesActivos} />
        <StatCard icon={ClipboardList} label="Con actividad en curso" value={resumen.docentesConActividad} />
        <StatCard icon={AlertTriangle} label="Registros pendientes" value={resumen.registrosPendientes ?? SIN_DATOS} />
        <StatCard icon={AlertTriangle} label="Registros incompletos" value={resumen.registrosIncompletos ?? SIN_DATOS} />
      </div>

      <AlertasInactividad alertas={resumen.alertas} desactualizadas={desactualizado} />

      <Card title="Accesos">
        <div className="flex flex-wrap gap-3">
          {ACCESOS.map((acceso) => (
            <Link
              key={acceso.to}
              to={acceso.to}
              className="rounded-lg bg-brand-100 px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {acceso.label}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
