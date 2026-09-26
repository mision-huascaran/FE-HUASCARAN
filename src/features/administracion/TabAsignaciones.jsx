// Cubre: RF-002, RN-001, RN-003
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import {
  crearAsignacion,
  eliminarAsignacion,
  listarAsignaciones,
  listarColegiosAdmin,
  listarDocentes,
  listarGradosAdmin,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'

const VACIA = { id_docente: '', id_colegio: '', id_grado: '', id_periodo_academico: '' }
const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

/**
 * Asignaciones docente × colegio × grado × periodo (P16).
 *
 * La asignación es POR GRADO, no por colegio completo: es lo que acepta
 * `POST /asignaciones` y lo que el backend usa para acotar qué alumnos ve cada
 * docente. Un docente con varios grados tiene una fila por grado.
 */
export default function TabAsignaciones() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data: colegios = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'colegios'], queryFn: listarColegiosAdmin, ...SIEMPRE })
  const { data: grados = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'grados'], queryFn: listarGradosAdmin, ...SIEMPRE })
  const { data: docentes = [] } = useQuery({ queryKey: ['admin', 'docentes'], queryFn: listarDocentes })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'asignaciones'], queryFn: listarAsignaciones })

  const [abierto, setAbierto] = useState(false)
  const [nueva, setNueva] = useState(VACIA)

  /**
   * La API no publica el listado de periodos académicos, así que los únicos
   * que se conocen son los que ya aparecen en alguna asignación. Sin ninguna
   * asignación previa no hay periodo que ofrecer y el alta queda bloqueada.
   */
  const periodos = useMemo(() => {
    const vistos = new Map()
    for (const a of data) {
      if (a.id_periodo && !vistos.has(a.id_periodo)) vistos.set(a.id_periodo, a.periodo ?? `Periodo ${a.id_periodo}`)
    }
    return [...vistos].map(([value, label]) => ({ value, label }))
  }, [data])

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['asignaciones'] })
  }

  const cerrar = () => {
    setAbierto(false)
    setNueva(VACIA)
  }

  const alta = useMutation({
    mutationFn: crearAsignacion,
    onSuccess: () => {
      refrescar()
      toast.success('Asignación registrada')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo asignar', mensajeDeError(error)),
  })

  const baja = useMutation({
    mutationFn: eliminarAsignacion,
    onSuccess: () => {
      refrescar()
      toast.success('Asignación retirada')
    },
    onError: (error) => toast.error('No se pudo retirar', mensajeDeError(error)),
  })

  const completa = nueva.id_docente && nueva.id_colegio && nueva.id_grado && nueva.id_periodo_academico

  return (
    <div className="flex flex-col gap-5">
      <Card
        title="Asignaciones"
        subtitle="Docente, colegio, grado y periodo"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)} disabled={!periodos.length}>
            Nueva asignación
          </Button>
        }
      >
        <DataTable
          loading={isLoading}
          rows={data}
          getRowId={(a) => a.id_asignacion}
          initialPageSize={10}
          columns={[
            { key: 'docente', header: 'Docente', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'colegio', header: 'Colegio', sortable: true },
            { key: 'grado', header: 'Grado', align: 'center' },
            {
              key: 'periodo',
              header: 'Periodo',
              sortable: true,
              sortValue: (a) => a.id_periodo,
              render: (a) => <Badge tone={a.vigente === false ? 'neutral' : 'success'}>{a.periodo}</Badge>,
            },
            {
              key: 'acciones',
              header: '',
              align: 'right',
              render: (a) => (
                <button
                  type="button"
                  aria-label={`Retirar asignación de ${a.docente} en ${a.colegio}`}
                  title="Retirar"
                  disabled={baja.isPending}
                  onClick={() => baja.mutate(a.id_asignacion)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-100 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={abierto}
        onClose={cerrar}
        title="Nueva asignación"
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending} onClick={() => alta.mutate(nueva)}>Asignar</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Docente"
            required
            className="md:col-span-2"
            value={nueva.id_docente}
            onChange={(e) => setNueva((n) => ({ ...n, id_docente: e.target.value }))}
            placeholder="Seleccione"
            options={docentes.map((d) => ({ value: d.id_docente, label: d.nombre }))}
          />
          <Select
            label="Colegio"
            required
            value={nueva.id_colegio}
            onChange={(e) => setNueva((n) => ({ ...n, id_colegio: e.target.value }))}
            placeholder="Seleccione"
            options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
          />
          <Select
            label="Grado"
            required
            value={nueva.id_grado}
            onChange={(e) => setNueva((n) => ({ ...n, id_grado: e.target.value }))}
            placeholder="Seleccione"
            options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
          />
          <Select
            label="Periodo"
            required
            className="md:col-span-2"
            value={nueva.id_periodo_academico}
            onChange={(e) => setNueva((n) => ({ ...n, id_periodo_academico: e.target.value }))}
            placeholder="Seleccione"
            options={periodos}
          />
        </div>
      </Modal>
    </div>
  )
}
