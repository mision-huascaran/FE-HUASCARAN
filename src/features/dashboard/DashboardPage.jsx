// Dashboard (CU033 para el Supervisor, CU035 para el Directivo).
//
// UNA RUTA, DOS PANTALLAS. Comparten los filtros y cuatro bloques, pero no son
// la misma: al Supervisor le corresponden la distribución por subprograma, la
// comparación de resultados y el detalle nominal de clases y de libros; al
// Directivo, un resumen anual y la comparación entre colegios, y NINGÚN listado
// de alumnos. No es una decisión de diseño: esos cinco endpoints le responden
// 403, y RN-033 y RN-034 le prohíben ver datos de estudiantes.
//
// ES SOLO EN LÍNEA por restricción expresa de los tres casos de uso, y de solo
// lectura: no requiere actividad de trabajo y no modifica ningún registro.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import RequiereConexion from '../../components/layout/RequiereConexion'
import { useAuth } from '../../auth/AuthProvider'
import { ROLES } from '../../auth/roles'
import useConexion from '../../hooks/useConexion'
import { useGradosReales, useProgramasReales } from '../../hooks/useCatalogos'
import FiltrosDashboard from './FiltrosDashboard'
import useFiltrosDashboard from './useFiltrosDashboard'
import BloqueDistribucion from './BloqueDistribucion'
import BloqueResultados from './BloqueResultados'
import BloqueComparacion from './BloqueComparacion'
import BloqueAsistencia from './BloqueAsistencia'
import BloqueEvolucion from './BloqueEvolucion'
import BloqueComparacionColegios from './BloqueComparacionColegios'
import ResumenAnual from './ResumenAnual'
import {
  FALTAN_FILTROS,
  FALTAN_FILTROS_DIRECTIVO,
  SIN_COLEGIOS_AUTORIZADOS,
  alcanceEnTexto,
} from './estados'

/** Los filtros aplicados, en la URL, para que CU034 los herede (CU033 paso 10). */
function enlaceDeLibros(filtros) {
  const parametros = new URLSearchParams({ anio: String(filtros.idAnioEscolar) })
  if (filtros.todosLosColegios) parametros.set('todos', '1')
  else parametros.set('colegios', filtros.idColegios.join(','))
  return `/dashboard/libros?${parametros.toString()}`
}

export default function DashboardPage() {
  const { usuario } = useAuth()
  const enLinea = useConexion()
  const esDirectivo = Number(usuario?.id_rol) === ROLES.DIRECTIVO
  // El bloque de comparación necesita los catálogos de grados y subprogramas
  // para sus filtros propios. El Directivo no tiene ese bloque, así que no se
  // los pide: `GET /grados` y `GET /programas` son de administración.
  const { data: grados = [] } = useGradosReales({ enabled: !esDirectivo })
  const { data: programas = [] } = useProgramasReales({ enabled: !esDirectivo })

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
   * El contexto que acompaña a CADA bloque: año, periodo y colegios de la
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

  if (!enLinea) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{titulo}</h1>
        </header>
        <Card>
          <RequiereConexion seccion="El dashboard" />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{titulo}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Consulta de solo lectura con información confirmada por el servidor. Los registros pendientes de
          sincronizar no se incluyen hasta que el servidor los acepta.
        </p>
      </header>

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
        <>
          {esDirectivo && (
            <ResumenAnual filtros={aplicados} contexto={contextoAnual} anio={anioAplicado?.nombre} />
          )}

          {!esDirectivo && (
            <BloqueDistribucion
              filtros={aplicados}
              contexto={contexto}
              hayCambios={hayCambios}
              anioEscolar={anioAplicado?.nombre}
            />
          )}

          <BloqueResultados filtros={aplicados} contexto={contexto} hayCambios={hayCambios} />

          {!esDirectivo && (
            <BloqueComparacion
              filtros={aplicados}
              contexto={contexto}
              hayCambios={hayCambios}
              programas={programas}
              grados={grados}
            />
          )}

          <BloqueAsistencia
            filtros={aplicados}
            contexto={contexto}
            hayCambios={hayCambios}
            anioEscolar={anioAplicado?.nombre}
            periodo={periodoAplicado}
            alcance={alcanceEnTexto({ ...aplicados, colegios })}
            conDetalle={!esDirectivo}
          />

          <BloqueEvolucion
            filtros={aplicados}
            contexto={contextoAnual}
            hayCambios={hayCambios}
            anioEscolar={anioAplicado?.nombre}
            conLibros={esDirectivo}
          />

          {esDirectivo && (
            <BloqueComparacionColegios
              filtros={aplicados}
              contexto={contexto}
              hayCambios={hayCambios}
              periodo={periodoAplicado}
            />
          )}

          {/* El acceso a CU034 lleva los filtros de la consulta MOSTRADA, no
              los cambios pendientes, y sin el periodo académico: el
              consolidado se organiza por meses del año escolar. */}
          {!esDirectivo && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-700">
                  El consolidado de libros leídos usa el año escolar y los colegios de esta consulta, por meses.
                </p>
                <Link
                  to={enlaceDeLibros(aplicados)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  <BookOpen className="h-4 w-4" aria-hidden />
                  Ver consolidado de libros leídos
                </Link>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
