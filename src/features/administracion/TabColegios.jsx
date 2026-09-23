import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { crearColegio, listarColegiosAdmin } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'

export default function TabColegios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'colegios'], queryFn: listarColegiosAdmin })
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ nombre: '', abreviatura: '', zona: '', distrito: '' })

  const alta = useMutation({
    mutationFn: crearColegio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['catalogo'] })
      toast.success('Colegio registrado')
      setAbierto(false)
      setForm({ nombre: '', abreviatura: '', zona: '', distrito: '' })
    },
    onError: (error) => toast.error('No se pudo registrar el colegio', mensajeDeError(error)),
  })

  const completa = form.nombre.trim() && form.abreviatura.trim() && form.zona.trim() && form.distrito.trim()

  return (
    <>
      <Card
        title="Colegios"
        subtitle="Planteles del programa y su zona y distrito"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)}>
            Nuevo colegio
          </Button>
        }
      >
        <DataTable
          loading={isLoading}
          rows={data}
          getRowId={(c) => c.id_colegio}
          paginated={false}
          columns={[
            { key: 'nombre', header: 'Colegio', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'abreviatura', header: 'Abreviatura', align: 'center' },
            { key: 'zona', header: 'Zona', sortable: true },
            { key: 'distrito', header: 'Distrito', sortable: true },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Nuevo colegio"
        subtitle="Registra un plantel para el programa"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending} onClick={() => alta.mutate(form)}>Guardar</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombre del colegio" required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          <Input label="Abreviatura" required value={form.abreviatura} maxLength={8} onChange={(e) => setForm((f) => ({ ...f, abreviatura: e.target.value.toUpperCase() }))} />
          <Input label="Zona" required value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} />
          <Input label="Distrito" required value={form.distrito} onChange={(e) => setForm((f) => ({ ...f, distrito: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}
