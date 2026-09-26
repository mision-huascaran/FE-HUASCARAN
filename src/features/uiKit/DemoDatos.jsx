import { useState } from 'react'
import { Lock } from 'lucide-react'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  Select,
  Skeleton,
  Stepper,
  useToast,
} from '../../components/ui'
import { ALUMNOS_DEMO, COLUMNAS } from './datosDemo'

/** Catálogo /_ui: filtros, tabla, pasos, estado vacío y cargas. */
export default function DemoDatos({ setModal, setDrawer }) {
  const toast = useToast()
  const [paso, setPaso] = useState(1)
  const [busqueda, setBusqueda] = useState('')

  return (
    <>
      <FilterBar
        search={busqueda}
        onSearchChange={setBusqueda}
        searchPlaceholder="Buscar por nombre o código"
        onApply={() => toast.info('Filtros aplicados')}
        onClear={() => setBusqueda('')}
        activeCount={2}
      >
        <Select label="Colegio" placeholder="Todos" options={['I.E. Amauta', 'I.E. Yungay']} />
        <Select label="Grado" placeholder="Todos" options={['1.°', '2.°', '3.°']} />
        <Select label="Programa" placeholder="Todos" options={['Alfabetización', 'Comprensión Lectora']} />
        <Select label="Periodo" placeholder="Todos" options={['Abril', 'Julio', 'Octubre', 'Diciembre']} />
      </FilterBar>

      <Card
        title="Tabla de datos"
        subtitle="Orden, paginación y desplazamiento dentro de la tarjeta"
        padded={false}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setDrawer(true)}>
              Abrir panel
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setModal(true)}>
              Abrir modal
            </Button>
          </>
        }
      >
        <DataTable
          columns={COLUMNAS}
          rows={ALUMNOS_DEMO}
          initialPageSize={5}
          footNote="Cero libros es un valor válido en semanas sin actividad lectiva."
        />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Pasos" subtitle="Formulario guiado de 3 pasos">
          <Stepper
            steps={['Seleccionar estudiante', 'Registrar evaluación', 'Revisar y guardar']}
            current={paso}
            onStepClick={setPaso}
          />
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPaso((p) => Math.max(0, p - 1))}>
              Anterior
            </Button>
            <Button size="sm" onClick={() => setPaso((p) => Math.min(2, p + 1))}>
              Siguiente
            </Button>
          </div>
        </Card>

        <Card title="Estado vacío" padded={false}>
          <EmptyState
            icon={Lock}
            title="No tiene permisos para acceder a esta sección"
            description="Ingresó con el rol Profesor. Vuelva a su panel para continuar."
            action={<Button variant="primary">Volver al inicio</Button>}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Carga · tarjeta"><Skeleton variant="card" /></Card>
        <Card title="Carga · tabla"><Skeleton variant="table" rows={4} /></Card>
        <Card title="Carga · gráfico"><Skeleton variant="chart" /></Card>
      </div>
    </>
  )
}
