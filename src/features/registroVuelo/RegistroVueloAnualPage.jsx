// Cubre: CU031, CU032 · Registro de Vuelo, rehecho en la tanda 9.
//
// DESAPARECE EL ASISTENTE. Antes se aplicaba una prueba, se contaban aciertos
// sobre un total y de ahí salía un nivel. Eso ya no existe: ahora hay una
// decisión por alumno y PERIODO ACADÉMICO, y el reparto es explícito.
//
//   · EL SERVIDOR CALCULA la entrada, la sugerencia y el nivel del programa.
//   · EL DOCENTE REGISTRA el nivel colocado, la proyección y la observación.
//
// SE ELIGE UN PERIODO Y SE TRABAJA EN ÉL, en vez de mostrar los cuatro a la
// vez: la habilitación es POR PA —tenerla en PA2 no habilita PA3— y la
// escritura llega una vez por periodo, así que mezclarlos dejaría media tabla
// editable y media no sin explicar por qué.
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlaneTakeoff } from 'lucide-react'
import AvisoActividades from '../../components/layout/AvisoActividades'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import AvisoConflictos from '../../components/layout/AvisoConflictos'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import FilaVuelo from './FilaVuelo'
import ModalObservacionVuelo from './ModalObservacionVuelo'
import ModalRubricaDeReferencia from './ModalRubricaDeReferencia'
import useRegistroVueloAnual from './useRegistroVueloAnual'
import useFiltrosDeGrupo from '../../hooks/useFiltrosDeGrupo'
import { ESTADO_PERIODO, periodoDe } from '../../api/resources/registroVueloAnual'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { useNivelesRazkids } from '../../hooks/useCatalogos'
import { mensajeDeError } from '../../api/client'
import { ACCION, puede } from '../../auth/permisos'
import { ROLES } from '../../auth/roles'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

const TONO = {
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  neutral: 'bg-surface-100 text-ink-500',
}

