// Los filtros de un GRUPO: colegio, grado, sección, subprograma, año y mes.
//
// Los comparten Seguimiento de Lectura (CU023, que añade la semana) y Rúbrica
// mensual (CU029), porque en los dos la unidad de trabajo es la misma: un
// grupo, un subprograma y un periodo. El subprograma NO es opcional como en
// Asistencia —ahí es un filtro de la vista—: aquí forma parte de la IDENTIDAD
// de lo que se registra, porque Alfabetización y Comprensión Lectora se
// evalúan por separado y con escalas distintas.
//
// DE DÓNDE SALEN, que es lo que hacía fallar la pantalla antes: los colegios
// del Docente vienen de `GET /me/asignaciones` y no del catálogo general —solo
// puede consultar sus aulas, cualquier otra responde 403—, y el grado, la
// sección y el subprograma los dice el COLEGIO (`GET /colegios/{id}`), que es
// la única fuente que los da con id.
//
// Y EL MES VA ANTES QUE LA SEMANA. `GET /semanas` ya no es un catálogo del año:
// devuelve solo las semanas con alguna clase de ESE grupo en ESE mes. Una
// semana sin clase no tiene tabla ni obligación, así que ofrecerla sería mandar
// al docente a una pantalla donde solo podía encontrarse un 422. La Rúbrica no
// pide semana, así que con `conSemana: false` no se pide esa lista.
import { useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { listarMisAsignaciones, obtenerColegio } from '../api/resources/administracion'
import { obtenerSemanas } from '../api/resources/catalogos'
import { obtenerInicioDocente } from '../api/resources/inicio'
import { useColegiosReales } from './useCatalogos'
import useSessionStore from '../store/sessionStore'
import { ahora } from '../lib/relojServidor'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

export const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
].map((nombre, i) => ({ value: i + 1, label: nombre[0].toUpperCase() + nombre.slice(1) }))

/** La semana, dicha como la lee una persona: "Sem. 23 · 15/06 al 19/06". */
export const etiquetaDeSemanaDeGrupo = (s) => {
  const corto = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('/') : '—')
  return `Sem. ${s.numero_semana ?? s.id_semana} · ${corto(s.fecha_inicio)} al ${corto(s.fecha_fin)}`
}

