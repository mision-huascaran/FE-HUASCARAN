import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { crearAlumno, listarAlumnosAdmin } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { useColegios, useGrados, useProgramas } from '../../hooks/useCatalogos'

export default function TabAlumnos() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'alumnos'], queryFn: listarAlumnosAdmin })
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState({ nombres: '', apellidos: '', id_colegio: '', id_grado: '', id_programa: '', aula: 'A' })

  const alta = useMutation({
    mutationFn: crearAlumno,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['alumnos'] })
      toast.success('Alumno registrado')
      setAbierto(false)
      setForm({ nombres: '', apellidos: '', id_colegio: '', id_grado: '', id_programa: '', aula: 'A' })
    },
    onError: (error) => toast.error('No se pudo registrar el alumno', mensajeDeError(error)),
  })

  const completa = form.nombres.trim() && form.apellidos.trim() && form.id_colegio && form.id_grado && form.id_programa

  return (
    <>
      <Card
        title="Alumnos"
        subtitle="Estudiantes por colegio, grado y programa"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)}>
            Nuevo alumno
          </Button>
        }
      >
        <DataTable
          loading={isLoading}
          rows={data}
          getRowId={(a) => a.id_alumno}
          paginated={false}
          columns={[
            { key: 'nombre', header: 'Alumno', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'codigo', header: 'Código', align: 'center' },
            { key: 'colegio', header: 'Colegio', sortable: true },
            { key: 'grado', header: 'Grado', align: 'center' },
            { key: 'programa', header: 'Programa', sortable: true },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Nuevo alumno"
        subtitle="Asocia al estudiante con un colegio y un programa"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending} onClick={() => alta.mutate(form)}>Guardar</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
          <Input label="Apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
          <Select label="Colegio" required value={form.id_colegio} onChange={(e) => setForm((f) => ({ ...f, id_colegio: e.target.value }))} placeholder="Seleccione" options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))} />
          <Select label="Grado" required value={form.id_grado} onChange={(e) => setForm((f) => ({ ...f, id_grado: e.target.value }))} placeholder="Seleccione" options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))} />
          <Select label="Programa" required value={form.id_programa} onChange={(e) => setForm((f) => ({ ...f, id_programa: e.target.value }))} placeholder="Seleccione" options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))} />
          <Select label="Aula" value={form.aula} onChange={(e) => setForm((f) => ({ ...f, aula: e.target.value }))} placeholder="Seleccione" options={['A', 'B', 'C'].map((a) => ({ value: a, label: a }))} />
        </div>
      </Modal>
    </>
  )
}
