import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { obtenerAsignaciones } from '../../api/resources/docentes'
import { useColegios, useSemanas } from '../../hooks/useCatalogos'
import usePrecarga from '../../hooks/usePrecarga'
import useFiltrosStore from '../../store/filtrosStore'
import useSessionStore from '../../store/sessionStore'

/**
 * Filtros de la pantalla de captura: colegio, ciclo, grado, sección y semana,
 * en ese orden (T32). Cada uno acota al siguiente, así el docente no ve
 * opciones que no le corresponden.
 *
 * Viven en la URL para que el botón "Registrar" del panel del docente (P3) abra
 * la grilla ya filtrada y para que una pantalla se pueda compartir tal cual.
 * Por defecto: la semana en curso y la primera asignación del docente.
 */
export default function useFiltrosSemanales() {
  const [params, setParams] = useSearchParams()
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  // Lo descargado al iniciar la actividad. Es el respaldo cuando no hay red:
  // sin esto, entrar en la grilla sin conexión dejaba los filtros vacíos.
  const precarga = usePrecarga()

  const { data: semanasEnLinea = [] } = useSemanas()
  const semanas = semanasEnLinea.length ? semanasEnLinea : (precarga?.semanas ?? [])

  const { data: asignacionesEnLinea = [] } = useQuery({
    queryKey: ['asignaciones', idDocente, idPeriodo],
    queryFn: () => obtenerAsignaciones(idDocente, idPeriodo),
    enabled: Boolean(idDocente && idPeriodo),
  })

  const asignaciones = useMemo(
    () => (asignacionesEnLinea.length ? asignacionesEnLinea : (precarga?.asignaciones ?? [])),
    [asignacionesEnLinea, precarga],
  )

  /**
   * De dónde salen los colegios depende de quién mira.
   *
   * El Docente ve los suyos, los de sus asignaciones. El Supervisor no tiene
   * asignaciones —su `id_docente` es null—, pero T22 le da las grillas de TODOS
   * los docentes: si se dedujeran de sus asignaciones, el desplegable le saldría
   * vacío y no podría abrir ninguna grilla.
   */
  const { data: todosLosColegios = [] } = useColegios()

  const colegios = useMemo(() => {
    if (!idDocente) return todosLosColegios.length ? todosLosColegios : (precarga?.colegios ?? [])
    const vistos = new Map()
    asignaciones.forEach((a) => vistos.set(a.id_colegio, { id_colegio: a.id_colegio, nombre: a.colegio }))
    return [...vistos.values()]
  }, [idDocente, asignaciones, todosLosColegios, precarga])

  const grados = asignaciones[0]?.grados ?? [1, 2, 3, 4, 5, 6]

  const idSemana = Number(params.get('semana')) || semanas.at(-1)?.id_semana || null
  const idColegio = Number(params.get('colegio')) || colegios[0]?.id_colegio || null
  const idGrado = Number(params.get('grado')) || grados[0] || null
  // T32 añade ciclo y sección al orden de filtros. El ciclo acota los grados;
  // la sección pertenece al colegio, así que se pide cuando hay uno elegido.
  const idCiclo = Number(params.get('ciclo')) || null
  const idSeccion = Number(params.get('seccion')) || null
  // T22: solo lo usa el Supervisor, para mirar las grillas de un docente.
  const idDocenteFiltro = Number(params.get('docente')) || null

  /**
   * La SECCIÓN dejó de ser una entidad: es un atributo del colegio
   * (`colegio.seccion`, "Única" por defecto) y el alumno la hereda. Se deja la
   * lista vacía para no romper el filtro mientras las grillas siguen en el
   * simulador; cuando el backend las publique, la sección saldrá del colegio.
   */
  const secciones = []
  const pestana = params.get('vista') === 'rubrica' ? 'rubrica' : 'semanal'

  const cambiar = (clave, valor) => {
    const siguientes = new URLSearchParams(params)
    if (valor == null || valor === '') siguientes.delete(clave)
    else siguientes.set(clave, String(valor))
    setParams(siguientes, { replace: true })
  }

  return {
    semanas,
    colegios,
    grados,
    secciones,
    idSemana,
    idColegio,
    idGrado,
    idCiclo,
    idSeccion,
    idDocenteFiltro,
    pestana,
    // §5: el Docente solo edita los colegios que tiene asignados. Para quien no
    // es docente esto no aplica: su permiso lo decide la matriz, no la asignación.
    puedeEditar: !idDocente || colegios.some((c) => c.id_colegio === idColegio),
    cargandoAsignaciones: Boolean(idDocente && idPeriodo) && asignaciones.length === 0,
    cambiar,
  }
}
