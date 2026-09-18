// Cubre: RF-002, RF-025, RN-001, RN-003, RN-010, RN-016
import { useState } from 'react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Tabs from '../../components/ui/Tabs'
import TabAsignaciones from './TabAsignaciones'
import TabCatalogos from './TabCatalogos'
import TabDocentes from './TabDocentes'
import { usePeriodos } from '../../hooks/useCatalogos'

const ESTADO = {
  cerrado: { tono: 'neutral', texto: 'Cerrado' },
  abierto: { tono: 'success', texto: 'Abierto' },
  programado: { tono: 'info', texto: 'Programado' },
}

/** Administración (P16): docentes, asignaciones, periodos y catálogos. Solo Jefa_Profesores. */
export default function AdministracionPage() {
  const [pestana, setPestana] = useState('docentes')

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Administración</h1>
        <p className="mt-1 text-sm text-ink-500">Docentes, asignaciones por periodo, cortes de evaluación y catálogos oficiales.</p>
      </header>

      <Tabs
        value={pestana}
        onChange={setPestana}
        items={[
          { value: 'docentes', label: 'Docentes' },
          { value: 'asignaciones', label: 'Asignaciones' },
          { value: 'periodos', label: 'Periodos de evaluación' },
          { value: 'catalogos', label: 'Catálogos' },
        ]}
      />

      {pestana === 'docentes' && <TabDocentes />}
      {pestana === 'asignaciones' && <TabAsignaciones />}
      {pestana === 'periodos' && <TabPeriodos />}
      {pestana === 'catalogos' && <TabCatalogos />}
    </div>
  )
}

/**
 * Los cuatro cortes del año (RN-010): solo uno está abierto a la vez.
 * TODO: abrir y cerrar un periodo es una operación del backend que todavía no
 * está definida; por ahora la pestaña es de consulta.
 */
function TabPeriodos() {
  const { data = [], isLoading } = usePeriodos()
  return (
    <Card title="Periodos de evaluación" subtitle="Abril, julio, octubre y diciembre. Solo uno admite registros a la vez." padded={false}>
      <DataTable
        loading={isLoading}
        rows={data}
        getRowId={(p) => p.id_periodo}
        paginated={false}
        columns={[
          { key: 'nombre', header: 'Periodo', className: 'font-medium text-ink-900' },
          { key: 'anio', header: 'Año', align: 'center' },
          { key: 'mes', header: 'Mes', align: 'center' },
          {
            key: 'estado',
            header: 'Estado',
            align: 'center',
            render: (p) => <Badge tone={ESTADO[p.estado]?.tono ?? 'neutral'}>{ESTADO[p.estado]?.texto ?? p.estado}</Badge>,
          },
        ]}
      />
    </Card>
  )
}
