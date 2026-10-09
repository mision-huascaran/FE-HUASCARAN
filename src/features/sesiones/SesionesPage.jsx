// CU017, CU018 y CU019 — Módulo de Sesiones del Docente.
//
// En la interfaz se llaman "Sesiones"; en la API son ACTIVIDADES. El "ID de
// sesión" del caso de uso es el `id` de la actividad.
//
// Tres reglas del caso de uso que condicionan esta pantalla:
//
//   · SOLO EL DOCENTE, y solo sus propias sesiones. El Supervisor ya no entra
//     aquí: para vigilar a su equipo tiene Seguimiento (CU020, CU021).
//   · ESTRICTAMENTE EN LÍNEA. Sin conexión no se muestra nada de la memoria
//     local: un histórico viejo haría creer que así está el servidor.
//   · El estado de la sesión y el de sincronización son INDEPENDIENTES: una
//     sesión puede estar Finalizada y a la vez Pendiente de sincronizar.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, WifiOff } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DetalleSesion from './DetalleSesion'
import useFiltrosSesiones from './useFiltrosSesiones'
import {
  ETIQUETA_ESTADO,
  ETIQUETA_SINCRONIZACION,
  etiquetaTipoCierre,
  listarActividades,
} from '../../api/resources/actividades'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'
import useConexion from '../../hooks/useConexion'

const ESTADOS = [
  { value: 'en_curso', label: 'En curso' },
  { value: 'finalizada', label: 'Finalizada' },
]

const SINCRONIZACIONES = [
  { value: 'sincronizada', label: 'Sincronizada' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'error', label: 'Error' },
]

const CIERRES = [
  { value: 'Manual por finalización de actividad', label: 'Manual' },
  { value: 'Forzado por cierre de sesión', label: 'Forzado por cierre de sesión' },
  { value: 'Automático por expiración de sesión', label: 'Automático por expiración' },
]

const TONO_ESTADO = { en_curso: 'info', finalizada: 'neutral' }
const TONO_SINCRONIZACION = { sincronizada: 'success', pendiente: 'warning', error: 'danger' }

/** Segundos a "1 h 25 min", que es como se lee una jornada. */
function duracion(segundos) {
  if (segundos == null) return '—'
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.round((segundos % 3600) / 60)
  return horas ? `${horas} h ${minutos} min` : `${minutos} min`
}

export default function SesionesPage() {
  const enLinea = useConexion()
  const { filtros, cambiar, limpiar, rangoInvalido } = useFiltrosSesiones()
  const [buscados, setBuscados] = useState(filtros)
  const [abierta, setAbierta] = useState(null)

  const consulta = useQuery({
    queryKey: ['actividades', buscados],
    queryFn: () => listarActividades(buscados),
    // Sin conexión ni se intenta: este módulo no tiene respaldo local.
    enabled: enLinea,
  })

  if (!enLinea) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Sesiones</h1>
        </header>
        <Card>
          <EmptyState
            icon={WifiOff}
            title="Módulo no disponible sin conexión"
            description="Conéctese a internet para consultar su historial de sesiones."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Sesiones</h1>
        <p className="mt-1 text-sm text-ink-500">Su historial de actividades de trabajo.</p>
      </header>

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <Input
            label="Desde"
            type="date"
            value={filtros.desde}
            error={rangoInvalido ? 'El rango de fechas no es válido' : undefined}
            onChange={(e) => cambiar('desde', e.target.value)}
          />
          <Input label="Hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
          <Select label="Estado" placeholder="Todos" value={filtros.estado} options={ESTADOS} onChange={(e) => cambiar('estado', e.target.value)} />
          <Select
            label="Sincronización"
            placeholder="Todos"
            value={filtros.sincronizacion}
            options={SINCRONIZACIONES}
            onChange={(e) => cambiar('sincronizacion', e.target.value)}
          />
          <Select
            label="Tipo de cierre"
            placeholder="Todos"
            value={filtros.tipo_cierre}
            options={CIERRES}
            onChange={(e) => cambiar('tipo_cierre', e.target.value)}
          />
          {/* Se busca al pulsar, no al teclear: el caso de uso lo pide así y
              además evita una petición por cada cambio de filtro. */}
          <Button disabled={rangoInvalido} onClick={() => setBuscados(filtros)}>
            Buscar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              limpiar()
              setBuscados({})
            }}
          >
            Limpiar filtros
          </Button>
        </div>

        {consulta.isError ? (
          <EmptyState title="No se pudo obtener el historial de sesiones" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data?.items ?? []}
            getRowId={(s) => s.id}
            empty={
              <EmptyState
                icon={History}
                title="No existen sesiones para consultar"
                description="Cuando inicie una actividad de trabajo aparecerá aquí."
              />
            }
            columns={[
              { key: 'fecha', header: 'Fecha' },
              { key: 'inicio', header: 'Inicio', render: (s) => formatearFechaHora(s.inicio) },
              // En curso, el caso de uso pide "No aplica", no una celda vacía.
              { key: 'fin', header: 'Fin', render: (s) => (s.fin ? formatearFechaHora(s.fin) : 'No aplica') },
              { key: 'duracion_segundos', header: 'Duración', render: (s) => duracion(s.duracion_segundos) },
              { key: 'cambios', header: 'Cambios', align: 'center' },
              {
                key: 'estado',
                header: 'Estado',
                render: (s) => <Badge tone={TONO_ESTADO[s.estado] ?? 'neutral'}>{ETIQUETA_ESTADO[s.estado] ?? s.estado}</Badge>,
              },
              {
                // Columna aparte del estado a propósito (CU017): son dos cosas
                // distintas y mezclarlas oculta las sesiones sin sincronizar.
                key: 'sincronizacion',
                header: 'Sincronización',
                render: (s) => (
                  <Badge tone={TONO_SINCRONIZACION[s.sincronizacion] ?? 'neutral'}>
                    {ETIQUETA_SINCRONIZACION[s.sincronizacion] ?? s.sincronizacion}
                  </Badge>
                ),
              },
              { key: 'tipo_cierre', header: 'Tipo de cierre', render: (s) => etiquetaTipoCierre(s.tipo_cierre) },
              {
                key: 'acciones',
                header: '',
                render: (s) => (
                  <Button size="sm" variant="ghost" onClick={() => setAbierta(s)}>
                    Ver detalle
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <DetalleSesion sesion={abierta} onCerrar={() => setAbierta(null)} />
    </div>
  )
}
