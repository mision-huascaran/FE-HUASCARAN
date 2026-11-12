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
import { Eye, History, WifiOff } from 'lucide-react'
import CeldaCierre from '../../components/actividades/CeldaCierre'
import CeldaFin from '../../components/actividades/CeldaFin'
import Badge from '../../components/ui/Badge'
import BarraDeFiltros, { CeldaFiltro } from '../../components/ui/BarraDeFiltros'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import DetalleSesion from './DetalleSesion'
import useFiltrosSesiones from './useFiltrosSesiones'
import {
  ETIQUETA_SINCRONIZACION,
  listarActividades,
} from '../../api/resources/actividades'
import { mensajeDeError } from '../../api/client'
import { formatearFecha, formatearHora } from '../../lib/format'
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

const TONO_SINCRONIZACION = { sincronizada: 'success', pendiente: 'warning', error: 'danger' }

/** Encabezado que puede partirse en dos líneas (el de DataTable no se parte). */
const ENCABEZADO_LARGO = '!whitespace-normal'

/**
 * Segundos a "1 h 25 min", que es como se lee una jornada.
 *
 * Se redondea el TOTAL de minutos y después se reparte en horas: redondear
 * solo el resto daba "7 h 60 min" para una actividad de 7 h 59 min 40 s.
 */
export function duracion(segundos) {
  if (segundos == null) return '—'
  const totalMinutos = Math.round(segundos / 60)
  const horas = Math.floor(totalMinutos / 60)
  const minutos = totalMinutos % 60
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
            description="Conéctate a internet para consultar tu historial de sesiones."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Sesiones</h1>
        <p className="mt-1 text-sm text-ink-500">Tu historial de actividades de trabajo.</p>
      </header>

      <Card padded={false}>
        {/* Se busca al pulsar, no al teclear: el caso de uso lo pide así y
            además evita una petición por cada cambio de filtro. */}
        <BarraDeFiltros
          filtrarDeshabilitado={rangoInvalido}
          onFiltrar={() => setBuscados(filtros)}
          onLimpiar={() => {
            limpiar()
            setBuscados({})
          }}
        >
          <CeldaFiltro>
            <Input
              label="Desde"
              type="date"
              value={filtros.desde}
              error={rangoInvalido ? 'El rango de fechas no es válido' : undefined}
              onChange={(e) => cambiar('desde', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Input label="Hasta" type="date" value={filtros.hasta} onChange={(e) => cambiar('hasta', e.target.value)} />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select label="Estado" placeholder="Todos" vacioElegible value={filtros.estado} options={ESTADOS} onChange={(e) => cambiar('estado', e.target.value)} />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Sincronización"
              placeholder="Todos"
              vacioElegible
              value={filtros.sincronizacion}
              options={SINCRONIZACIONES}
              onChange={(e) => cambiar('sincronizacion', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Tipo de cierre"
              placeholder="Todos"
              vacioElegible
              value={filtros.tipo_cierre}
              options={CIERRES}
              onChange={(e) => cambiar('tipo_cierre', e.target.value)}
            />
          </CeldaFiltro>
        </BarraDeFiltros>
      </Card>

      <Card padded={false}>

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
                description="Cuando inicies una actividad de trabajo aparecerá aquí."
              />
            }
            columns={[
              /*
               * Los encabezados largos pueden ir en dos líneas (ENCABEZADO_LARGO):
               * con "Ver detalle" y la duración en una sola (N007), la tabla
               * se salía de una pantalla de 1366 px por culpa de títulos como
               * "Estado de sincronización" sobre celdas de una palabra.
               */
              // dd/mm/aaaa, y en Inicio y Fin SOLO LA HORA, como pide CU017: la
              // fecha ya está en su columna (auditoría de UX #737, U15).
              { key: 'fecha', header: 'Fecha', render: (s) => formatearFecha(s.fecha) },
              { key: 'inicio', header: 'Hora de inicio', render: (s) => formatearHora(s.inicio) },
              { key: 'fin', header: 'Hora de finalización', headerClassName: ENCABEZADO_LARGO, render: (s) => <CeldaFin sesion={s} /> },
              {
                key: 'duracion_segundos',
                header: 'Duración',
                // "8 h 0 min" en una línea: partido en dos se lee como dos datos.
                className: 'whitespace-nowrap',
                render: (s) => duracion(s.duracion_segundos),
              },
              { key: 'cambios', header: 'Cantidad de cambios', headerClassName: ENCABEZADO_LARGO, align: 'center' },
              {
                /*
                 * SIN columna "Estado de la actividad": la dice "Hora de
                 * finalización". Una fila con hora está terminada y una sin
                 * ella sigue abierta, asi que el badge repetía el dato de la
                 * celda de al lado y gastaba el ancho que necesitaban las
                 * demás. El estado completo sigue en "Ver detalle", y el
                 * filtro "Estado" de arriba no se toca: filtrar por algo no
                 * obliga a darle una columna.
                 *
                 * Esta sí es aparte (CU017): sincronización y estado son dos
                 * cosas distintas, y mezclarlas oculta las sesiones sin
                 * sincronizar.
                 */
                key: 'sincronizacion',
                header: 'Estado de sincronización',
                headerClassName: ENCABEZADO_LARGO,
                render: (s) => (
                  <Badge tone={TONO_SINCRONIZACION[s.sincronizacion] ?? 'neutral'}>
                    {ETIQUETA_SINCRONIZACION[s.sincronizacion] ?? s.sincronizacion}
                  </Badge>
                ),
              },
              {
                key: 'tipo_cierre',
                header: 'Tipo de cierre',
                /*
                 * Una palabra, y el motivo entero a un toque. El texto largo
                 * se repetia en casi todas las filas ocupando tres lineas:
                 * una columna donde todo se lee igual deja de ayudar a
                 * encontrar la fila distinta, que es a lo que se viene.
                 */
                render: (s) => <CeldaCierre tipo={s.tipo_cierre} />,
              },
              {
                // N007 — Igual que en Seguimiento, Usuarios y Colegios: columna
                // "Acciones", ojo y en una sola línea.
                key: 'acciones',
                header: 'Acciones',
                align: 'center',
                render: (s) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={Eye}
                    className="whitespace-nowrap"
                    aria-label={`Ver detalle de la actividad del ${formatearFecha(s.fecha)} a las ${formatearHora(s.inicio)}`}
                    onClick={() => setAbierta(s)}
                  >
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
