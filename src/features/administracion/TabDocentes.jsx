// Cubre: RF-002, RN-001
import { useQuery } from '@tanstack/react-query'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import { listarDocentes } from '../../api/resources/administracion'

/**
 * Docentes con cuenta en el sistema y los colegios que tienen en el periodo
 * vigente. TODO: el alta y la baja de usuarios dependen de "Registro y gestión
 * de usuarios", que el backend lista como pendiente (APIS_BACKEND.md).
 */
export default function TabDocentes() {
  const { data = [], isLoading } = useQuery({ queryKey: ['admin', 'docentes'], queryFn: listarDocentes })

  return (
    <Card title="Docentes" subtitle="Cuentas de rol Profesor y sus colegios en el periodo vigente" padded={false}>
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
        ]}
      />
    </Card>
  )
}
