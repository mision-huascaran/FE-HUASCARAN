// Cubre: RF-002, RN-001 · Sección "Colegios" de la matriz de permisos.
//
// Exclusivo del Supervisor. Inactivar NO borra alumnos ni registros: cambia el
// estado y deja auditoría (D5 — se descarta "Eliminar" de todas las secciones).
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
import CampoSecciones from './CampoSecciones'
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
      { nombre: 'nombre', etiqueta: 'Nombre del colegio', requerido: true, ancho: 'completo' },
      { nombre: 'codigo', etiqueta: 'Código modular', ayuda: 'Código oficial del plantel' },
      { nombre: 'zona', etiqueta: 'Ubicación', requerido: true },
      {
        nombre: 'secciones',
        etiqueta: 'Grados y secciones',
        componente: CampoSecciones,
        grados: grados.map((g) => ({ value: g.id_grado, label: g.nombre })),
      },
    ],
    [grados],
  )

  const consulta = useQuery({
    queryKey: ['colegios', 'mantenimiento', filtros],
    queryFn: () => listarColegiosAdmin(filtros),
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
        { key: 'codigo', header: 'Código', align: 'center', render: (c) => c.codigo ?? '—' },
        { key: 'zona', header: 'Ubicación', sortable: true },
      ]}
    />
  )
}
