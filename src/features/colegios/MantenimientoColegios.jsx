// Cubre: RF-002, RN-001 · Sección "Colegios" de la matriz de permisos.
//
// Exclusivo del Supervisor. Inactivar NO borra alumnos ni registros: cambia el
// estado y deja auditoría (D5 — se descarta "Eliminar" de todas las secciones).
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Eye } from 'lucide-react'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import {
  actualizarColegio,
  cambiarEstadoColegio,
  crearColegio,
  listarAuditoria,
  listarColegiosAdmin,
  obtenerColegio,
  listarGradosAdmin,
  listarProgramasAdmin,
  listarUbicaciones,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
import useConexion from '../../hooks/useConexion'
import CalendarioAcademico from './CalendarioAcademico'
import DetalleColegio from './DetalleColegio'
import GradosConDiaDeClase from './GradosConDiaDeClase'
import { comoGradosConDia, sinDiaDeClase } from '../../lib/gradosColegio'



/** El texto de ayuda del ojo, tal como lo nombra CU013. */
const VER_DETALLE = 'Ver detalle'

export default function MantenimientoColegios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const [filtros, setFiltros] = useState({ estado: 'activo' })
  // El calendario académico se ve en vez del listado, sin cambiar de ruta.
  const [verCalendario, setVerCalendario] = useState(false)
  /**
   * El colegio cuyo detalle se está viendo, o `null` en el listado.
   *
   * Vive aquí y no en la URL a propósito (CU013): al volver, el listado
   * conserva sus filtros y su página porque nunca llegó a desmontarse.
   */
  const [colegioAbierto, setColegioAbierto] = useState(null)

  // Las opciones de los filtros de ubicación salen del catálogo, no de los
  // colegios cargados: así se puede filtrar por un distrito que no esté en la
  // página actual.
  const { data: ubicaciones } = useQuery({
    queryKey: ['colegios', 'ubicaciones'],
    queryFn: listarUbicaciones,
    staleTime: Infinity,
  })

  const { data: grados = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'grados'],
    queryFn: listarGradosAdmin,
    staleTime: Infinity,
  })

  const { data: programas = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'programas'],
    queryFn: listarProgramasAdmin,
    staleTime: Infinity,
  })

  const campos = useMemo(
    () => [
      /**
       * Los campos salen de CU013, no de lo que teníamos antes:
       *
       *   · `codigo` modular se quitó: el backend lo rechazó porque no está en
       *     el caso de uso.
       *   · `zona` pasó a `provincia`. Y OJO, que se invirtió: la PROVINCIA
       *     es obligatoria (422 si falta o si llega `null` en el PATCH) y el
       *     DISTRITO pasó a opcional. Los colegios que no tenían provincia
       *     quedaron con "Por definir".
       *   · Las SECCIONES dejaron de ser una lista editable: la sección es un
       *     atributo del colegio, "Única" por defecto, y el alumno la hereda.
       */
      { nombre: 'nombre', etiqueta: 'Nombre del colegio', requerido: true, ancho: 'completo' },
      { nombre: 'departamento', etiqueta: 'Departamento', requerido: true },
      { nombre: 'provincia', etiqueta: 'Provincia', requerido: true },
      { nombre: 'distrito', etiqueta: 'Distrito' },
      { nombre: 'nivel_educativo', etiqueta: 'Nivel educativo', soloLectura: true, porDefecto: 'Primaria' },
      {
        nombre: 'programas',
        etiqueta: 'Subprogramas',
        tipo: 'multiple',
        requerido: true,
        ancho: 'completo',
        columnas: 2,
        opciones: programas.map((p) => ({ value: String(p.id_programa), label: p.nombre })),
      },
      {
        nombre: 'grados',
        etiqueta: 'Grados que ofrece',
        requerido: true,
        ancho: 'completo',
        // Cada grado lleva ahora su día de clase, obligatorio (CU013).
        componente: GradosConDiaDeClase,
        opciones: grados.map((g) => ({ value: String(g.id_grado), label: g.nombre })),
        validar: (valor) => {
          const elegidos = comoGradosConDia(valor)
          if (!elegidos.length) return 'Elija al menos un grado'
          const faltan = sinDiaDeClase(valor)
          if (!faltan.length) return null
          // Les pasa a los colegios creados antes de que existiera el campo:
          // llegan con `dia_clase: null` y hay que decidirlo al editarlos.
          return 'Falta el día de clase de algún grado'
        },
      },
    ],
    [grados, programas],
  )

  const consulta = useQuery({
    queryKey: ['colegios', 'mantenimiento', filtros],
    queryFn: async () => (await listarColegiosAdmin(filtros)).items,
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['colegios'] })
    queryClient.invalidateQueries({ queryKey: ['catalogo'] })
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    // El popup cachea el detalle y la auditoría: sin esto, "Ver"/"Editar"
    // mostraban los grados y días anteriores hasta recargar.
    queryClient.invalidateQueries({ queryKey: ['detalle', 'colegios'] })
    queryClient.invalidateQueries({ queryKey: ['auditoria', 'colegios'] })
  }

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) =>
      popup.modo === 'nuevo'
        ? crearColegio(valores)
        : actualizarColegio(popup.registro.id_colegio, valores),
    onSuccess: (_d, { popup }) => {
      refrescar()
      toast.success(popup.modo === 'nuevo' ? 'Colegio registrado' : 'Colegio actualizado')
    },
    onError: (error) => toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  const estado = useMutation({
    mutationFn: ({ colegio, activo }) => cambiarEstadoColegio(colegio.id_colegio, activo),
    onSuccess: (_d, { activo }) => {
      refrescar()
      toast.success(activo ? 'Colegio activado' : 'Colegio inactivado', 'No se borró ningún alumno ni registro.')
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', mensajeDeError(error)),
  })

  /**
   * El calendario reemplaza el listado en el area principal, sin navegar: así
   * "Volver a Colegios" devuelve con los filtros y la página intactos, que es
   * lo que pide CU027.
   */
  if (verCalendario) {
    return <CalendarioAcademico colegios={consulta.data ?? []} onVolver={() => setVerCalendario(false)} />
  }

  // Lo mismo con el detalle del colegio: vista interna, no ruta aparte.
  if (colegioAbierto) {
    return <DetalleColegio colegio={colegioAbierto} onVolver={() => setColegioAbierto(null)} />
  }

  return (
    <Mantenimiento
      seccion="colegios"
      accionesExtra={
        <Button variant="outline" iconLeft={CalendarDays} onClick={() => setVerCalendario(true)}>
          Calendario académico
        </Button>
      }
      entidad="colegio"
      titulo="Colegios"
      consulta={consulta}
      campos={campos}
      valoresFiltro={filtros}
      onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
      guardando={guardado.isPending}
      // D61 y D70 — Sin conexión se CONSULTA la última copia (CU013, CU027):
      // antes la pantalla entera se cambiaba por "Requiere conexión", un
      // modal abierto se cerraba con lo escrito y el calendario no se podía
      // abrir. Escribir sigue exigiendo conexión.
      sinConexion={!enLinea}
      cargarAuditoria={(id) => listarAuditoria('colegio', id)}
      // El listado no trae grados ni programas: se piden al abrir el popup.
      // `obtenerColegio` da los programas como objetos; el multi-select usa ids en string.
      cargarDetalle={async (id) => {
        const c = await obtenerColegio(id)
        return c && { ...c, programas: (c.programas ?? []).map((p) => String(p.id_programa)) }
      }}
      /*
       * D50 — "Ver detalle" (el ojo) abre la vista interna del colegio con su
       * Programación de clases. CU013 fija el orden de los controles de fila:
       * Ver detalle, Editar, Estado.
       */
      verDetalle={{ abrir: setColegioAbierto, icono: Eye, etiqueta: VER_DETALLE }}
      onGuardar={(valores, popup) => guardado.mutateAsync({ valores, popup })}
      onCambiarEstado={(colegio, activo) => estado.mutate({ colegio, activo })}
      /*
       * D60 — Faltaban los dos filtros de ubicación, que la API ya aceptaba.
       * Sus opciones salen de `GET /colegios/ubicaciones`, no de los colegios
       * cargados: así se puede filtrar por un distrito que no esté en la
       * página actual.
       */
      filtros={[
        { nombre: 'q', etiqueta: 'Buscar', tipo: 'busqueda', placeholder: 'Nombre del colegio' },
        {
          nombre: 'departamento',
          etiqueta: 'Departamento',
          tipo: 'select',
          placeholder: 'Todos',
          opciones: (ubicaciones?.departamentos ?? []).map((d) => ({ value: d, label: d })),
        },
        {
          nombre: 'distrito',
          etiqueta: 'Distrito',
          tipo: 'select',
          placeholder: 'Todos',
          opciones: (ubicaciones?.distritos ?? []).map((d) => ({ value: d, label: d })),
        },
      ]}
      columnas={[
        { key: 'nombre', header: 'Colegio', sortable: true, className: 'font-medium text-ink-900' },
        { key: 'nivel_educativo', header: 'Nivel', align: 'center', render: (c) => etiquetaDe(c.nivel_educativo) },
        { key: 'departamento', header: 'Departamento', sortable: true, render: (c) => etiquetaDe(c.departamento) },
        // D60 — Faltaba, y CU013 la pide entre Departamento y Distrito.
        { key: 'provincia', header: 'Provincia', sortable: true, render: (c) => etiquetaDe(c.provincia) },
        { key: 'distrito', header: 'Distrito', sortable: true, render: (c) => etiquetaDe(c.distrito) },
      ]}
    />
  )
}
