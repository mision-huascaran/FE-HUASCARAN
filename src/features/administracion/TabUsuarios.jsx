// Cubre: RF-002, RN-001
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import ModalCredencialDocente from './ModalCredencialDocente'
import columnasUsuarios from './columnasUsuarios'
import { activarUsuario, actualizarUsuario, crearUsuario, desactivarUsuario, listarUsuariosAdmin } from '../../api/resources/administracion'
import { estadoDe, mensajeDeError } from '../../api/client'
import { ROLES } from '../../auth/roles'
import useSessionStore from '../../store/sessionStore'

const formBase = (idRol) => ({ nombres: '', apellidos: '', correo: '', id_rol: String(idRol) })

/**
 * Cuentas de Supervisor y Directivo (P16).
 *
 * El Supervisor administra ambas; el Directivo, solo las de Directivo. Las de
 * Docente se gestionan en su propia pestaña, porque el backend las crea con
 * `POST /profesores` (necesitan además su ficha de docente).
 *
 * Las dos reglas que impiden quedarse sin cuentas —la última activa de un rol y
 * desactivarse a uno mismo— las aplica el SERVIDOR con un 409, así que aquí solo
 * se muestra el mensaje que devuelve, ya redactado.
 */
export default function TabUsuarios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idRolSesion = Number(useSessionStore((s) => s.usuario?.id_rol) ?? ROLES.SUPERVISOR)
  const esDirectivo = idRolSesion === ROLES.DIRECTIVO

  /**
   * Plan de Prueba, módulo Usuarios: «el Supervisor gestiona Docentes y
   * Supervisores; el Directivo, otros Directivos». Nadie crea cuentas del otro
   * lado, así que cada rol tiene una única opción y el desplegable queda fijo.
   * Las de Docente se crean en su pestaña, porque necesitan ficha de docente.
   */
  const opcionesRol = [
    esDirectivo
      ? { value: String(ROLES.DIRECTIVO), label: 'Directivo' }
      : { value: String(ROLES.SUPERVISOR), label: 'Supervisor' },
  ]

  const [abierto, setAbierto] = useState(false)
  // Con cuenta en edición el mismo formulario corrige; sin ella, da de alta.
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(() => formBase(esDirectivo ? ROLES.DIRECTIVO : ROLES.SUPERVISOR))
  const [credencial, setCredencial] = useState(null)

  const consulta = useQuery({ queryKey: ['admin', 'usuarios'], queryFn: () => listarUsuariosAdmin() })
  const { data = [], isLoading } = consulta
  // El backend reserva `GET /usuarios` al Supervisor, así que al Directivo le
  // responde 403 aunque el Plan de Prueba le atribuya la gestión de otros
  // Directivos. Se dice con todas las letras en vez de dejar la tabla vacía.
  const sinPermisoEnServidor = consulta.isError && estadoDe(consulta.error) === 403

  // Cada rol ve solo las cuentas que le toca administrar. Las de Docente tienen
  // su propia pestaña, así que aquí el Supervisor ve únicamente Supervisores.
  const visibles = useMemo(() => {
    const permitidos = esDirectivo ? [ROLES.DIRECTIVO] : [ROLES.SUPERVISOR]
    return data.filter((u) => permitidos.includes(Number(u.id_rol)))
  }, [data, esDirectivo])

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
    setForm(formBase(esDirectivo ? ROLES.DIRECTIVO : ROLES.SUPERVISOR))
  }

  const abrirEdicion = (usuario) => {
    setEditando(usuario)
    setForm({
      nombres: usuario.nombres ?? '',
      apellidos: usuario.apellidos ?? '',
      correo: usuario.correo ?? '',
      id_rol: String(usuario.id_rol),
    })
    setAbierto(true)
  }

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const alta = useMutation({
    mutationFn: crearUsuario,
    onSuccess: (creado) => {
      refrescar()
      cerrar()
      // `correo_enviado: false` significa que la credencial no salió por correo
      // y esta es la única copia: hay que mostrarla.
      if (creado?.correo_enviado === false && creado?.['contraseña_temporal']) {
        setCredencial({ correo: creado.correo, password: creado['contraseña_temporal'] })
      } else {
        toast.success('Cuenta creada', 'Se le enviaron sus credenciales por correo.')
      }
    },
    onError: (error) => toast.error('No se pudo crear la cuenta', mensajeDeError(error)),
  })

  const edicion = useMutation({
    mutationFn: ({ id, cambios }) => actualizarUsuario(id, cambios),
    onSuccess: () => {
      refrescar()
      cerrar()
      toast.success('Cuenta actualizada')
    },
    onError: (error) => toast.error('No se pudo actualizar la cuenta', mensajeDeError(error)),
  })

  const baja = useMutation({
    mutationFn: desactivarUsuario,
    onSuccess: () => {
      refrescar()
      toast.success('Cuenta desactivada')
    },
    onError: (error) => toast.error('No se pudo desactivar', mensajeDeError(error)),
  })

  const reactivar = useMutation({
    mutationFn: activarUsuario,
    onSuccess: () => {
      refrescar()
      toast.success('Cuenta reactivada')
    },
    onError: (error) => toast.error('No se pudo reactivar', mensajeDeError(error)),
  })

  const completa = form.nombres.trim() && form.apellidos.trim() && /\S+@\S+\.\S+/.test(form.correo.trim())

  return (
    <>
      <Card
        title={esDirectivo ? 'Cuentas de Directivo' : 'Cuentas de Supervisor'}
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} disabled={sinPermisoEnServidor} onClick={() => setAbierto(true)}>
            Nueva cuenta
          </Button>
        }
      >
        {sinPermisoEnServidor ? (
          <EmptyState
            icon={Lock}
            title="El servidor no autoriza a este rol a listar cuentas"
            description="La API reserva la gestión de cuentas al Supervisor. Para que el Directivo administre otros Directivos, el backend debe permitirle GET y POST /usuarios y las bajas, limitados al rol Directivo."
          />
        ) : consulta.isError ? (
          <EmptyState title="No se pudieron cargar las cuentas" description={mensajeDeError(consulta.error)} />
        ) : (
        <DataTable
          loading={isLoading}
          rows={visibles}
          getRowId={(u) => u.id_usuario}
          paginated={false}
          columns={columnasUsuarios({ baja, alta: reactivar, editar: abrirEdicion, ocupado: baja.isPending || reactivar.isPending })}
        />
        )}
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title={editando ? 'Editar cuenta' : 'Nueva cuenta'}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button
              disabled={!completa}
              loading={alta.isPending || edicion.isPending}
              onClick={() =>
                editando
                  ? edicion.mutate({
                      id: editando.id_usuario,
                      cambios: { nombres: form.nombres, apellidos: form.apellidos, correo: form.correo },
                    })
                  : alta.mutate(form)
              }
            >
              {editando ? 'Guardar' : 'Crear cuenta'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
          <Input label="Apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
          <Input
            label="Correo institucional"
            required
            type="email"
            className="md:col-span-2"
            value={form.correo}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
          />
          <Select
            label="Rol"
            required
            disabled={Boolean(editando)}
            className="md:col-span-2"
            value={form.id_rol}
            onChange={(e) => setForm((f) => ({ ...f, id_rol: e.target.value }))}
            options={opcionesRol}
          />
        </div>
      </Modal>

      <ModalCredencialDocente credencial={credencial} onCerrar={() => setCredencial(null)} />
    </>
  )
}
