// Cubre: RF-002, RN-001
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import ModalCredencialDocente from './ModalCredencialDocente'
import columnasUsuarios from './columnasUsuarios'
import { activarUsuario, crearUsuario, desactivarUsuario, listarUsuariosAdmin } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
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

  const opcionesRol = esDirectivo
    ? [{ value: String(ROLES.DIRECTIVO), label: 'Directivo' }]
    : [
        { value: String(ROLES.SUPERVISOR), label: 'Supervisor' },
        { value: String(ROLES.DIRECTIVO), label: 'Directivo' },
      ]

  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState(() => formBase(esDirectivo ? ROLES.DIRECTIVO : ROLES.SUPERVISOR))
  const [credencial, setCredencial] = useState(null)

  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'usuarios'], queryFn: () => listarUsuariosAdmin() })

  // Nadie administra cuentas de Docente desde aquí, y el Directivo solo las suyas.
  const visibles = useMemo(() => {
    const permitidos = esDirectivo ? [ROLES.DIRECTIVO] : [ROLES.SUPERVISOR, ROLES.DIRECTIVO]
    return data.filter((u) => permitidos.includes(Number(u.id_rol)))
  }, [data, esDirectivo])

  const cerrar = () => {
    setAbierto(false)
    setForm(formBase(esDirectivo ? ROLES.DIRECTIVO : ROLES.SUPERVISOR))
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
        title={esDirectivo ? 'Cuentas de Directivo' : 'Cuentas administrativas'}
        subtitle="Supervisores y directivos con acceso al sistema"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)}>
            Nueva cuenta
          </Button>
        }
      >
        <DataTable
          loading={isLoading}
          rows={visibles}
          getRowId={(u) => u.id_usuario}
          paginated={false}
          columns={columnasUsuarios({ baja, alta: reactivar, ocupado: baja.isPending || reactivar.isPending })}
          footNote="Siempre debe quedar al menos una cuenta activa de Supervisor y una de Directivo: el servidor rechaza la última. Corregir los datos de una cuenta todavía no está disponible en la API."
        />
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title="Nueva cuenta"
        subtitle="El sistema genera la contraseña y se la envía por correo"
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending} onClick={() => alta.mutate(form)}>
              Crear cuenta
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
            className="md:col-span-2"
            value={form.id_rol}
            onChange={(e) => setForm((f) => ({ ...f, id_rol: e.target.value }))}
            options={opcionesRol}
            hint="Las cuentas de docente se crean en la pestaña Docentes"
          />
        </div>
      </Modal>

      <ModalCredencialDocente credencial={credencial} onCerrar={() => setCredencial(null)} />
    </>
  )
}
