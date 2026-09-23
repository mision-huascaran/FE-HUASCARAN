import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PencilLine, Plus, UserX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { crearUsuario, desactivarUsuario, listarUsuariosAdmin, actualizarUsuario } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { ROLES } from '../../auth/roles'
import useSessionStore from '../../store/sessionStore'

const OPCIONES_ROL = [
  { value: String(ROLES.PROFESOR), label: 'Docente' },
  { value: String(ROLES.JEFA), label: 'Supervisor' },
  { value: String(ROLES.DIRECTIVOS), label: 'Directivo' },
]

const formBase = () => ({ nombres: '', apellidos: '', correo: '', password: '', id_rol: String(ROLES.JEFA) })

export default function TabUsuarios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const usuarioSesion = useSessionStore((s) => s.usuario)
  const rolSesion = Number(usuarioSesion?.id_rol ?? ROLES.JEFA)
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'usuarios'], queryFn: listarUsuariosAdmin })
  const usuariosPermitidos = useMemo(() => {
    if (rolSesion === ROLES.DIRECTIVOS || rolSesion === ROLES.DIRECTIVO) {
      return data.filter((u) => u.id_rol === ROLES.DIRECTIVOS)
    }
    if (rolSesion === ROLES.JEFA || rolSesion === ROLES.SUPERVISOR) {
      return data.filter((u) => [ROLES.JEFA, ROLES.DIRECTIVOS].includes(Number(u.id_rol)))
    }
    return data
  }, [data, rolSesion])
  const opcionesRol = useMemo(() => {
    if (rolSesion === ROLES.DIRECTIVOS || rolSesion === ROLES.DIRECTIVO) {
      return [{ value: String(ROLES.DIRECTIVOS), label: 'Directivo' }]
    }
    if (rolSesion === ROLES.JEFA || rolSesion === ROLES.SUPERVISOR) {
      return [
        { value: String(ROLES.JEFA), label: 'Supervisor' },
        { value: String(ROLES.DIRECTIVOS), label: 'Directivo' },
      ]
    }
    return OPCIONES_ROL
  }, [rolSesion])
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState('crear')
  const [usuarioActual, setUsuarioActual] = useState(null)
  const [form, setForm] = useState(formBase())

  const cerrar = () => {
    setAbierto(false)
    setModo('crear')
    setUsuarioActual(null)
    setForm(formBase())
  }

  const abrirCreacion = () => {
    setModo('crear')
    setUsuarioActual(null)
    setForm({
      ...formBase(),
      id_rol: String(opcionesRol[0]?.value ?? ROLES.JEFA),
    })
    setAbierto(true)
  }

  const abrirEdicion = (usuario) => {
    setModo('editar')
    setUsuarioActual(usuario)
    setForm({
      nombres: usuario.nombres ?? '',
      apellidos: usuario.apellidos ?? '',
      correo: usuario.correo ?? '',
      password: '',
      id_rol: String(usuario.id_rol ?? ROLES.JEFA),
    })
    setAbierto(true)
  }

  const alta = useMutation({
    mutationFn: crearUsuario,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Usuario registrado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo registrar el usuario', mensajeDeError(error)),
  })

  const edicion = useMutation({
    mutationFn: ({ id, payload }) => actualizarUsuario(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Usuario actualizado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo actualizar el usuario', mensajeDeError(error)),
  })

  const baja = useMutation({
    mutationFn: async (id) => {
      const usuario = data.find((u) => u.id_usuario === id)
      const rol = usuario?.id_rol ?? null
      const activosPorRol = data.filter((u) => u.activo && u.id_rol === rol).length

      if (rol === ROLES.JEFA && activosPorRol <= 1) {
        throw new Error('No se puede desactivar el último Supervisor activo')
      }
      if (rol === ROLES.DIRECTIVOS && activosPorRol <= 1) {
        throw new Error('No se puede desactivar el último Directivo activo')
      }
      return desactivarUsuario(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Usuario desactivado')
    },
    onError: (error) => {
      const mensaje = error?.message === 'No se puede desactivar el último Supervisor activo' || error?.message === 'No se puede desactivar el último Directivo activo'
        ? error.message
        : mensajeDeError(error)
      toast.error('No se pudo desactivar el usuario', mensaje)
    },
  })

  const completa = useMemo(() => {
    const base = form.nombres.trim() && form.apellidos.trim() && form.correo.trim() && form.id_rol
    if (modo === 'crear') return base && form.password.trim()
    return base
  }, [form, modo])

  const guardar = () => {
    if (modo === 'editar' && usuarioActual) {
      const payload = {
        nombres: form.nombres,
        apellidos: form.apellidos,
        correo: form.correo,
        id_rol: Number(form.id_rol),
        ...(form.password.trim() ? { password: form.password } : {}),
      }
      edicion.mutate({ id: usuarioActual.id_usuario, payload })
      return
    }

    alta.mutate(form)
  }

  return (
    <>
      <Card
        title="Usuarios"
        subtitle="Cuentas del sistema por rol y estado"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={abrirCreacion}>
            Nuevo usuario
          </Button>
        }
      >
        <DataTable
          loading={isLoading}
          rows={usuariosPermitidos}
          getRowId={(u) => u.id_usuario}
          paginated={false}
          columns={[
            { key: 'nombre', header: 'Usuario', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'correo', header: 'Correo', sortable: true },
            { key: 'rol', header: 'Rol', render: (u) => <Badge tone="info">{u.rol}</Badge> },
            { key: 'activo', header: 'Estado', align: 'center', render: (u) => <Badge tone={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge> },
            {
              key: 'acciones',
              header: 'Acciones',
              align: 'center',
              render: (u) => (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    iconLeft={PencilLine}
                    aria-label={`Editar usuario ${u.nombre}`}
                    title="Editar usuario"
                    onClick={() => abrirEdicion(u)}
                  >
                    Editar usuario
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    iconLeft={UserX}
                    aria-label={`Desactivar usuario ${u.nombre}`}
                    title="Desactivar usuario"
                    disabled={!u.activo || baja.isPending}
                    onClick={() => baja.mutate(u.id_usuario)}
                    className="text-danger-600 hover:text-danger-700"
                  >
                    Desactivar usuario
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title={modo === 'editar' ? 'Editar usuario' : 'Nuevo usuario'}
        subtitle={modo === 'editar' ? 'Actualiza los datos del usuario seleccionado' : 'Crea una cuenta con rol Supervisor, Directivo o Docente'}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending || edicion.isPending} onClick={guardar}>
              {modo === 'editar' ? 'Guardar cambios' : 'Guardar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
          <Input label="Apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
          <Input label="Correo institucional" required type="email" value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} />
          {modo === 'crear' && (
            <Input label="Contraseña" required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          )}
          <div className="md:col-span-2">
            <Select
              label="Rol"
              required
              value={form.id_rol}
              onChange={(e) => setForm((f) => ({ ...f, id_rol: e.target.value }))}
              placeholder="Seleccione"
              options={opcionesRol}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
