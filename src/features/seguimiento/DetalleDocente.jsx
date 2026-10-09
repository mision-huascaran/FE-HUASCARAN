// CU021 — Bitácora de un docente, vista por el Supervisor.
//
// Sin pestañas a propósito: el caso de uso pide la cabecera y, justo debajo,
// la tabla de sesiones de la más reciente a la más antigua.
//
// Los ATAJOS llevan al módulo operativo con los filtros del docente y la fecha
// ya puestos, siempre en SOLO LECTURA. Hoy esos módulos (las grillas) no
// existen en el backend, así que se muestran deshabilitados en vez de llevar a
// una pantalla vacía que parecería un error.
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, History } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import { listarActividadesDe } from '../../api/resources/seguimiento'
import { ETIQUETA_SINCRONIZACION, etiquetaTipoCierre } from '../../api/resources/actividades'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'

/** Iniciales para el avatar, que se genera en el cliente. */
const iniciales = (docente) =>
  [docente.nombres, docente.apellidos]
    .filter(Boolean)
    .map((p) => p.trim()[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export default function DetalleDocente({ docente, onVolver }) {
  const consulta = useQuery({
    queryKey: ['seguimiento', 'actividades', docente.id_docente],
    queryFn: () => listarActividadesDe(docente.id_docente),
  })

  const nombre = [docente.nombres, docente.apellidos].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" iconLeft={ArrowLeft} onClick={onVolver} className="self-start">
        Volver al seguimiento
      </Button>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-base font-bold text-white"
            >
              {iniciales(docente)}
            </span>
            <h1 className="text-xl font-bold text-ink-900 md:text-2xl">{nombre}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(docente.colegios ?? []).map((c) => (
              <Badge key={c.id} tone="neutral">
                {c.nombre}
              </Badge>
            ))}
            <Badge tone={docente.sincronizacion === 'pendiente' ? 'warning' : 'success'}>
              {ETIQUETA_SINCRONIZACION[docente.sincronizacion] ?? docente.sincronizacion}
            </Badge>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        {consulta.isError ? (
          <EmptyState title="No se pudo cargar la bitácora" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data?.items ?? []}
            getRowId={(s) => s.id}
            empty={
              <EmptyState
                icon={History}
                title="Sin sesiones registradas"
                description="Este docente todavía no ha iniciado ninguna actividad."
              />
            }
            columns={[
              { key: 'fecha', header: 'Fecha' },
              { key: 'inicio', header: 'Inicio', render: (s) => formatearFechaHora(s.inicio) },
              { key: 'fin', header: 'Fin', render: (s) => (s.fin ? formatearFechaHora(s.fin) : 'No aplica') },
              { key: 'tipo_cierre', header: 'Tipo de cierre', render: (s) => etiquetaTipoCierre(s.tipo_cierre) },
              {
                key: 'productividad_texto',
                header: 'Productividad',
                render: (s) => s.productividad_texto || 'Sin registros',
              },
              {
                key: 'atajos',
                header: 'Atajos',
                render: (s) => (
                  <div className="flex flex-wrap gap-1">
                    {(s.productividad ?? []).map((p) => (
                      <Button
                        key={p.modulo}
                        size="sm"
                        variant="ghost"
                        disabled
                        title="El módulo de captura todavía no está disponible"
                      >
                        Ver {p.modulo}
                      </Button>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
