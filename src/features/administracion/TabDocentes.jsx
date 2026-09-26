// Cubre: RF-002, RN-001
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PencilLine, Plus, UserCheck, UserX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import ModalCredencialDocente from './ModalCredencialDocente'
import { activarDocente, actualizarDocente, crearDocente, desactivarDocente, listarDocentes } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'

const formBase = () => ({ nombres: '', apellidos: '', correo: '' })

/**
 * Docentes (P16): alta de la cuenta con la que el docente inicia sesión, y baja
 * lógica de esa cuenta.
 *
 * El backend NO recibe una contraseña: la genera, la envía por correo y la
 * devuelve solo si el envío falló, para que el Supervisor la entregue a mano.
 * Por eso aquí no se pide contraseña y sí se muestra la que llegue de vuelta.
 */
export default function TabDocentes() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'docentes'], queryFn: listarDocentes })
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(formBase())
  const [credencial, setCredencial] = useState(null)

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
    setForm(formBase())
  }

  const abrirEdicion = (docente) => {
    setEditando(docente)
    setForm({ nombres: docente.nombres ?? '', apellidos: docente.apellidos ?? '', correo: docente.correo ?? '' })
    setAbierto(true)
  }

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['admin'] })

  const alta = useMutation({
    mutationFn: crearDocente,
    onSuccess: (creado) => {
      refrescar()
      cerrar()
      if (creado?.['contraseña_temporal']) {
        // El correo de bienvenida no salió: hay que entregarla en mano.
        setCredencial({ correo: creado.correo, password: creado['contraseña_temporal'] })
      } else {
        toast.success('Docente registrado', 'Se le envió su contraseña por correo.')
      }
    },
    onError: (error) => toast.error('No se pudo registrar el docente', mensajeDeError(error)),
  })

  const edicion = useMutation({
    mutationFn: ({ id, cambios }) => actualizarDocente(id, cambios),
    onSuccess: () => {
      refrescar()
      toast.success('Docente actualizado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo actualizar', mensajeDeError(error)),
  })

  const baja = useMutation({
    mutationFn: desactivarDocente,
    onSuccess: () => {
      refrescar()
      toast.success('Cuenta desactivada', 'El docente ya no puede iniciar sesión.')
    },
    onError: (error) => toast.error('No se pudo desactivar la cuenta', mensajeDeError(error)),
  })

  const reactivar = useMutation({
    mutationFn: activarDocente,
    onSuccess: () => {
      refrescar()
      toast.success('Cuenta reactivada')
    },
    onError: (error) => toast.error('No se pudo reactivar la cuenta', mensajeDeError(error)),
  })

  const completa = useMemo(
    () => form.nombres.trim() && form.apellidos.trim() && /\S+@\S+\.\S+/.test(form.correo.trim()),
    [form],
  )
  const ocupado = baja.isPending || reactivar.isPending

  return (
    <>
      <Card
        title="Docentes"
        subtitle="Cuentas con las que los docentes inician sesión y registran a sus estudiantes"
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
          getRowId={(d) => d.id_usuario ?? d.id_docente}
          paginated={false}
          columns={[
            { key: 'nombre', header: 'Docente', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'correo', header: 'Correo', render: (d) => <span className="text-xs text-ink-500">{d.correo ?? 'Sin cuenta'}</span> },
            {
              key: 'colegios_vigentes',
              header: 'Colegios en el periodo vigente',
              render: (d) =>
                d.colegios_vigentes?.length ? (
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
                <div className="flex items-center justify-center gap-1">
                  <Button size="sm" variant="ghost" iconLeft={PencilLine} aria-label={`Editar ${d.nombre}`} onClick={() => abrirEdicion(d)}>
                    Editar
                  </Button>
                  {d.activo ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={UserX}
                    disabled={!d.id_usuario || ocupado}
                    onClick={() => baja.mutate(d.id_usuario)}
                    className="text-danger-600"
                  >
                    Desactivar
                  </Button>
                  ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={UserCheck}
                    disabled={!d.id_usuario || ocupado}
                    onClick={() => reactivar.mutate(d.id_usuario)}
                  >
                    Reactivar
                  </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title={editando ? 'Editar docente' : 'Nuevo docente'}
        subtitle={editando ? 'Corrige sus datos; la contraseña no cambia' : 'El sistema crea la cuenta y genera su contraseña'}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button
              disabled={!completa}
              loading={alta.isPending || edicion.isPending}
              onClick={() => (editando ? edicion.mutate({ id: editando.id_usuario, cambios: form }) : alta.mutate(form))}
            >
              {editando ? 'Guardar cambios' : 'Crear cuenta'}
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
            hint="La contraseña la genera el sistema"
          />
        </div>
      </Modal>

      <ModalCredencialDocente credencial={credencial} onCerrar={() => setCredencial(null)} />
    </>
  )
}
