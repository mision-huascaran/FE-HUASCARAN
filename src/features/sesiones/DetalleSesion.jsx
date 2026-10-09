// CU019 — Detalle de una sesión (actividad) del Docente. Solo lectura.
//
// El backend ya no devuelve una lista de cambios campo a campo: devuelve el
// RESUMEN agrupado por módulo (`cambios_por_modulo`) y las asignaciones
// implicadas. Es mejor así: lo que el caso de uso pide es saber cuánto se hizo
// y dónde, no auditar valor por valor, que es trabajo del historial del alumno.
//
// Estrictamente en línea: sin conexión no se busca nada en la memoria local.
import { useQuery } from '@tanstack/react-query'
import { History, WifiOff } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import { ETIQUETA_ESTADO, ETIQUETA_SINCRONIZACION, etiquetaTipoCierre, obtenerActividad } from '../../api/resources/actividades'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'
import useConexion from '../../hooks/useConexion'

const ETIQUETA_MODULO = {
  rubrica: 'Rúbrica',
  seguimiento_lectura: 'Seguimiento de Lectura',
  registro_vuelo: 'Registro de Vuelo',
  alumnos: 'Alumnos',
  asistencia: 'Asistencia',
  otros: 'Otros',
}

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children ?? '—'}</dd>
    </div>
  )
}

export default function DetalleSesion({ sesion, onCerrar }) {
  const enLinea = useConexion()

  const consulta = useQuery({
    queryKey: ['actividades', 'detalle', sesion?.id],
    queryFn: () => obtenerActividad(sesion.id),
    enabled: Boolean(sesion) && enLinea,
  })

  const d = consulta.data

  return (
    <Modal
      open={Boolean(sesion)}
      onClose={onCerrar}
      title="Detalle de la sesión"
      subtitle={sesion?.id}
      footer={<Button variant="ghost" onClick={onCerrar}>Cerrar</Button>}
    >
      {!enLinea && (
        <EmptyState
          icon={WifiOff}
          title="Detalle no disponible sin conexión"
          description="Conéctese a internet para visualizar la información de esta sesión."
        />
      )}

      {enLinea && consulta.isError && (
        <EmptyState title="No se pudo obtener la información de la sesión" description={mensajeDeError(consulta.error)} />
      )}

      {enLinea && !consulta.isError && (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Dato etiqueta="Fecha">{d?.fecha}</Dato>
            <Dato etiqueta="Inicio">{d?.inicio && formatearFechaHora(d.inicio)}</Dato>
            {/* En curso: el caso de uso pide "No aplica", no una celda vacía. */}
            <Dato etiqueta="Fin">{d?.fin ? formatearFechaHora(d.fin) : 'No aplica'}</Dato>
            <Dato etiqueta="Estado">
              {d?.estado && <Badge tone={d.estado === 'en_curso' ? 'info' : 'neutral'}>{ETIQUETA_ESTADO[d.estado] ?? d.estado}</Badge>}
            </Dato>
            <Dato etiqueta="Tipo de cierre">{etiquetaTipoCierre(d?.tipo_cierre)}</Dato>
            <Dato etiqueta="Sincronización">
              {d?.sincronizacion && (
                <Badge tone={d.sincronizacion === 'sincronizada' ? 'success' : 'warning'}>
                  {ETIQUETA_SINCRONIZACION[d.sincronizacion] ?? d.sincronizacion}
                </Badge>
              )}
            </Dato>
            <Dato etiqueta="Última sincronización">{d?.sincronizado_en && formatearFechaHora(d.sincronizado_en)}</Dato>
            <Dato etiqueta="Registros pendientes">{d?.registros_pendientes ?? 0}</Dato>
            <Dato etiqueta="Cambios">{d?.cambios ?? 0}</Dato>
          </dl>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-900">Cambios por módulo</h3>
            <DataTable
              loading={consulta.isLoading}
              rows={d?.cambios_por_modulo ?? []}
              getRowId={(c) => c.modulo}
              paginated={false}
              empty={
                <EmptyState
                  icon={History}
                  title="Sin cambios en esta sesión"
                  description="La sesión se abrió, pero no se registró ninguna modificación."
                />
              }
              columns={[
                { key: 'modulo', header: 'Módulo', render: (c) => ETIQUETA_MODULO[c.modulo] ?? c.modulo },
                { key: 'total', header: 'Total', align: 'center' },
                { key: 'creados', header: 'Creados', align: 'center' },
                { key: 'editados', header: 'Editados', align: 'center' },
                { key: 'activados', header: 'Activados', align: 'center' },
                { key: 'inactivados', header: 'Inactivados', align: 'center' },
              ]}
            />
          </div>

          {Boolean(d?.asignaciones?.length) && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Asignaciones involucradas</h3>
              <ul className="flex flex-col gap-1 text-sm text-ink-700">
                {d.asignaciones.map((a) => (
                  <li key={`${a.colegio?.id}-${a.grado?.id}`}>
                    {a.colegio?.nombre} · {a.grado?.nombre}
                    {a.ciclo ? ` · Ciclo ${a.ciclo}` : ''}
                    {a.seccion ? ` · Sección ${a.seccion}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
