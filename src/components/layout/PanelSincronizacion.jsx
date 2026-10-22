import { CloudOff, RefreshCw } from 'lucide-react'
import Button from '../ui/Button'
import Drawer from '../ui/Drawer'
import EmptyState from '../ui/EmptyState'
import useSyncStore from '../../store/syncStore'
import { reintentarAhora } from '../../lib/colaOffline'
import AvisoConflictos from './AvisoConflictos'
import useRechazosStore from '../../store/rechazosStore'

/**
 * Detalle de la cola de envíos pendientes (RNF-001), que se abre desde el
 * SyncBadge de la barra superior (P2).
 *
 * La lista sale de la cola en IndexedDB: un envío por fila-semana, con los
 * intentos que lleva y el último error. "Reintentar ahora" pone los contadores a
 * cero y vuelve a procesarla.
 */
export default function PanelSincronizacion({ abierto, onCerrar }) {
  const { items, sincronizando, ultimaSincronizacion } = useSyncStore()
  // Los rechazos de Lectura, Rúbrica y Vuelo llegan aunque su pantalla esté cerrada.
  const hayRechazos = useRechazosStore((s) => s.rechazos.length > 0)

  return (
    <Drawer
      open={abierto}
      onClose={onCerrar}
      title="Envíos pendientes"
      subtitle={
        ultimaSincronizacion
          ? `Última sincronización: ${new Date(ultimaSincronizacion).toLocaleString('es-PE')}`
          : 'Los registros se guardan en el equipo y se envían apenas hay conexión'
      }
      footer={
        <>
          <Button variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
          <Button
            iconLeft={RefreshCw}
            loading={sincronizando}
            disabled={items.length === 0}
            onClick={reintentarAhora}
          >
            Reintentar ahora
          </Button>
        </>
      }
    >
      <AvisoConflictos />
      {items.length === 0 && !hayRechazos ? (
        <EmptyState
          title="Todo sincronizado"
          description="No hay registros esperando ser enviados al servidor."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.idOperacion ?? item.clave} className="rounded-lg border border-line bg-surface-50 p-3">
              <p className="text-sm font-semibold text-ink-900">{item.descripcion}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {item.intentos} {item.intentos === 1 ? 'intento' : 'intentos'} · {item.clave}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 flex items-start gap-2 rounded-lg bg-info-100 p-3 text-xs text-ink-700">
        <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />
        {/* Sin el código del requisito: quien usa la aplicación no tiene por
            qué leer "RNF-001" en pantalla. La conducta se explica igual. */}
        Si falla el envío, se reintenta solo unas cuantas veces. Nada se duplica y nada se pierde:
        los registros esperan aquí hasta que vuelva la conexión.
      </p>
    </Drawer>
  )
}
