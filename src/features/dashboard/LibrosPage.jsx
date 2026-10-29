// "Consultar consolidado de libros leídos" (CU034). Solo Supervisor.
//
// Extiende a CU033: se llega desde su acceso y HEREDA el año escolar y la
// selección de colegios "recibida desde CU033", previa validación del alcance.
// Esa herencia viaja en la URL (`?anio=&todos=1` o `?anio=&colegios=1,4`) y no
// en memoria, por dos motivos: sobrevive a una recarga —si no, un F5 dejaría la
// pantalla sin filtros y pidiendo rellenarlos— y el enlace se puede compartir
// sin que apunte a los filtros de otra persona.
//
// EL PERIODO ACADÉMICO NO SE TRANSFIERE, y es deliberado: el consolidado se
// organiza por MESES del año escolar. Mandarlo al endpoint es un 422, y por eso
// esta pantalla pide los filtros con `exigePeriodo: false`.
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import RequiereConexion from '../../components/layout/RequiereConexion'
import useConexion from '../../hooks/useConexion'
import FiltrosDashboard from './FiltrosDashboard'
import useFiltrosDashboard from './useFiltrosDashboard'
import BloqueLibros from './BloqueLibros'
import DetalleColegioLibros from './DetalleColegioLibros'
import { FALTAN_FILTROS_LIBROS, SIN_COLEGIOS_AUTORIZADOS, alcanceEnTexto } from './estados'

/** Lo que CU033 dejó en la URL, en la forma que usan los filtros. */
function heredadosDe(parametros) {
  const anio = parametros.get('anio')
  if (!anio) return null
  const colegios = (parametros.get('colegios') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return {
    idAnioEscolar: anio,
    idPeriodoAcademico: '',
    todosLosColegios: parametros.get('todos') === '1' || colegios.length === 0,
    idColegios: colegios,
  }
}

export default function LibrosPage() {
  const [parametros] = useSearchParams()
  const enLinea = useConexion()
  const [colegio, setColegio] = useState(null)

  const {
    catalogo,
    colegios,
    anios,
    borrador,
    aplicados,
    cambiar,
    aplicar,
    completos,
    hayCambios,
    avisoAlcance,
    anioAplicado,
    heredar,
  } = useFiltrosDashboard({ clave: 'dashboard.libros', exigePeriodo: false })

  const heredados = useMemo(() => heredadosDe(parametros), [parametros])

  /**
   * La herencia solo se aplica si SIGUE SIENDO VÁLIDA con el alcance de hoy.
   *
   * Si un colegio dejó de estar autorizado entre CU033 y aquí, el CU prohíbe
   * sustituirlo en silencio: `useFiltrosDashboard` lo recorta y pide revisar.
   */
  useEffect(() => {
    if (!heredados || !catalogo.data) return
    const autorizados = new Set(colegios.map((c) => String(c.id_colegio)))
    const validos = heredados.todosLosColegios || heredados.idColegios.every((id) => autorizados.has(String(id)))
    if (validos) heredar(heredados)
    // `heredar` cambia en cada render del hook: se deja fuera a propósito para
    // que esto ocurra una vez por herencia recibida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heredados, catalogo.data])

  const contexto = useMemo(
    () =>
      aplicados
        ? [
            anioAplicado?.nombre ? `Año escolar ${anioAplicado.nombre}` : null,
            alcanceEnTexto({ ...aplicados, colegios }),
          ].filter(Boolean)
        : [],
    [aplicados, anioAplicado, colegios],
  )

  if (!enLinea) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Consolidado de libros leídos</h1>
        </header>
        <Card>
          <RequiereConexion seccion="El consolidado de libros leídos" />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Consolidado de libros leídos</h1>
          <p className="mt-1 text-sm text-ink-500">
            Por meses del año escolar. Cada cantidad se atribuye al mes de su clase de referencia, no al mes en que
            se registró.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver al dashboard
        </Link>
      </header>

      <Card padded={false}>
        {catalogo.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <FiltrosDashboard
            anios={anios}
            colegios={colegios}
            borrador={borrador}
            conPeriodo={false}
            completos={completos}
            hayCambios={hayCambios}
            aviso={avisoAlcance}
            onCambiar={cambiar}
            onAplicar={aplicar}
          />
        )}
      </Card>

      {!catalogo.isLoading && colegios.length === 0 && (
        <Card>
          <EmptyState title={SIN_COLEGIOS_AUTORIZADOS} />
        </Card>
      )}

      {!catalogo.isLoading && colegios.length > 0 && !aplicados && (
        <Card>
          <EmptyState title={FALTAN_FILTROS_LIBROS} />
        </Card>
      )}

      {aplicados &&
        (colegio ? (
          <DetalleColegioLibros
            filtros={aplicados}
            colegio={colegio}
            contexto={contexto}
            anioEscolar={anioAplicado?.nombre}
            onVolver={() => setColegio(null)}
          />
        ) : (
          <BloqueLibros
            filtros={aplicados}
            contexto={contexto}
            hayCambios={hayCambios}
            anioEscolar={anioAplicado?.nombre}
            alcance={alcanceEnTexto({ ...aplicados, colegios })}
            onColegio={setColegio}
          />
        ))}
    </div>
  )
}
