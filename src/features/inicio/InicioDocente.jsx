// Cubre: RF-004, RF-002, RN-001, RN-003, RN-006, RNF-006
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, ClipboardCheck, ClipboardList, GraduationCap } from 'lucide-react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import AccesosRapidos from './AccesosRapidos'
import AvisoDatosLocales from './AvisoDatosLocales'
import ContextoInicio from './ContextoInicio'
import useResumenDocente from './useResumenDocente'
import useResumenLocal from './useResumenLocal'
import { horaFinDe } from '../../store/actividadStore'
import { caducaEn } from '../../auth/jwt'
import { obtenerInicioDocente } from '../../api/resources/inicio'
import ResumenesAccion from './ResumenesAccion'
import useActividad, { SIN_HABILITACIONES } from './useActividad'
import Card from '../../components/ui/Card'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import useConexion from '../../hooks/useConexion'
import useSessionStore from '../../store/sessionStore'
import { enOtroDia, formatearDiaMes, formatearHora, formatearRangoSemana } from '../../lib/format'

const saludo = () => {
  const hora = dayjs().hour()
  if (hora < 12) return 'Buenos días'
  return hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}

/** Literales de CU010 para `motivo_no_puede_iniciar`. */
/**
 * Respaldo por motivo, para cuando el servidor no manda su texto.
 *
 * Lo normal es pintar `motivo_no_puede`, que llega ya redactado desde T4: el
 * mensaje depende del calendario de CADA colegio y de los permisos vigentes, y
 * eso no se puede deducir en el cliente. Esto es la red por si no llega.
 *
 * `fuera_de_periodo` DESAPARECIÓ del contrato en T4: ahora un docente sin
 * ningún colegio en PA cae también en `sin_asignaciones`. Se deja reconocido
 * por si un servidor sin actualizar todavía lo manda.
 */
const MOTIVO_SIN_ACTIVIDAD = {
  sin_asignaciones: SIN_HABILITACIONES,
  fuera_de_periodo: 'No puedes iniciar una actividad fuera del calendario operativo.',
  actividad_activa: 'Ya tienes una actividad en curso. Finalízala para poder iniciar otra.',
}

