// Cubre: RF-002, RN-001, RN-003
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Plus, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import { crearAsignacion, eliminarAsignacion, listarAsignaciones, listarDocentes } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { useColegios, usePeriodos } from '../../hooks/useCatalogos'

const TONO_PERIODO = { cerrado: 'neutral', abierto: 'success', programado: 'info' }

/**
 * Asignaciones docente × colegio × periodo (P16).
 *
 * RN-003: la rotación ocurre SOLO al cierre de un periodo e implica cambiar el
 * colegio completo, no grados sueltos. Por eso no hay selector de grado (los
 * seis van juntos) y solo se da de alta o de baja en periodos que aún no empiezan.
 */
export default function TabAsignaciones() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: colegios = [] } = useColegios()
  const { data: periodos = [] } = usePeriodos()
  const { data: docentes = [] } = useQuery({ queryKey: ['admin', 'docentes'], queryFn: listarDocentes })
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'asignaciones'], queryFn: listarAsignaciones })

  const [abierto, setAbierto] = useState(false)
  const [nueva, setNueva] = useState({ id_docente: '', id_colegio: '', id_periodo: '' })
  const programados = periodos.filter((p) => p.estado === 'programado')

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['asignaciones'] })
  }

  const alta = useMutation({
    mutationFn: crearAsignacion,
    onSuccess: () => {
      refrescar()
      toast.success('Asignación registrada')
      setAbierto(false)
      setNueva({ id_docente: '', id_colegio: '', id_periodo: '' })
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

  const completa = nueva.id_docente && nueva.id_colegio && nueva.id_periodo

  return (
    <div className="flex flex-col gap-5">
      <div role="note" className="flex items-start gap-2 rounded-xl border border-info-600/20 bg-info-100 px-4 py-3 text-sm text-info-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          La rotación de docentes ocurre <strong>solo al cierre de un periodo</strong> y cambia el colegio completo, con
          sus seis grados. Por eso solo se asigna o retira en periodos que todavía no empiezan (RN-003).
        </span>
      </div>

      <Card
        title="Asignaciones"
        subtitle="Docente × colegio × periodo de evaluación"
        padded={false}
        actions={
          <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)} disabled={!programados.length}>
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
            { key: 'grados', header: 'Grados', render: () => <span className="text-xs text-ink-500">1.° a 6.°</span> },
            {
              key: 'periodo',
              header: 'Periodo',
              sortable: true,
              sortValue: (a) => a.id_periodo,
              render: (a) => <Badge tone={TONO_PERIODO[a.estado_periodo]}>{a.periodo}</Badge>,
            },
            {
              key: 'acciones',
              header: '',
              align: 'right',
              render: (a) => (
                <button
                  type="button"
                  aria-label={`Retirar asignación de ${a.docente} en ${a.colegio}`}
                  title={a.estado_periodo === 'programado' ? 'Retirar' : 'Solo se retira en periodos que aún no empiezan'}
                  disabled={a.estado_periodo !== 'programado' || baja.isPending}
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
        onClose={() => setAbierto(false)}
        title="Nueva asignación"
        subtitle="El docente toma el colegio completo, con sus seis grados"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button disabled={!completa} loading={alta.isPending} onClick={() => alta.mutate(nueva)}>Asignar</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Select label="Docente" required value={nueva.id_docente} onChange={(e) => setNueva((n) => ({ ...n, id_docente: e.target.value }))} placeholder="Seleccione" options={docentes.map((d) => ({ value: d.id_docente, label: d.nombre }))} />
          <Select label="Colegio" required value={nueva.id_colegio} onChange={(e) => setNueva((n) => ({ ...n, id_colegio: e.target.value }))} placeholder="Seleccione" options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))} />
          <Select
            label="Periodo"
            required
            value={nueva.id_periodo}
            onChange={(e) => setNueva((n) => ({ ...n, id_periodo: e.target.value }))}
            placeholder="Seleccione"
            options={programados.map((p) => ({ value: p.id_periodo, label: p.nombre }))}
            hint="Solo periodos que todavía no empiezan"
          />
        </div>
      </Modal>
    </div>
  )
}
