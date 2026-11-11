// CU011 — Módulo de Inicio del Supervisor.
//
// Resumen operativo: colegios registrados, docentes activos, docentes con
// actividad en curso, registros vencidos e incompletos, y las Alertas
// Operativas.
//
// El Supervisor NO tiene "Iniciar actividad": esos botones son del Docente.
import { useQuery } from '@tanstack/react-query'
import { Activity, AlertTriangle, ArrowRight, BarChart3, CalendarClock, GraduationCap, Lock, Play, School, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import IconoTinte from '../../components/ui/IconoTinte'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import AlertasInactividad from './AlertasInactividad'
import DesglosePorModulo from './DesglosePorModulo'
import ContextoInicio from './ContextoInicio'
import AvisoDatosLocales from './AvisoDatosLocales'
import useResumenLocal from './useResumenLocal'
import { obtenerResumenSupervisor } from '../../api/resources/inicio'
import useConexion from '../../hooks/useConexion'

const ACCESOS = [
  { to: '/usuarios', label: 'Usuarios', icon: Users },
  { to: '/alumnos', label: 'Alumnos', icon: GraduationCap },
  { to: '/colegios', label: 'Colegios', icon: School },
  // El Supervisor sigue a sus docentes en Seguimiento (CU020): Sesiones es
  // solo del Docente y lo mandaba a /403.
  { to: '/seguimiento', label: 'Seguimiento de los docentes', icon: Activity },
]

/** Lo que se pinta cuando el servidor no puede calcular un indicador. */
const SIN_DATOS = 'Sin datos disponibles'

export default function InicioSupervisor() {
  const enLinea = useConexion()
  const consulta = useQuery({
    queryKey: ['inicio', 'supervisor'],
    /**
     * `GET /inicio/supervisor`.
     *
     * LOS NOMBRES SON LOS DEL CONTRATO. Se leían `pendientes` e `incompletos`,
     * que no existen: el backend manda `registros_vencidos` y
     * `registros_incompletos`. Las dos tarjetas decían "Sin datos disponibles"
     * aunque el servidor los estuviera calculando.
     *
     * Y ahora son ENTEROS, no `null`: el contrato los declara obligatorios, así
     * que un 0 significa de verdad "no hay ninguno" y se puede pintar.
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
        registrosVencidos: d?.registros_vencidos ?? null,
        registrosIncompletos: d?.registros_incompletos ?? null,
        // El desglose de la tanda 10. Se guarda tal cual, con `null` cuando el
        // servidor no lo manda: un servidor sin actualizar no lo trae, y
        // rellenarlo con ceros seria afirmar que los cuatro modulos estan al
        // dia sin saberlo.
        vencidosPorModulo: d?.vencidos_por_modulo ?? null,
        incompletosPorModulo: d?.incompletos_por_modulo ?? null,
        alertas: d?.alertas ?? [],
      }
    },
    enabled: enLinea,
  })

  const { resumen, desactualizado } = useResumenLocal('supervisor', consulta.data, enLinea, {
    falloServidor: consulta.isError,
  })

  if (!resumen) {
    return consulta.isLoading ? (
      <Skeleton className="h-40 w-full" />
    ) : (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Inicio</h1>
          <ContextoInicio rol="Supervisor" />
        </header>
        <AvisoDatosLocales rol="supervisor" sinDatos enLinea={enLinea} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Inicio</h1>
        <ContextoInicio rol="Supervisor" />
      </header>

      {desactualizado && <AvisoDatosLocales enLinea={enLinea} />}

      {/* Cinco tarjetas: 3 + 2 en pantallas medianas y todas en una fila en las
          anchas. Con cuatro columnas la quinta quedaba sola abajo (U12). */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard sobria icon={School} label="Colegios registrados" value={resumen.colegios} />
        <StatCard sobria icon={Users} label="Docentes activos" value={resumen.docentesActivos} />
        <StatCard sobria icon={Play} label="Con actividad en curso" value={resumen.docentesConActividad} />
        {/* CU011 los llama VENCIDOS, no "pendientes": un registro vencido es
            uno obligatorio cuya fecha límite pasó sin registrarse, y es muy
            distinto de uno "pendiente de sincronizar" (generado sin conexión,
            que todavía no se ha perdido).
            Solo el número de estos dos cambia de color, y solo si hay algo. */}
        <StatCard
          sobria
          icon={CalendarClock}
          label="Registros vencidos"
          value={resumen.registrosVencidos ?? SIN_DATOS}
          tonoValor={resumen.registrosVencidos > 0 ? 'peligro' : undefined}
        />
        <StatCard
          sobria
          icon={AlertTriangle}
          label="Registros incompletos"
          value={resumen.registrosIncompletos ?? SIN_DATOS}
          tonoValor={resumen.registrosIncompletos > 0 ? 'aviso' : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/*
        El desglose por módulo, que es lo que convierte una cifra en una
        decisión: "40 vencidos" no dice qué hacer, pero "20 rúbricas y 10
        asistencias" sí, porque se persiguen de formas distintas.
      */}
      {(resumen.vencidosPorModulo || resumen.incompletosPorModulo) && (
        <Card title="Qué está vencido y qué está incompleto" icon={BarChart3} tono="gris" className="max-lg:order-2">
          <DesglosePorModulo vencidos={resumen.vencidosPorModulo} incompletos={resumen.incompletosPorModulo} />
        </Card>
      )}

      {/* En el teléfono las alertas suben por encima del desglose: es lo que
          hay que atender primero. */}
      <div className="max-lg:order-1">
        <AlertasInactividad alertas={resumen.alertas} desactualizadas={desactualizado} />
      </div>

      <Card title="Accesos" icon={Lock} tono="gris" className="max-lg:order-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ACCESOS.map((acceso) => (
            <Link
              key={acceso.to}
              to={acceso.to}
              className="sicedu-elevable group flex min-h-[60px] items-center gap-3 rounded-xl border border-line/80 bg-surface-0 px-3 py-2.5 text-sm font-semibold text-ink-900 hover:border-brand-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <IconoTinte icon={acceso.icon} tono="neutro" tamano="sm" />
              <span className="min-w-0 flex-1">{acceso.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-400 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
