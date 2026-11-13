// El cambio de una fila que todavía no confirma el servidor (RNF-001, D123).
//
// Lo marca `conPendientes` (lib/registrosOffline) en las filas cuyo envío
// sigue en la cola: "Pendiente de sincronizar" mientras espera y "Error al
// sincronizar" si el último intento falló y queda reintentando. La fila
// muestra el valor NUEVO; esto avisa de que aún no es firme.
import { CloudOff, RefreshCw } from 'lucide-react'
import { SINCRONIZACION } from '../../lib/registrosOffline'

export default function EstadoSincronizacion({ estado }) {
  if (!estado) return null
  const conError = estado === SINCRONIZACION.ERROR
  const Icono = conError ? CloudOff : RefreshCw
  return (
    <span
      title={conError ? 'El último envío falló; se reintentará.' : 'Guardado en este dispositivo; falta enviarlo al servidor.'}
      className={`mt-1 flex items-center gap-1 text-xs font-medium ${conError ? 'text-danger-600' : 'text-warning-600'}`}
    >
      <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {conError ? 'Error al sincronizar' : 'Pendiente de sincronizar'}
    </span>
  )
}
