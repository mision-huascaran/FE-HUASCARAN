// Cubre: RF-002, RF-025, RN-001, RN-003, RN-010, RN-016, RNF-004
import { useState } from 'react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Tabs from '../../components/ui/Tabs'
import TabAsignaciones from './TabAsignaciones'
import TabCatalogos from './TabCatalogos'
import TabColegios from './TabColegios'
import TabDocentes from './TabDocentes'
import TabUsuarios from './TabUsuarios'
import { usePeriodos } from '../../hooks/useCatalogos'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

const ESTADO = {
  cerrado: { tono: 'neutral', texto: 'Cerrado' },
  abierto: { tono: 'success', texto: 'Abierto' },
  programado: { tono: 'info', texto: 'Programado' },
}

/**
 * Pestañas por rol.
 *
 * El Supervisor administra el programa completo. El Directivo es un rol de
 * lectura (§5): lo único que administra son las cuentas de Directivo, así que no
 * ve docentes, colegios, alumnos, asignaciones ni catálogos. Ocultarlas no basta
 * como seguridad, pero cada pantalla real sigue detrás de su propia guarda.
 */
const PESTANAS = {
  [ROLES.SUPERVISOR]: [
    { value: 'docentes', label: 'Docentes' },
    { value: 'asignaciones', label: 'Asignaciones' },
    { value: 'colegios', label: 'Colegios' },
    { value: 'usuarios', label: 'Cuentas' },
    { value: 'periodos', label: 'Periodos de evaluación' },
    { value: 'catalogos', label: 'Catálogos' },
  ],
  [ROLES.DIRECTIVO]: [{ value: 'usuarios', label: 'Cuentas de Directivo' }],
}

export default function AdministracionPage() {
  const idRol = useSessionStore((s) => s.usuario?.id_rol)
  const pestanas = PESTANAS[idRol] ?? PESTANAS[ROLES.SUPERVISOR]
  const [pestana, setPestana] = useState(pestanas[0].value)
  const activa = pestanas.some((p) => p.value === pestana) ? pestana : pestanas[0].value
  const esDirectivo = idRol === ROLES.DIRECTIVO

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">
          {esDirectivo ? 'Cuentas' : 'Administración'}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {esDirectivo
            ? 'Cuentas de Directivo con acceso al panel ejecutivo.'
            : 'Docentes, asignaciones por periodo, colegios, cuentas, cortes de evaluación y catálogos oficiales.'}
        </p>
      </header>

      {pestanas.length > 1 && <Tabs value={activa} onChange={setPestana} items={pestanas} />}

      {activa === 'docentes' && <TabDocentes />}
      {activa === 'asignaciones' && <TabAsignaciones />}
      {activa === 'colegios' && <TabColegios />}
      {activa === 'usuarios' && <TabUsuarios />}
      {activa === 'periodos' && <TabPeriodos />}
      {activa === 'catalogos' && <TabCatalogos />}
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
