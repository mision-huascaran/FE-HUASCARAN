// Cubre: RF-002, RN-019 · Sección "Alumnos" de la matriz.
//
// Lo usan dos roles con el mismo componente: el Docente, acotado a sus colegios
// y secciones asignadas, y el Supervisor, sobre todos (D1). El recorte real lo
// hace el servidor; aquí solo se evita ofrecer lo que acabaría en 403.
//
// Al crear un alumno el backend crea su expediente en la misma transacción, así
// que aquí no hay una segunda llamada que pudiera quedarse a medias.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
import { useToast } from '../../components/ui/Toast'
import {
  actualizarAlumno,
  crearAlumno,
  listarAlumnosAdmin,
  listarAsignaciones,
  listarAuditoria,
  listarColegiosAdmin,
  listarGradosAdmin,
  listarProgramasAdmin,
  listarSecciones,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import useConexion from '../../hooks/useConexion'
import useSessionStore from '../../store/sessionStore'
import { alcanceDe } from '../../auth/permisos'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

/**
 * El ciclo EBR es un dato SEPARADO del grado (RN-004): un alumno de 6.º puede
 * evaluarse con la rúbrica del ciclo III. Por eso se pide aparte y no se deduce
 * del grado, aunque lo habitual sea que coincidan.
 */
const CICLOS = [
  { value: 1, label: 'III' },
  { value: 2, label: 'IV' },
  { value: 3, label: 'V' },
]

export default function MantenimientoAlumnos() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const soloSusSecciones = alcanceDe('alumnos', idRol) === 'asignado'

  const [filtros, setFiltros] = useState({ estado: 'activo' })

  const { data: colegios = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'colegios'], queryFn: () => listarColegiosAdmin(), ...SIEMPRE })
  const { data: grados = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'grados'], queryFn: listarGradosAdmin, ...SIEMPRE })
  const { data: programas = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'programas'], queryFn: listarProgramasAdmin, ...SIEMPRE })
  const { data: asignaciones = [] } = useQuery({ queryKey: ['admin', 'asignaciones'], queryFn: listarAsignaciones, enabled: soloSusSecciones })
  const { data: secciones = [] } = useQuery({
    queryKey: ['admin', 'secciones', filtros.id_colegio],
    queryFn: () => listarSecciones(filtros.id_colegio),
    enabled: Boolean(filtros.id_colegio),
  })

  // El Docente solo puede elegir entre lo que tiene asignado: fuera de ahí el
  // servidor responde "no pertenece a un colegio y grado que tengas asignado".
  const permitidos = useMemo(() => {
    if (!soloSusSecciones) return { colegios, grados }
    const idsColegio = new Set(asignaciones.map((a) => Number(a.id_colegio)))
    const idsGrado = new Set(asignaciones.map((a) => Number(a.id_grado)))
    return {
      colegios: colegios.filter((c) => idsColegio.has(Number(c.id_colegio))),
      grados: grados.filter((g) => idsGrado.has(Number(g.id_grado))),
    }
  }, [soloSusSecciones, asignaciones, colegios, grados])

  const opciones = (lista, clave) => lista.map((x) => ({ value: x[clave], label: x.nombre }))

  const consulta = useQuery({
    queryKey: ['alumnos', 'mantenimiento', filtros],
    queryFn: async () => (await listarAlumnosAdmin(filtros)).items,
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['alumnos'] })
    queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) =>
      popup.modo === 'nuevo' ? crearAlumno(valores) : actualizarAlumno(popup.registro.id_alumno, valores),
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
    mutationFn: ({ alumno, activo }) => actualizarAlumno(alumno.id_alumno, { activo }),
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
      valoresFiltro={filtros}
      onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
      cargarAuditoria={(id) => listarAuditoria('alumno', id)}
      onGuardar={(valores, popup) => guardado.mutate({ valores, popup })}
      onCambiarEstado={(alumno, activo) => estado.mutate({ alumno, activo })}
      filtros={[
        { nombre: 'q', tipo: 'busqueda', etiqueta: 'Buscar', placeholder: 'Nombre o código' },
        { nombre: 'id_colegio', etiqueta: 'Colegio', opciones: opciones(permitidos.colegios, 'id_colegio') },
        { nombre: 'id_grado', etiqueta: 'Grado', opciones: opciones(permitidos.grados, 'id_grado') },
        { nombre: 'id_seccion', etiqueta: 'Sección', opciones: opciones(secciones, 'id_seccion') },
        { nombre: 'id_ciclo', etiqueta: 'Ciclo', opciones: CICLOS },
        { nombre: 'id_programa', etiqueta: 'Subprograma', opciones: opciones(programas, 'id_programa') },
      ]}
      campos={[
        { nombre: 'nombres', etiqueta: 'Nombres', requerido: true },
        { nombre: 'apellidos', etiqueta: 'Apellidos', requerido: true },
        { nombre: 'id_colegio', etiqueta: 'Colegio', tipo: 'select', requerido: true, opciones: opciones(permitidos.colegios, 'id_colegio') },
        { nombre: 'id_seccion', etiqueta: 'Sección', tipo: 'select', requerido: true, opciones: opciones(secciones, 'id_seccion'), ayuda: 'Un alumno pertenece a una sola sección' },
        { nombre: 'id_grado', etiqueta: 'Grado', tipo: 'select', requerido: true, opciones: opciones(permitidos.grados, 'id_grado') },
        {
          nombre: 'id_ciclo_evaluado',
          etiqueta: 'Ciclo evaluado',
          tipo: 'select',
          requerido: true,
          opciones: CICLOS,
          ayuda: 'Puede no coincidir con el ciclo del grado',
        },
        { nombre: 'id_programa', etiqueta: 'Subprograma', tipo: 'select', requerido: true, opciones: opciones(programas, 'id_programa') },
      ]}
      columnas={[
        { key: 'nombre', header: 'Alumno', sortable: true, className: 'font-medium text-ink-900' },
        { key: 'colegio', header: 'Colegio', sortable: true, render: (a) => a.colegio ?? '—' },
        { key: 'grado', header: 'Grado', align: 'center', render: (a) => a.grado ?? '—' },
        { key: 'seccion', header: 'Sección', align: 'center', render: (a) => a.seccion ?? '—' },
        { key: 'programa', header: 'Subprograma', render: (a) => a.programa ?? '—' },
      ]}
    />
  )
}
