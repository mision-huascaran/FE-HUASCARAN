// Programación de clases de un colegio (CU013).
//
// Las clases NO se guardan una a una: el backend las genera cruzando el día
// habitual de cada grado —configurado al crear el colegio— con el calendario
// de CU027, dentro de los PA y saltando los días no lectivos. Por eso esta
// tabla es de solo lectura: lo único que se puede hacer sobre una fila es
// TRASLADARLA, y eso tiene su propio flujo.
//
// UNA CLASE MIXTA APARECE UNA SOLA VEZ. Reúne a los alumnos de Alfabetización
// y de Comprensión Lectora que estén en esa aula, así que el filtro de
// subprograma sirve para ENCONTRARLA, no para partirla: con "Todos" sale una
// vez con los dos nombres en la misma celda, y con cualquiera de los dos
// también sale una vez.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CalendarDays } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import ModalReprogramar from './ModalReprogramar'
import ModalHistorialReprogramacion from './ModalHistorialReprogramacion'
import { ETIQUETA_PROGRAMACION, estaReprogramada, listarClases } from '../../api/resources/clases'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { MESES } from '../../hooks/useFiltrosDeGrupo'
import useFiltrosGuardados from '../../hooks/useFiltrosGuardados'
import useConexion from '../../hooks/useConexion'
import { ahora } from '../../lib/relojServidor'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }
const TODOS = ''

const comoFecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')

/** El primer y el último día del mes, que es el rango que pide el endpoint. */
function rangoDelMes(mes) {
  const anio = ahora().getFullYear()
  const dosDigitos = String(Number(mes)).padStart(2, '0')
  const ultimo = new Date(anio, Number(mes), 0).getDate()
  return { desde: `${anio}-${dosDigitos}-01`, hasta: `${anio}-${dosDigitos}-${ultimo}` }
}

/** Por qué "Reprogramar" está deshabilitado, o `undefined` si no lo está. */
function motivoSinReprogramar(bloqueada, enLinea) {
  if (bloqueada) return 'Esta clase ya tiene asistencias registradas y no puede reprogramarse.'
  return enLinea ? undefined : 'Conéctate a Internet para reprogramar una clase.'
}

