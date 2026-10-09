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
  listarGradosAdmin,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
import useConexion from '../../hooks/useConexion'



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

  const campos = useMemo(
    () => [
      /**
       * Los campos salen de CU013, no de lo que teníamos antes:
       *
       *   · `codigo` modular se quitó: el backend lo rechazó porque no está en
       *     el caso de uso.
       *   · `zona` pasó a `provincia`, y `departamento` y `distrito` son
       *     obligatorios (422 si faltan).
       *   · Las SECCIONES dejaron de ser una lista editable: la sección es un
       *     atributo del colegio, "Única" por defecto, y el alumno la hereda.
       */
      { nombre: 'nombre', etiqueta: 'Nombre del colegio', requerido: true, ancho: 'completo' },
      { nombre: 'departamento', etiqueta: 'Departamento', requerido: true },
      { nombre: 'provincia', etiqueta: 'Provincia' },
      { nombre: 'distrito', etiqueta: 'Distrito', requerido: true },
      { nombre: 'nivel_educativo', etiqueta: 'Nivel educativo', ayuda: 'Por defecto, Primaria' },
      { nombre: 'seccion', etiqueta: 'Sección', ayuda: 'Por defecto, Única. La heredan sus alumnos' },
      {
        nombre: 'grados',
        etiqueta: 'Grados que ofrece',
        tipo: 'multiple',
        ancho: 'completo',
        opciones: grados.map((g) => ({ value: String(g.id_grado), label: g.nombre })),
      },
    ],
    [grados],
  )

  const consulta = useQuery({
    queryKey: ['colegios', 'mantenimiento', filtros],
    queryFn: async () => (await listarColegiosAdmin(filtros)).items,
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['colegios'] })
    queryClient.invalidateQueries({ queryKey: ['catalogo'] })
    queryClient.invalidateQueries({ queryKey: ['admin'] })
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
      onGuardar={(valores, popup) => guardado.mutate({ valores, popup }, { onSuccess: () => {} })}
      onCambiarEstado={(colegio, activo) => estado.mutate({ colegio, activo })}
      columnas={[
        { key: 'nombre', header: 'Colegio', sortable: true, className: 'font-medium text-ink-900' },
        { key: 'nivel_educativo', header: 'Nivel', align: 'center', render: (c) => etiquetaDe(c.nivel_educativo) },
        { key: 'departamento', header: 'Departamento', sortable: true, render: (c) => etiquetaDe(c.departamento) },
        { key: 'distrito', header: 'Distrito', sortable: true, render: (c) => etiquetaDe(c.distrito) },
      ]}
    />
  )
}
