// Cubre: RF-004, RF-002, RN-001, RN-003, RN-006, RNF-006
import { BookOpen, CalendarCheck, ClipboardList, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import AccesosRapidos from './AccesosRapidos'
import useResumenDocente from './useResumenDocente'
import { horaFinDe } from '../../store/actividadStore'
import { caducaEn } from '../../auth/jwt'
import ResumenesAccion from './ResumenesAccion'
import useActividad from './useActividad'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import { usePeriodos } from '../../hooks/useCatalogos'
import useFiltrosStore from '../../store/filtrosStore'
import useSessionStore from '../../store/sessionStore'
import { formatearHora, formatearRangoSemana } from '../../lib/format'

const saludo = () => {
  const hora = dayjs().hour()
  if (hora < 12) return 'Buenos días'
  return hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}

export default function InicioDocente() {
  const usuario = useSessionStore((s) => s.usuario)
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const { data: periodos = [] } = usePeriodos()
  const { data: resumen, isLoading, semanaActual } = useResumenDocente()

  const periodo = periodos.find((p) => p.id_periodo === idPeriodo)
  const primerNombre = usuario?.nombres?.split(' ')[0] ?? usuario?.nombre_completo?.split(' ')[0] ?? ''

  // El control está en la barra superior; aquí solo se lee su estado.
  const { sesion, sinAsignaciones } = useActividad()

  /**
   * La hora de fin es la de la SESIÓN AUTENTICADA, no la de la actividad.
   *
   * CU009 y CU010 son explícitos: una actividad no tiene vigencia propia de 8
   * horas, hereda la expiración fijada en CU003. Antes se pintaba "inicio de
   * actividad + 8 h", así que quien entraba a las 08:00 y abría actividad a las
   * 14:00 leía que acababa a las 22:00 cuando su sesión moría a las 16:00.
   *
   * Con el simulador el token no es un JWT y no trae `exp`; ahí se cae al
   * cálculo antiguo, que es lo único disponible.
   */
  const token = useSessionStore((s) => s.token)
  const expira = caducaEn(token)
  const finDeSesion = expira ? dayjs(expira) : horaFinDe(sesion?.inicio)

  return (
    <div className="flex flex-col gap-6">
      {/* Los controles van en la esquina superior derecha, como pide CU010. */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">
          {saludo()}, {primerNombre}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
          Periodo de evaluación
          <Badge tone={periodo?.estado === 'abierto' ? 'success' : 'neutral'}>
            {periodo ? `${periodo.nombre} ${periodo.anio}` : '—'}
          </Badge>
          {semanaActual && <span>· Semana {semanaActual.numero} · {formatearRangoSemana(semanaActual)}</span>}
        </p>
        </div>

        {/* El BOTÓN vive en la barra superior, uno solo para toda la
            aplicación. Aquí queda el texto estático que pide CU010: la hora de
            inicio y la de fin, sin cronómetro regresivo. */}
        {sesion && (
          <p className="text-sm text-ink-500">
            Actividad iniciada a las {formatearHora(sesion.inicio)}. La sesión finaliza a las{' '}
            {formatearHora(finDeSesion)}.
          </p>
        )}

        {/* CU010: sin asignaciones el botón se ve pero deshabilitado, y hay que
            decir por qué; si no, parece que la aplicación está rota. */}
        {!sesion && sinAsignaciones && (
          <p className="text-sm font-medium text-warning-600">
            No puede iniciar una actividad porque no tiene asignaciones activas.
          </p>
        )}
      </header>

      <ResumenesAccion />

      {/* RN-010: el corte diagnóstico está abierto y todavía falta registrarlo. */}
      {resumen?.evaluacion_abierta && resumen.evaluacion_abierta.registrados < resumen.evaluacion_abierta.total && (
        <Card className="border-warning-600/30 bg-warning-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-warning-600">
                Evaluación diagnóstica de {resumen.evaluacion_abierta.nombre} abierta
              </h2>
              <p className="mt-1 text-sm text-ink-700">
                Lleva {resumen.evaluacion_abierta.registrados} de {resumen.evaluacion_abierta.total} estudiantes
                registrados en este corte.
              </p>
            </div>
            <Link
              to="/registro-vuelo/nuevo"
              className="inline-flex h-10 shrink-0 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              Registrar evaluación
            </Link>
          </div>
        </Card>
      )}

      {/* Sin datos del servidor no se pintan: mostrar las cifras del
          simulador junto a las asignaciones reales confundía (D13). */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      ) : resumen && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Mis estudiantes" value={resumen?.mis_estudiantes ?? 0} />
          <StatCard
            icon={ClipboardList}
            label="Reporte de esta semana"
            value={`${resumen?.reporte_semana.registrados ?? 0} / ${resumen?.reporte_semana.total ?? 0}`}
            hint="Estudiantes con registro semanal"
          />
          <StatCard
            icon={BookOpen}
            label="Pendientes de rúbrica"
            value={resumen?.pendientes_rubrica ?? 0}
            hint="Sin Fluidez y Comprensión de la semana"
          />
          <StatCard
            icon={CalendarCheck}
            label="Ajustes por revisar"
            value={resumen?.ajustes_por_revisar ?? 0}
            hint="Sugerencias sin confirmar del periodo"
          />
        </div>
      )}

      {/* Las asignaciones las pinta `ResumenesAccion`, que lee el endpoint
          real `GET /inicio/docente`. Antes había aquí una segunda tarjeta con
          el mismo título alimentada por el simulador: dos "Mis asignaciones"
          que podían contradecirse. */}

      <section>
        <h2 className="text-xl font-semibold text-ink-900">Accesos rápidos</h2>
        <div className="mt-4">
          <AccesosRapidos />
        </div>
      </section>
    </div>
  )
}
