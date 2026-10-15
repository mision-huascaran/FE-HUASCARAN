// Cubre: RF-002, RN-001 · Sección "Colegios" de la matriz de permisos.
//
// Exclusivo del Supervisor. Inactivar NO borra alumnos ni registros: cambia el
// estado y deja auditoría (D5 — se descarta "Eliminar" de todas las secciones).
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
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
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
import useConexion from '../../hooks/useConexion'
import GradosConDiaDeClase from './GradosConDiaDeClase'
import { comoGradosConDia, sinDiaDeClase } from '../../lib/gradosColegio'



export default function MantenimientoColegios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const [filtros, setFiltros] = useState({ estado: 'activo' })

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
      { nombre: 'seccion', etiqueta: 'Sección', ayuda: 'Por defecto, Única. La heredan sus alumnos' },
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

  return (
    <Mantenimiento
      seccion="colegios"
      entidad="colegio"
      titulo="Colegios"
      consulta={consulta}
      campos={campos}
      valoresFiltro={filtros}
      onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
      guardando={guardado.isPending}
      soloOnline
      sinConexion={!enLinea}
      cargarAuditoria={(id) => listarAuditoria('colegio', id)}
      // El listado no trae grados ni programas: se piden al abrir el popup.
      // `obtenerColegio` da los programas como objetos; el multi-select usa ids en string.
      cargarDetalle={async (id) => {
        const c = await obtenerColegio(id)
        return c && { ...c, programas: (c.programas ?? []).map((p) => String(p.id_programa)) }
      }}
      onGuardar={(valores, popup) => guardado.mutateAsync({ valores, popup })}
      onCambiarEstado={(colegio, activo) => estado.mutate({ colegio, activo })}
      filtros={[{ nombre: 'q', etiqueta: 'Buscar', tipo: 'busqueda', placeholder: 'Nombre del colegio' }]}
      columnas={[
        { key: 'nombre', header: 'Colegio', sortable: true, className: 'font-medium text-ink-900' },
        { key: 'nivel_educativo', header: 'Nivel', align: 'center', render: (c) => etiquetaDe(c.nivel_educativo) },
        { key: 'departamento', header: 'Departamento', sortable: true, render: (c) => etiquetaDe(c.departamento) },
        { key: 'distrito', header: 'Distrito', sortable: true, render: (c) => etiquetaDe(c.distrito) },
      ]}
    />
  )
}
