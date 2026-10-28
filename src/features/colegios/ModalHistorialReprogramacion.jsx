// El historial de traslados de una clase (CU013).
//
// Se conserva ENTERO. Una clase puede reprogramarse varias veces, y cada
// traslado deja su fila con quién lo hizo, cuándo y por qué. Modificar una
// reprogramación NO sobrescribe la anterior: eso es lo que permite auditar
// después por qué una clase acabó donde acabó.
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import { listarReprogramaciones } from '../../api/resources/clases'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'

const comoFecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')

export default function ModalHistorialReprogramacion({ clase, onCerrar, onModificar }) {
  const consulta = useQuery({
    queryKey: ['reprogramaciones', clase?.id_clase],
    queryFn: () => listarReprogramaciones(clase.id_clase),
    enabled: Boolean(clase?.id_clase),
  })

  // Siempre una lista: un `null` aquí tiraría la pantalla al error genérico.
  const historial = Array.isArray(consulta.data) ? consulta.data : []

  return (
    <Modal
      open={Boolean(clase)}
      onClose={onCerrar}
      title="Reprogramaciones de la clase"
      subtitle={clase ? `${clase.grado?.nombre ?? ''} · ${clase.seccion?.nombre ?? ''}` : ''}
      size="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
          {/* Vuelve a abrir el flujo de traslado. Las validaciones son las
              mismas y el historial anterior no se toca. */}
          <Button onClick={() => onModificar(clase)}>Modificar reprogramación</Button>
        </>
      }
    >
      {consulta.isLoading && <Skeleton className="h-28 w-full" />}

      {consulta.isError && (
        <EmptyState title="No se pudo cargar el historial" description={mensajeDeError(consulta.error)} />
      )}

      {!consulta.isLoading && !consulta.isError && historial.length === 0 && (
        <EmptyState icon={History} title="Sin traslados registrados" description="Esta clase conserva su fecha original." />
      )}

      {historial.length > 0 && (
        <ol className="flex flex-col gap-3">
          {historial.map((t) => (
            <li key={t.id} className="rounded-lg border border-line px-3 py-2">
              <p className="text-sm font-medium text-ink-900">
                {comoFecha(t.fecha_anterior)} → {comoFecha(t.fecha_nueva)}
              </p>
              <p className="mt-0.5 text-sm text-ink-700">{t.motivo}</p>
              <p className="mt-1 text-xs text-ink-500">
                {t.usuario?.nombre ?? 'Supervisor'} · {formatearFechaHora(t.fecha)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
