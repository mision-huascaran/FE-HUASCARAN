// Cubre: RF-002, RN-001 · Sección "Usuarios" de la matriz.
//
// D2: el Supervisor crea a TODOS los roles —Docente, Supervisor y Directivo— y
// el Directivo ya no gestiona cuentas. Antes era al revés; se corrigió aquí.
//
// Los campos del popup dependen del rol elegido: una cuenta de Docente lleva
// además sus colegios y secciones, porque esas asignaciones son las que definen
// su alcance. Las de Supervisor y Directivo no tienen alcance que definir.
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import ModalCredencialDocente from '../administracion/ModalCredencialDocente'
import {
  activarUsuario,
  actualizarUsuario,
  crearDocente,
  crearUsuario,
  desactivarUsuario,
  listarAuditoria,
  listarColegiosAdmin,
  listarSecciones,
  listarUsuariosAdmin,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import useConexion from '../../hooks/useConexion'
import { ROLES } from '../../auth/roles'

const ROLES_CREABLES = [
  { value: String(ROLES.DOCENTE), label: 'Docente' },
  { value: String(ROLES.SUPERVISOR), label: 'Supervisor' },
  { value: String(ROLES.DIRECTIVO), label: 'Directivo' },
]

export default function MantenimientoUsuarios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const [filtros, setFiltros] = useState({ estado: 'activo' })
  const [credencial, setCredencial] = useState(null)

  const { data: colegios = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'colegios'],
    queryFn: () => listarColegiosAdmin(),
    staleTime: Infinity,
  })

  // Las secciones de cada colegio, para el desplegable múltiple del Docente.
  const seccionesConsulta = useQuery({
    queryKey: ['admin', 'secciones', 'todas', colegios.map((c) => c.id_colegio).join(',')],
    queryFn: async () => {
      const pares = await Promise.all(
        colegios.map(async (c) => [c.id_colegio, await listarSecciones(c.id_colegio)]),
      )
      return Object.fromEntries(pares)
    },
    enabled: colegios.length > 0,
  })

  const consulta = useQuery({
    queryKey: ['admin', 'usuarios', filtros],
    queryFn: () => listarUsuariosAdmin(filtros),
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) => {
      if (popup.modo === 'editar') return actualizarUsuario(popup.registro.id_usuario, valores)
      // Un Docente necesita además su ficha de docente: va por otro endpoint.
      return Number(valores.id_rol) === ROLES.DOCENTE ? crearDocente(valores) : crearUsuario(valores)
    },
    onSuccess: (creado, { popup }) => {
      refrescar()
      if (popup.modo === 'editar') {
        toast.success('Cuenta actualizada')
        return
      }
      // Si el correo no salió, la contraseña temporal es la única copia.
      if (creado?.correo_enviado === false && creado?.['contraseña_temporal']) {
        setCredencial({ correo: creado.correo, password: creado['contraseña_temporal'] })
      } else {
        toast.success('Cuenta creada', 'Se le enviaron sus credenciales por correo.')
      }
    },
    onError: (error) => toast.error('No se pudo guardar la cuenta', mensajeDeError(error)),
  })

  const estado = useMutation({
    mutationFn: ({ usuario, activo }) =>
      activo ? activarUsuario(usuario.id_usuario) : desactivarUsuario(usuario.id_usuario),
    onSuccess: (_d, { activo }) => {
      refrescar()
      toast.success(activo ? 'Cuenta activada' : 'Cuenta inactivada')
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', mensajeDeError(error)),
  })

  /**
   * Secciones de todos los colegios, etiquetadas con su plantel: sin eso, dos
   * secciones "A" de colegios distintos serían indistinguibles en la lista.
   */
  const seccionesPorColegio = useMemo(
    () =>
      colegios.flatMap((c) =>
        ((seccionesConsulta.data ?? {})[c.id_colegio] ?? []).map((s) => ({
          value: `${c.id_colegio}:${s.id_seccion}`,
          label: `${c.nombre} — ${s.nombre}`,
        })),
      ),
    [colegios, seccionesConsulta.data],
  )

  const campos = useMemo(
    () => [
      { nombre: 'nombres', etiqueta: 'Nombres', requerido: true },
      { nombre: 'apellidos', etiqueta: 'Apellidos', requerido: true },
      {
        nombre: 'correo',
        etiqueta: 'Correo institucional',
        tipo: 'email',
        requerido: true,
        ancho: 'completo',
        validar: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? null : 'Correo no válido'),
      },
      {
        nombre: 'id_rol',
        etiqueta: 'Rol',
        tipo: 'select',
        requerido: true,
        ancho: 'completo',
        opciones: ROLES_CREABLES,
        // El rol no se cambia editando: una cuenta no cambia de parcela.
        soloAlCrear: true,
      },
      {
        nombre: 'colegios',
        etiqueta: 'Colegios asignados',
        tipo: 'multiple',
        ancho: 'completo',
        opciones: colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre })),
        ayuda: 'Solo para cuentas de Docente: definen a qué alumnos accede',
      },
      {
        // Un docente tiene VARIAS secciones por colegio, no una. Las opciones
        // se agrupan por plantel para que se vea de cuál es cada una.
        nombre: 'secciones',
        etiqueta: 'Secciones asignadas',
        tipo: 'multiple',
        ancho: 'completo',
        opciones: seccionesPorColegio,
        ayuda: 'Varias por colegio. Junto con los colegios definen su alcance',
      },
    ],
    [colegios, seccionesPorColegio],
  )

  return (
    <>
      <Mantenimiento
        seccion="usuarios"
        entidad="cuenta"
        titulo="Usuarios"
        consulta={consulta}
        campos={campos}
        guardando={guardado.isPending}
        soloOnline
        sinConexion={!enLinea}
        valoresFiltro={filtros}
        onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
        cargarAuditoria={(id) => listarAuditoria('usuario', id)}
        onGuardar={(valores, popup) => guardado.mutate({ valores, popup })}
        onCambiarEstado={(usuario, activo) => estado.mutate({ usuario, activo })}
        filtros={[
          { nombre: 'rol', etiqueta: 'Rol', opciones: ROLES_CREABLES.map((r) => ({ value: r.label, label: r.label })) },
          { nombre: 'id_colegio', etiqueta: 'Colegio', opciones: colegios.map((c) => ({ value: c.id_colegio, label: c.nombre })) },
        ]}
        columnas={[
          { key: 'nombre', header: 'Usuario', sortable: true, className: 'font-medium text-ink-900' },
          { key: 'correo', header: 'Correo', sortable: true },
          { key: 'rol', header: 'Rol', render: (u) => <Badge tone="info">{u.rol}</Badge> },
        ]}
      />

      <ModalCredencialDocente credencial={credencial} onCerrar={() => setCredencial(null)} />
    </>
  )
}
