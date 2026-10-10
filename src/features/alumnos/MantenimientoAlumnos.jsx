// Cubre: RF-002, RN-019 · Sección "Alumnos" de la matriz.
//
// Lo usan dos roles con el mismo componente: el Docente, acotado a sus colegios
// y secciones asignadas, y el Supervisor, sobre todos (D1). El recorte real lo
// hace el servidor; aquí solo se evita ofrecer lo que acabaría en 403.
//
// Al crear un alumno el backend crea su expediente en la misma transacción, así
// que aquí no hay una segunda llamada que pudiera quedarse a medias.
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
import { useToast } from '../../components/ui/Toast'
import {
  actualizarAlumno,
  cambiarEstadoAlumno,
  crearAlumno,
  filtrarAlumnos,
  listarAlumnosAdmin,
  listarAsignaciones,
  listarAuditoria,
  listarColegiosAdmin,
  listarGradosAdmin,
  listarProgramasAdmin,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
import useConexion from '../../hooks/useConexion'
import useFiltrosGuardados from '../../hooks/useFiltrosGuardados'
import usePrecarga from '../../hooks/usePrecarga'
import useSessionStore from '../../store/sessionStore'
import { alcanceDe } from '../../auth/permisos'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

/**
 * El ciclo y la sección YA NO SE PIDEN.
 *
 * El backend calcula el ciclo a partir del subprograma y el grado
 * (Alfabetización siempre III; Comprensión Lectora: 2.º III, 3.º y 4.º IV,
 * 5.º y 6.º V), y la sección la hereda el alumno de su colegio. Enviarlos
 * sería inventar datos que el servidor va a ignorar o rechazar.
 *
 * Nota histórica: el ciclo EBR se pedía aparte del grado (RN-004) y no se deducía
 * del grado, aunque lo habitual sea que coincidan.
 */
const CICLOS = [
  { value: 1, label: 'III' },
  { value: 2, label: 'IV' },
  { value: 3, label: 'V' },
]

/**
 * El identificador del alumno, venga como venga.
 *
 * El simulador lo llama `id_alumno` y el backend `id`. Leer solo el primero
 * mandaba `PATCH /alumnos/undefined`, que el servidor rechazaba con un 422 y
 * el mensaje "Los datos enviados no son válidos": imposible de relacionar con
 * la causa desde la pantalla.
 */
const idDeAlumno = (alumno) => alumno?.id_alumno ?? alumno?.id

export default function MantenimientoAlumnos() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const soloSusSecciones = alcanceDe('alumnos', idRol) === 'asignado'

  // CU014: los filtros se guardan en LocalStorage y se borran al cerrar sesión.
  const [filtros, setFiltros] = useFiltrosGuardados('alumnos', { estado: 'activo' })
  // Copia de IndexedDB: sin conexión, la tabla se lee de aquí en solo lectura.
  const precarga = usePrecarga()

  const { data: colegiosEnLinea = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'colegios'], queryFn: async () => (await listarColegiosAdmin()).items, ...SIEMPRE, enabled: enLinea })
  const { data: gradosEnLinea = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'grados'], queryFn: listarGradosAdmin, ...SIEMPRE, enabled: enLinea })
  const { data: programas = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'programas'], queryFn: listarProgramasAdmin, ...SIEMPRE, enabled: enLinea })
  const { data: asignacionesEnLinea, isSuccess: asignacionesCargadas } = useQuery({
    queryKey: ['admin', 'asignaciones'],
    queryFn: listarAsignaciones,
    enabled: soloSusSecciones && enLinea,
  })
  const colegios = useMemo(
    () => (colegiosEnLinea.length ? colegiosEnLinea : (precarga?.colegios ?? [])),
    [colegiosEnLinea, precarga],
  )
  const grados = useMemo(
    () => (gradosEnLinea.length ? gradosEnLinea : (precarga?.grados ?? [])),
    [gradosEnLinea, precarga],
  )
  const asignaciones = useMemo(
    () => asignacionesEnLinea ?? precarga?.asignaciones ?? [],
    [asignacionesEnLinea, precarga],
  )

  /**
   * El Docente solo puede elegir entre lo que tiene asignado: fuera de ahí el
   * servidor responde "no pertenece a un colegio y grado que tengas asignado".
   *
   * `GET /me/asignaciones` las agrupa por colegio y con los grados como
   * objetos, pero `normalizarAsignacion` ya deja la forma plana que se usa
   * aquí: `id_colegio` numérico y `grados` como lista de ids. Hay que leerla
   * así y no del objeto original — `colegio` ya es el NOMBRE, no el id.
   */
  const permitidos = useMemo(() => {
    if (!soloSusSecciones) return { colegios, grados }

    const idsColegio = new Set(asignaciones.map((a) => Number(a.id_colegio)))
    const idsGrado = new Set(asignaciones.flatMap((a) => (a.grados ?? []).map(Number)))

    return {
      colegios: colegios.filter((c) => idsColegio.has(Number(c.id_colegio))),
      grados: grados.filter((g) => idsGrado.has(Number(g.id_grado))),
    }
  }, [soloSusSecciones, asignaciones, colegios, grados])

  const opciones = (lista, clave) => lista.map((x) => ({ value: x[clave], label: x.nombre }))

  const consulta = useQuery({
    queryKey: ['alumnos', 'mantenimiento', filtros, enLinea, Boolean(precarga)],
    queryFn: async () => {
      // CU014 sin conexión: la tabla en solo lectura desde IndexedDB. Antes se
      // pedía igual al servidor, fallaba, y la tabla quedaba en "Sin registros"
      // aunque los alumnos estuvieran descargados.
      if (!enLinea) return filtrarAlumnos(precarga?.alumnos ?? [], filtros)
      return (await listarAlumnosAdmin(filtros)).items
    },
  })

  const sinAsignaciones = soloSusSecciones && enLinea && asignacionesCargadas && asignaciones.length === 0

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['alumnos'] })
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) =>
      popup.modo === 'nuevo' ? crearAlumno(valores) : actualizarAlumno(idDeAlumno(popup.registro), valores),
    onSuccess: (_d, { popup }) => {
      refrescar()
      toast.success(
        popup.modo === 'nuevo' ? 'Alumno registrado' : 'Alumno actualizado',
        popup.modo === 'nuevo' ? 'Se creó su expediente automáticamente.' : undefined,
      )
    },
    onError: (error) => toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  const estado = useMutation({
    // La baja lógica tiene ruta propia (`/desactivar`, `/activar`), como en
    // Colegios: un PATCH con `{activo}` no cambia el estado.
    mutationFn: ({ alumno, activo }) => cambiarEstadoAlumno(idDeAlumno(alumno), activo),
    onSuccess: (_d, { activo }) => {
      refrescar()
      toast.success(activo ? 'Alumno activado' : 'Alumno inactivado', 'Su historial académico se conserva.')
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', mensajeDeError(error)),
  })

  return (
    <Mantenimiento
      seccion="alumnos"
      entidad="alumno"
      titulo="Alumnos"
      consulta={consulta}
      guardando={guardado.isPending}
      // D8: la LISTA se lee de la caché sin conexión; lo que exige red es crear
      // y editar, para no generar ids en conflicto. Por eso no va `soloOnline`.
      sinConexion={!enLinea}
      motivoSinNuevo={sinAsignaciones ? 'No tiene asignaciones activas: no hay colegio ni grado en los que registrar alumnos.' : null}
      valoresFiltro={filtros}
      onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
      cargarAuditoria={(id) => listarAuditoria('alumno', id)}
      onGuardar={(valores, popup) => guardado.mutate({ valores, popup })}
      onCambiarEstado={(alumno, activo) => estado.mutate({ alumno, activo })}
      filtros={[
        { nombre: 'q', tipo: 'busqueda', etiqueta: 'Buscar', placeholder: 'Nombre o código' },
        { nombre: 'id_colegio', etiqueta: 'Colegio', opciones: opciones(permitidos.colegios, 'id_colegio') },
        { nombre: 'id_grado', etiqueta: 'Grado', opciones: opciones(permitidos.grados, 'id_grado') },
        { nombre: 'id_ciclo', etiqueta: 'Ciclo', opciones: CICLOS },
        { nombre: 'id_programa', etiqueta: 'Subprograma', opciones: opciones(programas, 'id_programa') },
      ]}
      campos={[
        { nombre: 'nombres', etiqueta: 'Nombres', requerido: true },
        { nombre: 'apellidos', etiqueta: 'Apellidos', requerido: true },
        { nombre: 'id_colegio', etiqueta: 'Colegio', tipo: 'select', requerido: true, opciones: opciones(permitidos.colegios, 'id_colegio') },
        { nombre: 'id_grado', etiqueta: 'Grado', tipo: 'select', requerido: true, opciones: opciones(permitidos.grados, 'id_grado') },
        {
          nombre: 'seccion',
          etiqueta: 'Sección',
          soloLectura: true,
          ayuda: 'La hereda del colegio: no se elige',
        },
        {
          nombre: 'ciclo',
          etiqueta: 'Ciclo',
          soloLectura: true,
          ayuda: 'Lo calcula el sistema según el subprograma y el grado',
        },
        { nombre: 'id_programa', etiqueta: 'Subprograma', tipo: 'select', requerido: true, opciones: opciones(programas, 'id_programa') },
      ]}
      columnas={[
        { key: 'nombre', header: 'Alumno', sortable: true, className: 'font-medium text-ink-900' },
        // `etiquetaDe` porque estos campos llegan como texto desde el
        // simulador y como objeto {id, nombre} desde el backend: pintar el
        // objeto tal cual deja la pantalla en blanco.
        { key: 'colegio', header: 'Colegio', sortable: true, render: (a) => etiquetaDe(a.colegio) },
        { key: 'grado', header: 'Grado', align: 'center', render: (a) => etiquetaDe(a.grado) },
        { key: 'seccion', header: 'Sección', align: 'center', render: (a) => etiquetaDe(a.seccion) },
        { key: 'programa', header: 'Subprograma', render: (a) => etiquetaDe(a.programa ?? a.subprograma) },
      ]}
    />
  )
}
