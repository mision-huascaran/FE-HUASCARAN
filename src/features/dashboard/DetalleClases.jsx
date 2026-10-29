// El detalle por grado, sección y clase de un colegio (CU033, paso 8).
//
// Una fila por clase, con "su fecha efectiva, cantidad de alumnos de la lista
// histórica, presentes, tardanzas, ausentes, alumnos sin marcar y porcentaje de
// asistencia". Tres cosas que vienen del CU y no de la comodidad:
//
//  · LA FECHA ES LA EFECTIVA DE REALIZACIÓN, no la de registro ni la de
//    sincronización. Una clase reprogramada se cuenta una sola vez, en su fecha
//    vigente.
//  · "SIN REGISTRO" ES OTRA COSA QUE "0 %". Esas clases van en su propia tabla,
//    sin porcentaje y sin ausencias: nadie las registró, no es que nadie fuera.
//  · AL PULSAR UNA CLASE SE ABRE CU022 EN CONSULTA, con los filtros
//    precargados. Por eso el enlace lleva colegio, grado, sección y fecha en la
//    URL (ver `features/asistencia/useFiltrosAsistencia.js`): sin ellos, el
//    Supervisor aterrizaría en el aula que miró la última vez.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Select from '../../components/ui/Select'
import { obtenerClasesDeAsistencia } from '../../api/resources/dashboard'
import { formatearFecha } from '../../lib/format'
import BloqueDashboard from './BloqueDashboard'
import { etiquetaDeEstado, formatearPorcentaje } from './estados'

/** La URL que abre CU022 en consulta con el contexto de esta clase. */
const enlaceDeClase = (colegio, clase) => {
  const parametros = new URLSearchParams({
    colegio: String(colegio.id_colegio),
    fecha: clase.fecha,
  })
  if (clase.grado?.id) parametros.set('grado', String(clase.grado.id))
  if (clase.seccion?.id) parametros.set('seccion', String(clase.seccion.id))
  return `/asistencia?${parametros.toString()}`
}

export default function DetalleClases({ filtros, colegio, periodo, contexto, onVolver }) {
  const [idGrado, setIdGrado] = useState('')

  const consulta = useQuery({
    queryKey: ['dashboard', 'asistencia-clases', filtros, colegio.id_colegio, idGrado],
    queryFn: () => obtenerClasesDeAsistencia(filtros, { idColegio: colegio.id_colegio, idGrado: idGrado || undefined }),
    enabled: Boolean(filtros),
  })

  // Dos listas desde el servidor: las sin registro no traen conteos.
  const registradas = consulta.data?.clases ?? []
  const sinRegistro = consulta.data?.clases_sin_registro ?? []
  const grados = consulta.data?.grados ?? []

  return (
    <BloqueDashboard
      titulo={`Asistencia por grado y sección · ${colegio.nombre}`}
      contexto={[...contexto, periodo?.nombre].filter(Boolean)}
      consulta={consulta}
      vacio={Boolean(consulta.data) && registradas.length === 0 && sinRegistro.length === 0}
      acciones={
        <Button size="sm" variant="ghost" iconLeft={ArrowLeft} onClick={onVolver}>
          Volver al resumen
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {grados.length > 1 && (
          <div className="max-w-[200px]">
            <Select
              label="Grado"
              placeholder="Todos"
              value={idGrado}
              options={grados.map((g) => ({ value: g.id, label: g.nombre }))}
              onChange={(e) => setIdGrado(e.target.value)}
            />
          </div>
        )}

        <DataTable
          paginated={false}
          rows={registradas}
          getRowId={(c) => c.id_clase}
          columns={[
            { key: 'fecha', header: 'Fecha efectiva', render: (c) => formatearFecha(c.fecha) },
            { key: 'grado', header: 'Grado', render: (c) => c.grado?.nombre ?? '—' },
            { key: 'seccion', header: 'Sección', render: (c) => c.seccion?.nombre ?? '—' },
            { key: 'alumnos', header: 'Alumnos', align: 'right', render: (c) => c.alumnos ?? '—' },
            { key: 'presentes', header: 'Presentes', align: 'right' },
            { key: 'tardanzas', header: 'Tardanzas', align: 'right' },
            { key: 'ausentes', header: 'Ausentes', align: 'right' },
            { key: 'sin_marcar', header: 'Sin marcar', align: 'right', render: (c) => c.sin_marcar ?? 0 },
            {
              key: 'porcentaje',
              header: 'Asistencia',
              align: 'right',
              render: (c) => formatearPorcentaje(c.porcentaje),
            },
            {
              key: 'estado',
              header: '',
              render: (c) => {
                const aviso = etiquetaDeEstado(c)
                return aviso ? <Badge tone="warning">{aviso}</Badge> : null
              },
            },
            {
              key: 'acciones',
              header: '',
              render: (c) => (
                <Link
                  to={enlaceDeClase(colegio, c)}
                  className="text-xs font-semibold text-brand-600 hover:underline"
                >
                  Ver asistencia
                </Link>
              ),
            },
          ]}
          footNote="Los alumnos son los de la lista histórica de cada clase: un cambio posterior de grupo no traslada sus asistencias."
        />

        {sinRegistro.length > 0 && (
          <div className="rounded-lg border border-warning-600/30 bg-warning-100/40 p-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <CalendarX className="h-4 w-4 text-warning-600" aria-hidden />
              Clases programadas sin registro ({sinRegistro.length})
            </h4>
            <p className="mt-1 text-xs text-ink-700">
              Su fecha ya pasó y no tienen ninguna asistencia confirmada. No se consideran dictadas ni generan
              ausencias.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2 text-xs text-ink-700">
              {sinRegistro.map((c) => (
                <li key={`${c.fecha}-${c.grado?.id}-${c.seccion?.id}`} className="rounded border border-line bg-surface-0 px-2 py-1">
                  {formatearFecha(c.fecha)} · {c.grado?.nombre} {c.seccion?.nombre}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </BloqueDashboard>
  )
}