export default function ProgramacionDeClases({ colegio }) {
  const enLinea = useConexion()
  const queryClient = useQueryClient()
  const [pagina, setPagina] = useState(1)
  const [reprogramando, setReprogramando] = useState(null)
  const [viendoHistorial, setViendoHistorial] = useState(null)

  const { data: anios = [] } = useQuery({ queryKey: ['anios-escolares'], queryFn: listarAniosEscolares, ...SIEMPRE })
  const idAnioVigente = useMemo(() => anioVigente(anios)?.id ?? '', [anios])

  /**
   * Los filtros se guardan POR USUARIO Y COLEGIO (CU013).
   *
   * Uno solo para todos los colegios haría que al abrir el segundo se vieran
   * los filtros del primero, que casi nunca son los que se quieren.
   */
  const [filtros, setFiltros] = useFiltrosGuardados(`programacion.${colegio?.id_colegio}`, {
    idAnioEscolar: '',
    mes: String(ahora().getMonth() + 1),
    idGrado: TODOS,
    idSeccion: '',
    idPrograma: TODOS,
  })
  const cambiar = useCallback(
    (clave, valor) => setFiltros((previos) => ({ ...previos, [clave]: valor })),
    [setFiltros],
  )

  // El año se propone con el vigente, y solo si no había uno guardado válido.
  useEffect(() => {
    if (!filtros.idAnioEscolar && idAnioVigente) cambiar('idAnioEscolar', String(idAnioVigente))
  }, [filtros.idAnioEscolar, idAnioVigente, cambiar])

  const grados = colegio?.grados ?? []
  const programas = colegio?.programas ?? []

  /**
   * Las secciones del grado elegido; con "Todos los grados", las de todos.
   *
   * CU013: con una sola sección se autocompleta; con varias se permite elegir
   * una o "Todas".
   */
  /**
   * Las secciones son DE UN GRADO, no del colegio (D83).
   *
   * Cada grado tiene su propia "Única", con id distinto. Con "Todos los
   * grados" se ofrecían las seis: seis opciones idénticas en pantalla, y
   * elegir una filtraba por la sección de UN grado sin decir de cuál. Sin
   * grado elegido no hay sección que ofrecer.
   */
  const secciones = useMemo(() => {
    if (!filtros.idGrado) return []
    return grados.find((g) => String(g.id_grado) === String(filtros.idGrado))?.secciones ?? []
  }, [grados, filtros.idGrado])

  useEffect(() => {
    if (secciones.length !== 1) return
    if (String(filtros.idSeccion) === String(secciones[0].id)) return
    cambiar('idSeccion', String(secciones[0].id))
  }, [secciones, filtros.idSeccion, cambiar])

  const { desde, hasta } = rangoDelMes(filtros.mes)

  const consulta = useQuery({
    queryKey: ['clases', colegio?.id_colegio, { ...filtros, pagina }],
    queryFn: () =>
      listarClases({
        idColegio: colegio.id_colegio,
        idGrado: filtros.idGrado || undefined,
        idSeccion: filtros.idSeccion || undefined,
        idPrograma: filtros.idPrograma || undefined,
        desde,
        hasta,
        pagina,
      }),
    enabled: Boolean(colegio?.id_colegio && filtros.mes),
    /**
     * Al cambiar un filtro cambia la clave, y sin esto `data` vuelve a
     * `undefined`: la tabla desaparecía y parpadeaba "Sin clases
     * programadas" antes de pintar las nuevas. Se conservan las filas
     * anteriores mientras llegan las siguientes.
     */
    placeholderData: (previa) => previa,
  })

  // Siempre listas, aunque el servidor mande otra cosa: sin esto un `null`
  // tira la pantalla al error genérico (D48).
  const items = consulta.data?.items ?? []
  const paginas = consulta.data?.total_pages ?? 1

  // Cualquier cambio de filtro vuelve a la página 1 (CU013).
  const cambiarFiltro = (clave) => (e) => {
    setPagina(1)
    cambiar(clave, e.target.value)
  }

  return (
    <div className="flex flex-col gap-5">
      <FilterBar>
        <Select
          label="Año escolar"
          value={filtros.idAnioEscolar}
          onChange={cambiarFiltro('idAnioEscolar')}
          options={anios.map((a) => ({ value: a.id, label: a.nombre }))}
        />
        <Select label="Mes" value={filtros.mes} onChange={cambiarFiltro('mes')} options={MESES} />
        <Select
          label="Grado"
          value={filtros.idGrado}
          placeholder="Todos"
          onChange={cambiarFiltro('idGrado')}
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre ?? `${g.id_grado}.° grado` }))}
        />
        <Select
          label="Sección"
          value={filtros.idSeccion}
          placeholder="Todas"
          onChange={cambiarFiltro('idSeccion')}
          options={secciones.map((s) => ({ value: s.id, label: s.nombre }))}
          disabled={!filtros.idGrado}
          hint={filtros.idGrado ? undefined : 'Elige un grado: cada uno tiene sus propias secciones'}
        />
        <Select
          label="Subprograma"
          value={filtros.idPrograma}
          placeholder="Todos"
          onChange={cambiarFiltro('idPrograma')}
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
      </FilterBar>

      {consulta.isError && (
        <Card>
          <EmptyState title="No se pudo cargar la programación" description={mensajeDeError(consulta.error)} />
        </Card>
      )}

      {/* "Sin clases" solo cuando de verdad no hay ninguna: mientras se
          consulta, decirlo sería afirmar algo que todavía no se sabe. */}
      {!consulta.isError && !consulta.isFetching && items.length === 0 && (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="Sin clases programadas"
            description="No hay clases programadas para los filtros seleccionados."
          />
        </Card>
      )}

      {items.length > 0 && (
        <Card padded={false} title={`${consulta.data?.total ?? items.length} clases`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-surface-100 text-left text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Grado</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Sección</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Subprogramas</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Fecha original</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Fecha vigente</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Programación</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((clase) => {
                  const trasladada = estaReprogramada(clase)
                  const bloqueada = clase.tiene_asistencias
                  return (
                    <tr key={`${clase.id_grado}-${clase.id_seccion}-${clase.fecha_original}`} className="border-t border-line">
                      <td className="px-3 py-2">{clase.grado?.nombre ?? clase.id_grado}</td>
                      <td className="px-3 py-2">{clase.seccion?.nombre ?? '—'}</td>
                      {/*
                        Los dos nombres en la MISMA celda, separados por coma.
                        Una fila por subprograma seria otra clase, y no la hay.
                      */}
                      <td className="px-3 py-2">
                        {(clase.subprogramas ?? []).map((sp) => sp.nombre).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2">{comoFecha(clase.fecha_original)}</td>
                      <td className="px-3 py-2 font-medium text-ink-900">{comoFecha(clase.fecha)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                            trasladada ? 'bg-warning-100 text-warning-600' : 'bg-surface-100 text-ink-500'
                          }`}
                        >
                          {trasladada ? ETIQUETA_PROGRAMACION.reprogramada : ETIQUETA_PROGRAMACION.habitual}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {trasladada ? (
                          <Button size="sm" variant="ghost" onClick={() => setViendoHistorial(clase)}>
                            Ver reprogramación
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={CalendarClock}
                            /*
                             * Una clase con asistencias NO se traslada: el
                             * servidor lo rechaza y el motivo es el del CU.
                             * Sin conexión tampoco, porque reprogramar no es
                             * una operación offline.
                             */
                            disabled={bloqueada || !enLinea}
                            title={motivoSinReprogramar(bloqueada, enLinea)}
                            onClick={() => setReprogramando(clase)}
                          >
                            Reprogramar
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {paginas > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
              <span className="text-ink-500">
                Página {consulta.data?.page ?? pagina} de {paginas}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina >= paginas}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ModalReprogramar
        clase={reprogramando}
        colegio={colegio}
        onCerrar={() => setReprogramando(null)}
        onHecho={() => {
          setReprogramando(null)
          consulta.refetch()
          /**
           * D83 — Y EL HISTORIAL, que se quedó con la versión de antes.
           *
           * "Modificar reprogramación" se abre DESDE el historial, así que al
           * volver a él se veía el traslado anterior y no el que se acababa de
           * hacer: parecía que no se había guardado.
           */
          queryClient.invalidateQueries({ queryKey: ['reprogramaciones'] })
        }}
      />

      <ModalHistorialReprogramacion
        clase={viendoHistorial}
        onCerrar={() => setViendoHistorial(null)}
        onModificar={(clase) => {
          setViendoHistorial(null)
          setReprogramando(clase)
        }}
      />
    </div>
  )
}
