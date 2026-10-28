// Cubre: CU029, CU030 · Rúbrica MENSUAL, rehecha en la tanda 8.
//
// LA RÚBRICA SEMANAL YA NO EXISTE. Antes se capturaba por semana y compartía
// pantalla con el Seguimiento de Lectura; ahora es una evaluación por alumno y
// MES, con su propia pantalla. No es un cambio de periodicidad: es otra unidad
// de trabajo, y por eso no quedó nada de la grilla anterior.
//
// DOS DIMENSIONES, Fluidez y Comprensión, en códigos del 0 al 4. Y el 0 ES UN
// VALOR —"Pre-inicio"—, mientras `null` es "sin evaluar": un alumno sin
// evaluar no es el peor de la clase.
//
// SE PUEDE GUARDAR A MEDIAS. Con una sola dimensión la fila queda "incompleta"
// y se guarda igual: el docente no tiene por qué evaluar las dos cosas en la
// misma sentada, y obligarle le haría perder lo ya observado.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookMarked, Info } from 'lucide-react'
import AvisoActividades from '../../components/layout/AvisoActividades'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import AvisoConflictos from '../../components/layout/AvisoConflictos'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import FilaRubrica from './FilaRubrica'
import PanelCriterios from './PanelCriterios'
import useRubricaMensual from './useRubricaMensual'
import useFiltrosDeGrupo, { MESES } from '../../hooks/useFiltrosDeGrupo'
import { MOTIVO_RUBRICA } from '../../api/resources/rubricaMensual'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { ACCION, puede } from '../../auth/permisos'
import { ROLES } from '../../auth/roles'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'
import useRechazosStore from '../../store/rechazosStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

export default function RubricaPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const esDocente = idRol === ROLES.PROFESOR
  const conActividad = Boolean(useActividadStore((s) => s.sesion))
  const puedeEditar = puede('rubrica', idRol, ACCION.EDITAR)

  const [pagina, setPagina] = useState(1)
  const [verCriterios, setVerCriterios] = useState(false)

  const { data: anios = [] } = useQuery({
    queryKey: ['anios-escolares'],
    queryFn: listarAniosEscolares,
    ...SIEMPRE,
  })
  const idAnioEscolar = useMemo(() => anioVigente(anios)?.id ?? null, [anios])

  // La rúbrica no tiene semana: es del mes entero.
  const { colegios, grados, secciones, programas, filtros, cambiar } = useFiltrosDeGrupo({
    esDocente,
    idAnioEscolar,
    conSemana: false,
  })

  const { datos, cargando, motivoDelMes, error, guardarFila } = useRubricaMensual({ filtros, pagina })

  const listos = Boolean(
    filtros.idColegio && filtros.idGrado && filtros.idSeccion && filtros.idPrograma && filtros.mes && idAnioEscolar,
  )

  // El nombre del subprograma, no su id: la escala se conoce por el nombre
  // porque los ids son de la base y cambian entre entornos.
  const nombrePrograma = useMemo(
    () => programas.find((p) => String(p.id_programa) === String(filtros.idPrograma))?.nombre ?? '',
    [programas, filtros.idPrograma],
  )

  const escritura = datos?.escritura ?? null
  const puedeEscribir = Boolean(escritura?.permitida) && puedeEditar && conActividad
  const soloLectura = !puedeEscribir

  /**
   * El rechazo del servidor, emparejado con SU alumno.
   *
   * Se busca por `envio.item.id_alumno` y no por la clave del rechazo: la
   * clave junta siete campos y rearmarla aquí significaría repetir ese
   * formato en dos sitios, que es el tipo de duplicado que se desincroniza.
   */
  const rechazos = useRechazosStore((st) => st.rechazos)
  const rechazoDe = (idAlumno) =>
    rechazos.find((r) => r.modulo === 'rubrica' && r.envio?.item?.id_alumno === idAlumno) ?? null

  const paginas = datos?.total_pages ?? 1

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Rúbrica</h1>
          <p className="mt-1 text-sm text-ink-500">
            Una evaluación por alumno y mes: Fluidez y Comprensión, con su resultado ponderado.
          </p>
        </div>
        {/* Los descriptores los sirve el servidor (RN-011): son material
            pedagógico de Misión Huascarán, no texto del programa. */}
        <Button variant="outline" iconLeft={Info} onClick={() => setVerCriterios(true)}>
          Ver criterios
        </Button>
      </header>

      {puedeEditar && !conActividad && <AvisoActividades />}
      {escritura?.permitida === false && escritura.motivo && conActividad && (
        <AvisoActividades mensaje={escritura.motivo} />
      )}
      {escritura?.permitida && escritura.aviso_permiso && <AvisoActividades mensaje={escritura.aviso_permiso} />}
      {soloLectura && conActividad && escritura?.permitida && <AvisoModoConsulta />}
      <AvisoConflictos modulo="rubrica" />

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
        <Select
          label="Mes"
          value={filtros.mes}
          onChange={(e) => {
            setPagina(1)
            cambiar('mes', e.target.value)
          }}
          options={MESES}
        />
      </FilterBar>

      {!listos && (
        <Card>
          <EmptyState
            title="Complete los filtros"
            description="La rúbrica se arma con colegio, grado, sección, subprograma y mes."
          />
        </Card>
      )}

      {/*
        Un mes futuro o sin días lectivos NO es un error: no hay nada que
        corregir, solo otro mes que elegir. Por eso se pinta como un estado y
        con el texto del contrato, en vez de como un fallo del servidor.
      */}
      {listos && motivoDelMes && (
        <Card>
          <EmptyState title="Este mes no se puede evaluar" description={MOTIVO_RUBRICA[motivoDelMes]} />
        </Card>
      )}

      {listos && error && (
        <Card>
          <EmptyState title="No se pudo cargar la rúbrica" description={mensajeDeError(error)} />
        </Card>
      )}

      {/* Sin alumnos el servidor responde 200 con su `detail`: es un estado
          normal del mes, no una lista que falló al cargar. */}
      {listos && datos?.items.length === 0 && (
        <Card>
          <EmptyState
            icon={BookMarked}
            title="Sin alumnos que evaluar"
            description={datos.detail ?? 'No hay alumnos que corresponda evaluar en este grupo y mes.'}
          />
        </Card>
      )}

      {listos && datos && datos.items.length > 0 && (
        <Card
          padded={false}
          title={`${datos.total} alumno${datos.total === 1 ? '' : 's'}`}
          subtitle={datos.ciclo ? `Ciclo ${datos.ciclo}` : undefined}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-surface-100 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Alumno
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Fluidez
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Comprensión
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">
                    Resultado
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((fila) => (
                  <FilaRubrica
                    key={fila.id_alumno}
                    fila={fila}
                    nombrePrograma={nombrePrograma}
                    soloLectura={soloLectura}
                    rechazo={rechazoDe(fila.id_alumno)}
                    onGuardar={guardarFila}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginado de 40, el del contrato. */}
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
      )}

      <PanelCriterios
        open={verCriterios}
        idPrograma={filtros.idPrograma}
        // El backend exige el ENTERO: `ciclo` ("III") es solo para mostrarlo.
        idCiclo={datos?.id_ciclo ?? null}
        ciclo={datos?.ciclo ?? null}
        nombrePrograma={nombrePrograma}
        onCerrar={() => setVerCriterios(false)}
      />
    </div>
  )
}
