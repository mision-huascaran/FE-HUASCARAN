// Cubre: RF-002, RN-001
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { crearUsuario, desactivarUsuario, listarDocentes } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { ROLES } from '../../auth/roles'

const formBase = () => ({ nombres: '', apellidos: '', correo: '', password: '' })

export default function TabDocentes() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'docentes'], queryFn: listarDocentes })
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState(formBase())

  const cerrar = () => {
    setAbierto(false)
    setForm(formBase())
  }

  const alta = useMutation({
    mutationFn: (payload) => crearUsuario({ ...payload, id_rol: ROLES.PROFESOR }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Docente registrado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo registrar el docente', mensajeDeError(error)),
  })

  const baja = useMutation({
    mutationFn: (idUsuario) => desactivarUsuario(idUsuario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Cuenta de docente desactivada')
    },
    onError: (error) => toast.error('No se pudo desactivar la cuenta', mensajeDeError(error)),
  })

  const completa = useMemo(
    () => form.nombres.trim() && form.apellidos.trim() && form.correo.trim() && form.password.trim(),
    [form],
  )

  return (
    <>
      <Card
        title="Docentes"
        subtitle="Cuentas de rol Profesor y sus colegios en el periodo vigente"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)}>
            Nuevo docente
          </Button>
        }
      >
        <DataTable
          loading={isLoading}
          rows={data}
          getRowId={(d) => d.id_docente}
          paginated={false}
          columns={[
            { key: 'nombre', header: 'Docente', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'correo', header: 'Correo', render: (d) => <span className="text-xs text-ink-500">{d.correo ?? 'Sin cuenta'}</span> },
            {
              key: 'colegios_vigentes',
              header: 'Colegios en el periodo vigente',
              render: (d) =>
                d.colegios_vigentes.length ? (
                  <div className="flex flex-wrap gap-1">
                    {d.colegios_vigentes.map((c) => (
                      <Badge key={c} tone="info">{c}</Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-ink-400">Sin asignación</span>
                ),
            },
            {
              key: 'activo',
              header: 'Cuenta',
              align: 'center',
              render: (d) => <Badge tone={d.activo ? 'success' : 'neutral'}>{d.activo ? 'Activa' : 'Inactiva'}</Badge>,
            },
            {
              key: 'acciones',
              header: 'Acciones',
              align: 'center',
              render: (d) => (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  iconLeft={UserX}
                  disabled={!d.activo || !d.id_usuario || baja.isPending}
                  onClick={() => baja.mutate(d.id_usuario)}
                  className="text-danger-600 hover:text-danger-700"
                >
                  Desactivar cuenta
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title="Nuevo docente"
        subtitle="Crea la cuenta institucional del docente"
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending} onClick={() => alta.mutate(form)}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
          <Input label="Apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
          <Input label="Correo institucional" required type="email" value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} />
          <Input label="Contraseña" required type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}
