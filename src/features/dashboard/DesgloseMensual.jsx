// El desglose de una cantidad mensual de un alumno (CU034, paso 8).
//
// "El sistema muestra el desglose de los registros que componen ese valor,
// indicando la clase de referencia, su fecha, el subprograma y las cantidades
// registradas. Desde cada elemento puede acceder al registro correspondiente de
// Seguimiento de Lectura, en modo consulta."
//
// Y el flujo alternativo que casi se olvida: SI EL DETALLE YA NO CUADRA CON EL
// TOTAL de la consulta mostrada, hay que decirlo y NO mezclarlos. Puede pasar
// perfectamente: entre la consulta del consolidado y la apertura del detalle, el
// servidor pudo aceptar la sincronización de un docente. Sumar el detalle nuevo
// bajo el total viejo daría una pantalla que no cuadra consigo misma.
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import { obtenerDesgloseDeLibros } from '../../api/resources/dashboard'
import { formatearFecha } from '../../lib/format'
import { ERROR_CONSULTA, SIN_INFORMACION } from './estados'

export const CAMBIO_DESDE_LA_CONSULTA =
  'La información ha cambiado desde tu última consulta. Actualiza el consolidado para ver los valores vigentes.'

/**
 * `filtros` son los de la consulta APLICADA del consolidado, no el borrador:
 * el backend busca al alumno en esos colegios, y el total con el que se
 * compara es el de esa consulta.
 */
export default function DesgloseMensual({ alumno, mes, filtros, onActualizar, onCerrar }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'libros-desglose', filtros, alumno?.id_alumno, mes?.mes, mes?.anio],
    queryFn: () => obtenerDesgloseDeLibros(filtros, { idAlumno: alumno.id_alumno, mes: mes.mes, anio: mes.anio }),
    enabled: Boolean(alumno && mes),
  })

  const items = consulta.data?.items ?? []
  // El total que trae el detalle frente al que se pintó en la celda.
  const cambio = consulta.data?.total != null && consulta.data.total !== mes?.cantidad

  return (
    <Modal
      open
      onClose={onCerrar}
      title={`Libros de ${alumno?.nombre} · ${mes?.nombre}`}
      subtitle="Registros de Seguimiento de Lectura que componen esa cantidad."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      }
    >
      {consulta.isLoading && <Skeleton className="h-28 w-full" />}

      {consulta.isError && (
        <EmptyState
          icon={AlertTriangle}
          title={ERROR_CONSULTA}
          action={
            <Button variant="outline" iconLeft={RefreshCw} onClick={() => consulta.refetch()}>
              Reintentar
            </Button>
          }
        />
      )}

      {!consulta.isLoading && !consulta.isError && (
        <div className="flex flex-col gap-3">
          {cambio && (
            <div className="rounded-lg border border-warning-600/30 bg-warning-100/40 p-3">
              <p className="text-sm text-ink-900">{CAMBIO_DESDE_LA_CONSULTA}</p>
              {onActualizar && (
                <Button className="mt-2" size="sm" variant="outline" iconLeft={RefreshCw} onClick={onActualizar}>
                  Actualizar consolidado
                </Button>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState title={SIN_INFORMACION} description="No hay registros que compongan esa cantidad." />
          ) : (
            <DataTable
              paginated={false}
              rows={items}
              getRowId={(i) => i.id_lectura_semanal}
              columns={[
                {
                  key: 'clase',
                  header: 'Clase de referencia',
                  render: (i) => formatearFecha(i.clase?.fecha),
                },
                { key: 'subprograma', header: 'Subprograma', render: (i) => i.subprograma ?? '—' },
                {
                  key: 'subir',
                  header: 'Para subir de nivel',
                  align: 'right',
                  render: (i) => i.libros_subir_nivel ?? SIN_INFORMACION,
                },
                {
                  key: 'libre',
                  header: 'Selección libre',
                  align: 'right',
                  // Un LSL nulo no suma; un 0 sí es un 0 confirmado.
                  render: (i) => (i.libros_seleccion_libre == null ? SIN_INFORMACION : i.libros_seleccion_libre),
                },
                {
                  key: 'estado',
                  header: '',
                  // "No realizada" aporta 0 mientras la declaración siga
                  // vigente: es un cero confirmado, no un hueco.
                  render: (i) => (i.no_realizada ? <Badge tone="warning">No realizada · aporta 0</Badge> : null),
                },
                {
                  key: 'acciones',
                  header: '',
                  render: (i) => (
                    <Link
                      to={`/seguimiento-lectura?tabla=${i.id_lectura_semanal}`}
                      className="text-xs font-semibold text-brand-600 hover:underline"
                    >
                      Ver registro
                    </Link>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  )
}
