// Cubre: RF-002, RN-001
import { PencilLine, UserCheck, UserX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

/**
 * Columnas de la tabla de cuentas (P16).
 *
 * `PATCH /usuarios/{id}` corrige nombre y correo, no el rol: una cuenta no
 * cambia de parcela editándola. El servidor aplica además la parcela del rol,
 * así que un Supervisor no puede tocar a un Directivo aunque falsee la petición.
 */
export default function columnasUsuarios({ baja, alta, editar, ocupado }) {
  return [
    { key: 'nombre', header: 'Usuario', sortable: true, className: 'font-medium text-ink-900' },
    { key: 'correo', header: 'Correo', sortable: true },
    { key: 'rol', header: 'Rol', render: (u) => <Badge tone="info">{u.rol}</Badge> },
    {
      key: 'activo',
      header: 'Estado',
      align: 'center',
      render: (u) => <Badge tone={u.activo ? 'success' : 'neutral'}>{u.activo ? 'Activa' : 'Inactiva'}</Badge>,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (u) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            iconLeft={PencilLine}
            aria-label={`Editar cuenta de ${u.nombre}`}
            disabled={ocupado}
            onClick={() => editar(u)}
          >
            Editar
          </Button>
          {u.activo ? (
          <Button
            size="sm"
            variant="ghost"
            iconLeft={UserX}
            aria-label={`Desactivar cuenta de ${u.nombre}`}
            disabled={ocupado}
            onClick={() => baja.mutate(u.id_usuario)}
            className="text-danger-600"
          >
            Desactivar
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            iconLeft={UserCheck}
            aria-label={`Reactivar cuenta de ${u.nombre}`}
            disabled={ocupado}
            onClick={() => alta.mutate(u.id_usuario)}
          >
            Reactivar
          </Button>
          )}
        </div>
      ),
    },
  ]
}
