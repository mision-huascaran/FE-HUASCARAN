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
  crearUsuario,
  desactivarUsuario,
  listarAuditoria,
  listarColegiosAdmin,
  listarGradosAdmin,
  listarUsuariosAdmin,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
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
    queryFn: async () => (await listarColegiosAdmin()).items,
    staleTime: Infinity,
  })

  const { data: grados = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'grados'],
    queryFn: listarGradosAdmin,
    staleTime: Infinity,
  })

  const consulta = useQuery({
    queryKey: ['admin', 'usuarios', filtros],
    queryFn: async () => (await listarUsuariosAdmin(filtros)).items,
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) => {
      if (popup.modo === 'editar') return actualizarUsuario(popup.registro.id_usuario, valores)
      // Un solo POST para los tres roles: con id_rol de Docente, el backend
      // crea usuario, docente y asignaciones en la misma transacción.
      return crearUsuario(valores)
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

  const campos = useMemo(
    () => [
      { nombre: 'nombres', etiqueta: 'Nombres', requerido: true },
      { nombre: 'apellidos', etiqueta: 'Apellidos', requerido: true },
      // CU016: obligatorio, 8 dígitos y único (409 si se repite). Faltaba en
      // el formulario y el alta respondía 422.
      {
        nombre: 'dni',
        etiqueta: 'DNI',
        requerido: true,
        validar: (v) => (/^\d{8}$/.test(String(v ?? '').trim()) ? null : 'El DNI debe tener 8 dígitos'),
      },
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
      /**
       * Lo propio del Docente. La SECCIÓN ya no se elige: es un atributo del
       * colegio y el alumno la hereda. Y es UN colegio, no varios: por ahora
       * cada docente atiende un plantel y todos los grados que ese plantel
       * ofrece. Rotarlo es editar este campo; renovarlo, cambiar el año.
       */
      {
        nombre: 'anio_escolar',
        etiqueta: 'Año escolar',
        tipo: 'number',
        ayuda: 'Solo para Docente. Cambiarlo renueva su asignación',
      },
      {
        nombre: 'id_colegio',
        etiqueta: 'Colegio asignado',
        tipo: 'select',
        ancho: 'completo',
        opciones: colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre })),
        ayuda: 'Solo para Docente: define a qué alumnos accede',
      },
      {
        nombre: 'grados',
        etiqueta: 'Grados',
        tipo: 'multiple',
        ancho: 'completo',
        opciones: grados.map((g) => ({ value: String(g.id_grado), label: g.nombre })),
        ayuda: 'Un aula (colegio y grado) solo puede tener un docente',
      },
    ],
    [colegios, grados],
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
          // Las columnas que pide CU016, en su orden.
          { key: 'nombre', header: 'Nombre completo', sortable: true, className: 'font-medium text-ink-900' },
          { key: 'dni', header: 'DNI', align: 'center', render: (u) => etiquetaDe(u.dni) },
          { key: 'correo', header: 'Correo', sortable: true },
          { key: 'rol', header: 'Rol', render: (u) => <Badge tone="info">{etiquetaDe(u.rol)}</Badge> },
          {
            // Llega como LISTA: nombres de colegios para los docentes y
            // ["Global"] para Supervisor y Directivo.
            key: 'colegios_asignados',
            header: 'Colegios asignados',
            render: (u) => (u.colegios_asignados ?? []).map((c) => etiquetaDe(c)).join(', ') || '—',
          },
        ]}
      />

      <ModalCredencialDocente credencial={credencial} onCerrar={() => setCredencial(null)} />
    </>
  )
}
