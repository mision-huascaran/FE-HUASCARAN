// Dashboard del Supervisor y del Directivo.
//
// CUATRO TARJETAS, UNA POR MÓDULO, en el orden en que se trabaja: Asistencias,
// Seguimiento de Lectura, Rúbrica y Registro de Vuelo. Cada una lleva su
// nombre del menú, una cifra, una gráfica y la salida a su módulo.
//
// POR QUÉ SE REARMÓ. Antes eran nueve bloques organizados por indicador
// —"Distribución por subprograma", "Comparación de resultados", "Evolución
// anual"—, cada uno con su párrafo de fórmula, sus ocho tarjetas de cifras y
// su tabla completa. Se podía leer entero y seguir sin saber qué hacer con lo
// leído: ningún bloque llevaba al módulo donde se corrige lo que mostraba.
// Ahora la pregunta que responde la pantalla es "¿qué módulo necesita que
// entre?", y la respuesta se pulsa.
//
// LA DIFERENCIA ENTRE LOS DOS ROLES NO ES QUÉ TARJETAS VEN, son las mismas
// cuatro con los mismos títulos: es a dónde pueden entrar desde ellas. Los
// cuatro módulos son `[DIRECTIVO]: null` en la matriz de permisos, así que sus
// tarjetas informan y no ofrecen enlace — mandarlo a una ruta que su propia
// guarda le va a negar sería ofrecerle una puerta tapiada. Lo decide
// `enlaceDeModulo` leyendo la matriz, no un `if` por rol aquí.
//
// ES SOLO EN LÍNEA y de solo lectura: no requiere actividad de trabajo y no
// modifica ningún registro.
import { useMemo } from 'react'
import { Info, ShieldOff } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import Tooltip from '../../components/ui/Tooltip'
import RequiereConexion from '../../components/layout/RequiereConexion'
import { useAuth } from '../../auth/AuthProvider'
import { ROLES } from '../../auth/roles'
import useConexion from '../../hooks/useConexion'
import FiltrosDashboard from './FiltrosDashboard'
import useFiltrosDashboard from './useFiltrosDashboard'
import TarjetaAsistencia from './TarjetaAsistencia'
import TarjetaLectura from './TarjetaLectura'
import TarjetaRubrica from './TarjetaRubrica'
import TarjetaVuelo from './TarjetaVuelo'
import {
  FALTAN_FILTROS,
  FALTAN_FILTROS_DIRECTIVO,
  ROL_SIN_DASHBOARD,
  SIN_COLEGIOS_AUTORIZADOS,
  alcanceEnTexto,
} from './estados'

/** Lo que antes era un párrafo bajo el título: queda a un clic, no en medio. */
const SUBTITULO = 'Cómo van las asistencias, la lectura, la rúbrica y el registro de vuelo, por año escolar y periodo.'

const QUE_SE_ESTA_VIENDO =
  'Consulta de solo lectura con información confirmada por el servidor y solo de alumnos activos. Los registros pendientes de sincronizar no se incluyen hasta que el servidor los acepta.'

export default function DashboardPage() {
  const { usuario } = useAuth()
  const enLinea = useConexion()
  const idRol = Number(usuario?.id_rol)
  const esDirectivo = idRol === ROLES.DIRECTIVO
  const esSupervisor = idRol === ROLES.JEFA

  const {
    catalogo,
    colegios,
    anios,
    periodos,
    borrador,
    aplicados,
    cambiar,
    aplicar,
    completos,
    hayCambios,
    avisoAlcance,
    periodoAplicado,
    anioAplicado,
  } = useFiltrosDashboard({ clave: 'dashboard' })

  /**
   * El contexto que acompaña a CADA tarjeta: año, periodo y colegios de la
   * consulta MOSTRADA, no del borrador. Es lo que impide que unos resultados
   * se lean bajo el título de una selección que todavía no se consultó.
   */
  const contexto = useMemo(() => {
    if (!aplicados) return []
    return [
      anioAplicado?.nombre ? `Año escolar ${anioAplicado.nombre}` : null,
      periodoAplicado?.nombre ?? null,
      alcanceEnTexto({ ...aplicados, colegios }),
    ].filter(Boolean)
  }, [aplicados, anioAplicado, periodoAplicado, colegios])

  /** Lectura es del AÑO entero: su endpoint prohíbe el periodo académico. */
  const contextoAnual = useMemo(
    () =>
      aplicados
        ? [
            anioAplicado?.nombre ? `Año escolar ${anioAplicado.nombre}` : null,
            alcanceEnTexto({ ...aplicados, colegios }),
          ].filter(Boolean)
        : [],
    [aplicados, anioAplicado, colegios],
  )

  const titulo = esDirectivo ? 'Dashboard del Directivo' : 'Dashboard'

  const cabecera = (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{titulo}</h1>
        <Tooltip content={QUE_SE_ESTA_VIENDO}>
          <button
            type="button"
            aria-label="Qué información se está viendo"
            className="inline-flex rounded-full text-ink-400 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      {/* N009 — Como en los demás módulos, una línea que dice qué se ve aquí. */}
      <p className="mt-1 text-sm text-ink-500">{SUBTITULO}</p>
    </header>
  )

  /**
   * EL ROL CAMBIÓ CON LA PANTALLA ABIERTA. La ruta ya impide ENTRAR sin el
   * rol; esto cubre lo otro: estar dentro y dejar de tenerlo. Va ANTES que el
   * aviso de conexión a propósito: sin autorización no importa si hay red.
   */
  if (!esDirectivo && !esSupervisor) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <Card>
          <EmptyState icon={ShieldOff} title={ROL_SIN_DASHBOARD} />
        </Card>
      </div>
    )
  }

  if (!enLinea) {
    return (
      <div className="flex flex-col gap-5">
        {cabecera}
        <Card>
          <RequiereConexion seccion="El dashboard" />
        </Card>
      </div>
    )
  }

  const comun = { filtros: aplicados, hayCambios, idRol, anioEscolar: anioAplicado?.nombre }

  return (
    <div className="flex flex-col gap-5">
      {cabecera}

      <Card padded={false}>
        {catalogo.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <FiltrosDashboard
            anios={anios}
            periodos={periodos}
            colegios={colegios}
            borrador={borrador}
            completos={completos}
            hayCambios={hayCambios}
            aviso={avisoAlcance}
            onCambiar={cambiar}
            onAplicar={aplicar}
          />
        )}
      </Card>

      {/* Sin alcance no hay dashboard, y el literal lo dice tal cual. */}
      {!catalogo.isLoading && colegios.length === 0 && (
        <Card>
          <EmptyState title={SIN_COLEGIOS_AUTORIZADOS} />
        </Card>
      )}

      {/* Nunca se consulta con filtros incompletos: ni se aproxima un
          calendario ni se sustituye una selección vacía por "todos". */}
      {!catalogo.isLoading && colegios.length > 0 && !aplicados && (
        <Card>
          <EmptyState title={esDirectivo ? FALTAN_FILTROS_DIRECTIVO : FALTAN_FILTROS} />
        </Card>
      )}

      {aplicados && (
        <div className="grid gap-5 xl:grid-cols-2">
          <TarjetaAsistencia {...comun} contexto={contexto} />
          <TarjetaLectura {...comun} contexto={contextoAnual} conConsolidado={!esDirectivo} />
          <TarjetaRubrica {...comun} contexto={contexto} />
          <TarjetaVuelo {...comun} contexto={contexto} />
        </div>
      )}
    </div>
  )
}