export default function InicioDocente() {
  const usuario = useSessionStore((s) => s.usuario)
  const enLinea = useConexion()
  const { data: datosServidor, isLoading, isError, semanaActual } = useResumenDocente(enLinea)
  /**
   * D52 — CON EL SERVIDOR CAÍDO, INICIO MOSTRABA DATOS SIN AVISAR.
   *
   * `useResumenDocente` solo sabía pedir al servidor: sin conexión o con un
   * fallo de red, `resumen` se quedaba con lo último que había en memoria
   * (o en nada si era una recarga), sin ninguna señal de que podía estar
   * desactualizado. Supervisor y Directivo ya resuelven esto con la copia
   * de `useResumenLocal` (CU011, CU012); el Docente nunca la tuvo.
   */
  const { resumen, desactualizado } = useResumenLocal('docente', datosServidor, enLinea, {
    falloServidor: isError,
  })

  /**
   * "Mis alumnos" NO sale de `useResumenDocente` (ese endpoint no existe
   * todavía: ver `api/resources/docentes.js`, siempre `null` contra el
   * backend real). El total de alumnos SÍ lo trae `GET /inicio/docente`, el
   * mismo que ya pinta "Mis asignaciones" más abajo — de ahí que esa tarjeta
   * mostrara 7 mientras esta decía 0 con los mismos datos cargados. Mismo
   * `queryKey` que usa `ResumenesAccion`: TanStack Query comparte la caché,
   * así que esto no duplica la petición.
   */
  const { data: inicioDocente } = useQuery({
    queryKey: ['inicio', 'docente', usuario?.id_docente],
    queryFn: obtenerInicioDocente,
    enabled: Boolean(usuario?.id_docente),
  })
  const totalAlumnos = inicioDocente?.totales?.cantidad_alumnos

  const primerNombre = usuario?.nombres?.split(' ')[0] ?? usuario?.nombre_completo?.split(' ')[0] ?? ''

  // El control está en la barra superior; aquí solo se lee su estado.
  const { sesion, sinAsignaciones, motivoNoPuedeIniciar, textoNoPuedeIniciar } = useActividad()

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

  // Las tarjetas del panel: mientras carga, sin datos y sin red, o las cifras.
  const panel = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      )
    }
    if (!resumen && !enLinea) return <AvisoDatosLocales rol="docente" sinDatos enLinea={enLinea} />
    return (
      <>
        {desactualizado && <AvisoDatosLocales rol="docente" enLinea={enLinea} />}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard sobria icon={GraduationCap} label="Mis alumnos" value={totalAlumnos ?? resumen?.mis_estudiantes ?? 0} />
        <StatCard
          sobria
          icon={ClipboardList}
          label="Reporte de esta semana"
          value={`${resumen?.reporte_semana.registrados ?? 0} / ${resumen?.reporte_semana.total ?? 0}`}
          hint="Estudiantes con registro semanal"
        />
        <StatCard
          sobria
          icon={ClipboardCheck}
          label="Pendientes de rúbrica"
          value={resumen?.pendientes_rubrica ?? 0}
          hint="Sin Fluidez y Comprensión de la semana"
        />
        <StatCard
          sobria
          icon={CalendarCheck}
          label="Ajustes por revisar"
          value={resumen?.ajustes_por_revisar ?? 0}
          hint="Sugerencias sin confirmar del periodo"
        />
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Los controles van en la esquina superior derecha, como pide CU010. */}
      <header className="flex flex-col items-start gap-2">
        <div>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">
          {saludo()}, {primerNombre}
        </h1>
        {/* YA NO SE ANUNCIA UN "periodo de evaluación" GLOBAL.
            CU027 reparte el año en PA1 a PA4 con sus recesos, y cada colegio
            puede tener fechas propias: no existe un periodo único para toda
            la aplicación que se pueda poner en una cabecera. El periodo
            aplicable es función de (colegio, fecha) y lo resuelve el
            servidor. La semana en curso sí se queda: esa es del calendario,
            no de un periodo, y le dice al docente dónde está. */}
        <ContextoInicio rol="Docente" extra={semanaActual && `Semana del ${formatearRangoSemana(semanaActual)}`} />
        </div>

        {/* El BOTÓN vive en la barra superior, uno solo para toda la
            aplicación. Aquí queda el texto estático que pide CU010: la hora de
            inicio y la de fin, sin cronómetro regresivo. */}
        {/* CU010: si la sesión termina AL DÍA SIGUIENTE hay que decir la
            fecha. Sin ella, "finaliza a las 02:00" a las 21:00 de un martes se
            lee como que quedan menos de tres horas cuando quedan cinco, o peor,
            como que ya pasó. */}
        {sesion && (
          <p className="rounded-lg border border-line bg-surface-0 px-3 py-1.5 text-sm text-ink-700">
            {`Actividad iniciada a las ${formatearHora(sesion.inicio)}. La sesión finaliza `}
            {enOtroDia(sesion.inicio, finDeSesion)
              ? `el ${formatearDiaMes(finDeSesion)} a las ${formatearHora(finDeSesion)}.`
              : `a las ${formatearHora(finDeSesion)}.`}
          </p>
        )}

        {/* CU010: el botón se ve pero deshabilitado, y hay que decir POR QUÉ;
            si no, parece que la aplicación está rota. El motivo lo decide el
            servidor (`motivo_no_puede_iniciar`), porque el calendario operativo
            vive en su base de datos: "fuera de periodo" no se puede deducir
            aquí. Los textos son los literales de CU010. */}
        {!sesion && sinAsignaciones && (
          <p className="rounded-lg bg-warning-100 px-3 py-1.5 text-sm font-medium text-warning-600">
            {textoNoPuedeIniciar ??
              MOTIVO_SIN_ACTIVIDAD[motivoNoPuedeIniciar] ??
              MOTIVO_SIN_ACTIVIDAD.sin_asignaciones}
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
              className="inline-flex h-10 shrink-0 items-center rounded-lg bg-brand-solid px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-solidHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              Registrar evaluación
            </Link>
          </div>
        </Card>
      )}

      {panel()}

      {/* Las asignaciones las pinta `ResumenesAccion`, que lee el endpoint
          real `GET /inicio/docente`. Antes había aquí una segunda tarjeta con
          el mismo título alimentada por el simulador: dos "Mis asignaciones"
          que podían contradecirse. */}

      <section>
        <h2 className="text-lg font-semibold text-ink-900 sm:text-xl">Accesos rápidos</h2>
        <div className="mt-3 sm:mt-4">
          <AccesosRapidos />
        </div>
      </section>
    </div>
  )
}