export default function RegistroVueloAnualPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const esDocente = idRol === ROLES.PROFESOR
  const conActividad = Boolean(useActividadStore((s) => s.sesion))
  // La clave de la matriz es `vuelo`, no `registro_vuelo`: ese es el nombre
  // del MÓDULO en el contrato, no el de la sección de permisos.
  const puedeEditar = puede('vuelo', idRol, ACCION.EDITAR)

  const [pagina, setPagina] = useState(1)
  const [numeroPA, setNumeroPA] = useState(null)
  const [observando, setObservando] = useState(null)
  const [viendoRubrica, setViendoRubrica] = useState(null)

  const { data: anios = [] } = useQuery({
    queryKey: ['anios-escolares'],
    queryFn: listarAniosEscolares,
    ...SIEMPRE,
  })
  const idAnioEscolar = useMemo(() => anioVigente(anios)?.id ?? null, [anios])

  // El Registro de Vuelo es del AÑO: no lleva mes ni semana.
  const { colegios, grados, secciones, programas, filtros, cambiar } = useFiltrosDeGrupo({
    esDocente,
    idAnioEscolar,
    conSemana: false,
  })

  const { data: niveles = [] } = useNivelesRazkids()
  const { datos, cargando, error, guardarDecision } = useRegistroVueloAnual({ filtros, pagina })

  const periodos = datos?.periodos ?? []

  /**
   * El periodo propuesto es el que está EN CURSO, y si no hay ninguno, el
   * último culminado: es el que el docente viene a registrar. Proponer PA1
   * siempre le haría cambiarlo cada vez que entra.
   */
  useEffect(() => {
    if (!periodos.length) return
    if (periodos.some((p) => p.numero === numeroPA)) return
    const enCurso = periodos.find((p) => p.estado === 'en_curso')
    const ultimoHecho = [...periodos].reverse().find((p) => p.estado === 'culminado')
    setNumeroPA((enCurso ?? ultimoHecho ?? periodos[0]).numero)
  }, [periodos, numeroPA])

  const periodo = periodos.find((p) => p.numero === numeroPA) ?? null
  const escritura = periodo?.escritura ?? null
  const puedeEscribir = Boolean(escritura?.permitida) && puedeEditar && conActividad
  const soloLectura = !puedeEscribir

  const listos = Boolean(
    filtros.idColegio && filtros.idGrado && filtros.idSeccion && filtros.idPrograma && idAnioEscolar,
  )
  const paginas = datos?.total_pages ?? 1

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Registro de Vuelo</h1>
        <p className="mt-1 text-sm text-ink-500">
          Una decisión por alumno y periodo académico: el sistema sugiere y el docente coloca.
        </p>
      </header>

      {puedeEditar && !conActividad && <AvisoActividades />}
      {/* La habilitación es POR PERIODO, y el servidor dice por qué falta en
          este: un periodo futuro no se registra, y uno sin autorización
          tampoco. Son motivos distintos y se leen tal cual. */}
      {escritura?.permitida === false && escritura.motivo && conActividad && (
        <AvisoActividades mensaje={escritura.motivo} />
      )}
      {escritura?.permitida && escritura.aviso_permiso && <AvisoActividades mensaje={escritura.aviso_permiso} />}
      {soloLectura && conActividad && escritura?.permitida && <AvisoModoConsulta />}
      <AvisoConflictos modulo="vuelo" />

      <FilterBar>
        <Select
          label="Colegio"
          value={filtros.idColegio}
          onChange={(e) => cambiar('colegio', e.target.value)}
          options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={filtros.idGrado}
          onChange={(e) => cambiar('grado', e.target.value)}
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre ?? `${g.id_grado}.° grado` }))}
        />
        <Select
          label="Sección"
          value={filtros.idSeccion}
          placeholder="Seleccione"
          onChange={(e) => cambiar('seccion', e.target.value)}
          options={secciones.map((s) => ({ value: s.id, label: s.nombre }))}
        />
        <Select
          label="Subprograma"
          value={filtros.idPrograma}
          placeholder="Seleccione"
          onChange={(e) => cambiar('subprograma', e.target.value)}
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
      </FilterBar>

      {!listos && (
        <Card>
          <EmptyState
            title="Complete los filtros"
            description="El Registro de Vuelo se arma con colegio, grado, sección y subprograma."
          />
        </Card>
      )}

      {listos && error && (
        <Card>
          <EmptyState title="No se pudo cargar el Registro de Vuelo" description={mensajeDeError(error)} />
        </Card>
      )}

      {/* Sin alumnos el servidor manda su `aviso` en un 200: es un estado del
          año, no una lista que falló al cargar. */}
      {listos && datos && datos.items.length === 0 && (
        <Card>
          <EmptyState
            icon={PlaneTakeoff}
            title="Sin alumnos en este grupo"
            description={datos.aviso ?? 'No hay alumnos que correspondan a este grupo en el año seleccionado.'}
          />
        </Card>
      )}

      {listos && datos && datos.items.length > 0 && periodo && (
        <>
          {/* Los cuatro periodos, con las fechas DEL CALENDARIO DEL COLEGIO y
              su estado. Un PA futuro se puede mirar pero no registrar. */}
          <div role="tablist" aria-label="Periodo académico" className="flex flex-wrap gap-2">
            {periodos.map((p) => {
              const estado = ESTADO_PERIODO[p.estado] ?? ESTADO_PERIODO.futuro
              const activo = p.numero === numeroPA
              return (
                <button
                  key={p.numero}
                  type="button"
                  role="tab"
                  aria-selected={activo}
                  onClick={() => setNumeroPA(p.numero)}
                  className={[
                    'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors',
                    activo ? 'border-brand-500 bg-brand-100' : 'border-line bg-surface-0 hover:border-brand-500/60',
                  ].join(' ')}
                >
                  <span className="text-sm font-semibold text-ink-900">{p.nombre}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${TONO[estado.tono]}`}>
                    {estado.texto}
                  </span>
                </button>
              )
            })}
          </div>

          <Card
            padded={false}
            title={`${datos.total} alumno${datos.total === 1 ? '' : 's'}`}
            subtitle={`${periodo.nombre} · del ${periodo.fecha_inicio} al ${periodo.fecha_fin}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] text-sm">
                <thead className="bg-surface-100 text-left text-xs uppercase tracking-wide text-ink-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Alumno
                    </th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">
                      Entrada
                    </th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">
                      Sugerencia
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Nivel colocado
                    </th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">
                      Nivel del programa
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Proyección
                    </th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">
                      Obs.
                    </th>
                    <th scope="col" className="px-3 py-2 text-center font-semibold">
                      Avance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {datos.items.map((alumno) => {
                    const suyo = periodoDe(alumno, numeroPA)
                    if (!suyo) return null
                    return (
                      <FilaVuelo
                        key={alumno.id_alumno}
                        alumno={alumno}
                        periodo={suyo}
                        niveles={niveles}
                        soloLectura={soloLectura}
                        onGuardar={guardarDecision}
                        onObservar={setObservando}
                        onVerRubrica={setViendoRubrica}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
                <span className="text-ink-500">
                  Página {datos.page} de {paginas}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={datos.page <= 1 || cargando}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={datos.page >= paginas || cargando}
                    onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      <ModalObservacionVuelo
        contexto={observando}
        soloLectura={soloLectura}
        onGuardar={(texto) => {
          const { alumno, periodo: suyo } = observando
          setObservando(null)
          guardarDecision(alumno, suyo, { observacion: texto || null })
        }}
        onCerrar={() => setObservando(null)}
      />

      <ModalRubricaDeReferencia contexto={viendoRubrica} onCerrar={() => setViendoRubrica(null)} />
    </div>
  )
}
