import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PencilLine, Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { actualizarColegio, crearColegio, listarColegiosAdmin } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'

/**
 * Colegios (P16).
 *
 * El formulario pide SOLO nombre y zona porque es lo único que guarda
 * `POST /colegios`. Antes preguntaba también abreviatura y distrito, que el
 * backend no almacena: se escribían, se enviaban a la nada y al recargar no
 * estaban. Pedir un dato que se descarta es peor que no pedirlo.
 */
export default function TabColegios() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'colegios'], queryFn: listarColegiosAdmin })
  const [abierto, setAbierto] = useState(false)
  // Cuando hay colegio en edición, el mismo formulario sirve para corregirlo.
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', zona: '' })

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
    setForm({ nombre: '', zona: '' })
  }

  const abrirEdicion = (colegio) => {
    setEditando(colegio)
    setForm({ nombre: colegio.nombre ?? '', zona: colegio.zona ?? '' })
    setAbierto(true)
  }

  const edicion = useMutation({
    mutationFn: ({ id, cambios }) => actualizarColegio(id, cambios),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['catalogo'] })
      toast.success('Colegio actualizado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo actualizar el colegio', mensajeDeError(error)),
  })

  const alta = useMutation({
    mutationFn: crearColegio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['catalogo'] })
      toast.success('Colegio registrado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo registrar el colegio', mensajeDeError(error)),
  })

  const completa = form.nombre.trim() && form.zona.trim()

  return (
    <>
      <Card
        title="Colegios"
        subtitle="Planteles del programa y su zona"
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
            { key: 'zona', header: 'Zona', sortable: true },
            {
              key: 'acciones',
              header: 'Acciones',
              align: 'center',
              render: (c) => (
                <Button size="sm" variant="ghost" iconLeft={PencilLine} aria-label={`Editar ${c.nombre}`} onClick={() => abrirEdicion(c)}>
                  Editar
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title={editando ? 'Editar colegio' : 'Nuevo colegio'}
        subtitle={editando ? 'Corrige los datos del plantel' : 'Registra un plantel para el programa'}
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button
              disabled={!completa}
              loading={alta.isPending || edicion.isPending}
              onClick={() =>
                editando
                  ? edicion.mutate({ id: editando.id_colegio, cambios: { nombre: form.nombre, zona: form.zona } })
                  : alta.mutate(form)
              }
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombre del colegio" required value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          <Input label="Zona" required value={form.zona} onChange={(e) => setForm((f) => ({ ...f, zona: e.target.value }))} />
        </div>
      </Modal>
    </>
  )
}