export default function useFiltrosDeGrupo({ esDocente, idAnioEscolar, conSemana = true }) {
  const [params, setParams] = useSearchParams()

  /**
   * Memoizado a propósito: los efectos de abajo lo usan como dependencia y una
   * función nueva en cada render los volvería a disparar sin parar.
   */
  const cambiar = useCallback(
    (clave, valor) => {
      setParams(
        (previos) => {
          const siguientes = new URLSearchParams(previos)
          if (valor == null || valor === '') siguientes.delete(clave)
          else siguientes.set(clave, String(valor))
          return siguientes
        },
        { replace: true },
      )
    },
    [setParams],
  )

  // El Docente ve SUS aulas; quien no es docente, el catálogo de colegios.
  const { data: asignaciones = [] } = useQuery({
    queryKey: ['me', 'asignaciones'],
    queryFn: listarMisAsignaciones,
    enabled: Boolean(esDocente),
    ...SIEMPRE,
  })
  const { data: todos = [] } = useColegiosReales(!esDocente)

  /**
   * LOS PERMISOS DE CORRECCIÓN VIGENTES, que también son aulas suyas (D56).
   *
   * El contrato es explícito: "los grupos a los que solo llega por un permiso
   * NO suman a `asignaciones`". Entonces el aula de un permiso no salía en
   * estos filtros, y el Docente no tenía forma de abrir la pantalla donde
   * usarlo —que es justo lo único para lo que se le dio—.
   *
   * No se cachea para siempre, a diferencia de las asignaciones: un permiso
   * vence a una hora concreta.
   *
   * Misma clave que `useActividad` a propósito: es la misma respuesta y no
   * tiene sentido pedirla dos veces por pantalla.
   */
  const idDocente = useSessionStore((st) => st.usuario?.id_docente)
  const { data: inicio } = useQuery({
    queryKey: ['inicio', 'docente', idDocente],
    queryFn: obtenerInicioDocente,
    enabled: Boolean(esDocente && idDocente),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const permisos = inicio?.permisos_vigentes ?? []

  const colegios = useMemo(() => {
    if (!esDocente) return todos.map((c) => ({ id_colegio: c.id_colegio ?? c.id, nombre: c.nombre }))
    const vistos = new Map()
    asignaciones.forEach((a) => vistos.set(a.id_colegio, { id_colegio: a.id_colegio, nombre: a.colegio }))
    permisos.forEach((p) => {
      const id = p.colegio?.id ?? p.id_colegio
      if (id == null || vistos.has(id)) return
      // Se marca de dónde viene: la pantalla ya explica el permiso con
      // `escritura.aviso_permiso`, y aquí sirve para no confundirlo con una
      // asignación si algún día hay que distinguirlos en el desplegable.
      vistos.set(id, { id_colegio: id, nombre: p.colegio?.nombre ?? `Colegio ${id}`, soloPorPermiso: true })
    })
    return [...vistos.values()]
  }, [esDocente, asignaciones, permisos, todos])

  const idColegio = params.get('colegio') || ''
  const idGrado = params.get('grado') || ''
  const idSeccion = params.get('seccion') || ''
  const idPrograma = params.get('subprograma') || ''
  const mes = params.get('mes') || String(ahora().getMonth() + 1)
  const idSemana = params.get('semana') || ''

  // El detalle del colegio es lo único que trae grados, secciones y
  // subprogramas CON ID: `/me/asignaciones` los manda por texto.
  const { data: colegio } = useQuery({
    queryKey: ['colegio', idColegio],
    queryFn: () => obtenerColegio(idColegio),
    enabled: Boolean(idColegio),
    ...SIEMPRE,
  })

  const asignacion = useMemo(
    () => asignaciones.find((a) => String(a.id_colegio) === String(idColegio)) ?? null,
    [asignaciones, idColegio],
  )

  const grados = useMemo(() => {
    const delColegio = colegio?.grados ?? []
    if (!esDocente) return delColegio

    const suyos = new Set((asignacion?.grados ?? []).map((g) => String(g.id_grado)))
    // Y los grados de sus permisos vigentes EN ESTE colegio (D56).
    permisos
      .filter((p) => String(p.colegio?.id ?? p.id_colegio ?? '') === String(idColegio))
      .forEach((p) => {
        const id = p.grado?.id ?? p.id_grado
        if (id != null) suyos.add(String(id))
      })

    if (!suyos.size) return delColegio
    const cruce = delColegio.filter((g) => suyos.has(String(g.id_grado)))
    return cruce.length ? cruce : delColegio
  }, [colegio, esDocente, asignacion, permisos, idColegio])

  const secciones = useMemo(
    () => grados.find((g) => String(g.id_grado) === String(idGrado))?.secciones ?? [],
    [grados, idGrado],
  )

  /**
   * El subprograma se acota al GRADO, no solo al colegio.
   *
   * Un docente con 3.º de Alfabetización y 4.º de Comprensión Lectora podía
   * elegir 3.º + Comprensión Lectora, que no es ninguna de sus aulas, y el
   * servidor le respondía 403 con razón.
   */
  const programas = useMemo(() => {
    const delColegio = colegio?.programas ?? []
    if (!esDocente || !asignacion) return delColegio
    const grado = (asignacion.detalle_grados ?? []).find((g) => String(g.id_grado) === String(idGrado))
    const suyos = new Set(grado?.subprogramas ?? [])
    if (!suyos.size) return delColegio
    const cruce = delColegio.filter((p) => suyos.has(p.nombre))
    return cruce.length ? cruce : delColegio
  }, [colegio, esDocente, asignacion, idGrado])

  /**
   * Las semanas DEL GRUPO Y DEL MES. Hacen falta los cinco datos: sin uno solo
   * la petición responde 422, así que ni se lanza.
   */
  const semanasListas = conSemana && Boolean(idAnioEscolar && mes && idColegio && idGrado && idSeccion)
  const { data: semanas = [] } = useQuery({
    queryKey: ['semanas', { idAnioEscolar, mes, idColegio, idGrado, idSeccion }],
    queryFn: () => obtenerSemanas({ idAnioEscolar, mes, idColegio, idGrado, idSeccion }),
    enabled: semanasListas,
  })

  // Un `<select>` sin valor PINTA su primera opción: hay que elegirla de
  // verdad, o la pantalla aparenta un colegio que el filtro no tiene.
  useEffect(() => {
    if (!idColegio && colegios.length) cambiar('colegio', String(colegios[0].id_colegio))
  }, [colegios, idColegio, cambiar])

  useEffect(() => {
    if (!grados.length) return
    if (grados.some((g) => String(g.id_grado) === String(idGrado))) return
    cambiar('grado', String(grados[0].id_grado))
  }, [grados, idGrado, cambiar])

  /**
   * Con UNA sección se elige sola; con varias se deja vacía a propósito.
   *
   * CU023 lo dice: adivinar el aula haría registrar la lectura de la clase
   * equivocada, y son clases distintas.
   */
  useEffect(() => {
    if (!secciones.length) return
    if (secciones.some((s) => String(s.id) === String(idSeccion))) return
    cambiar('seccion', secciones.length === 1 ? String(secciones[0].id) : '')
  }, [secciones, idSeccion, cambiar])

  // El subprograma SÍ se propone: sin él no hay tabla, así que dejarlo vacío
  // sería dejar la pantalla parada pidiendo un dato que casi siempre es uno.
  useEffect(() => {
    if (!programas.length) return
    if (programas.some((p) => String(p.id_programa) === String(idPrograma))) return
    cambiar('subprograma', String(programas[0].id_programa))
  }, [programas, idPrograma, cambiar])

  // La semana por defecto es la ÚLTIMA del mes con clases: es la que el
  // docente viene a registrar.
  useEffect(() => {
    if (!semanas.length) return
    if (semanas.some((s) => String(s.id_semana) === String(idSemana))) return
    cambiar('semana', String(semanas.at(-1).id_semana))
  }, [semanas, idSemana, cambiar])

  return {
    colegios,
    grados,
    secciones,
    programas,
    semanas,
    filtros: { idColegio, idGrado, idSeccion, idPrograma, mes, idSemana, idAnioEscolar },
    cambiar,
  }
}
