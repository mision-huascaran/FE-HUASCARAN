// El detalle del aviso "Información incompleta" del consolidado de libros
// (CU034, Tanda O). Solo Supervisor.
//
// ANTES EL AVISO ERA UNA PALABRA SIN SALIDA: "Información incompleta" decía
// que algo faltaba, pero no QUÉ ni DÓNDE, y la única forma de averiguarlo era
// ir colegio por colegio y mes por mes comparando contra lo que ya se sabía
// incompleto. Este detalle lista la semana o la clase de referencia concreta
// que falta, con la MISMA regla que ya marca incompleto en `/dashboard/libros`.
//
// DOS MOTIVOS, Y NO SE CONFUNDEN:
//
//   · `sin_tabla` — la semana ya venció y no existe ninguna tabla. No hay
//     `id_lectura_semanal` que abrir: la clase de referencia puede incluso
//     no tener fila todavía (`id_clase` en null), aunque la fecha sí llega.
//   · `filas_pendientes` — la tabla existe, pero tiene filas "Pendiente". Esa
//     sí se puede abrir en Seguimiento de Lectura, en consulta.
//
// Se abre desde el resumen (sin acotar) o desde una celda concreta —un mes de
// un colegio, de un grado o de un alumno—, que es por lo que acepta un
// `scope` opcional: los mismos filtros de la vista, más `idColegio` (y
// `idGrado` o `idAlumno`) y el `anio`+`mes` de la celda pulsada.
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarX } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import { obtenerLibrosIncompletos } from '../../api/resources/dashboard'
import { formatearFecha } from '../../lib/format'
import BloqueDashboard from './BloqueDashboard'

/** "02/03/2026 al 06/03/2026". */
const textoDeSemana = (semana) => `${formatearFecha(semana.lunes)} al ${formatearFecha(semana.viernes)}`

const ETIQUETA_MOTIVO = {
  sin_tabla: 'Sin tabla',
  filas_pendientes: 'Filas pendientes',
}

/** El enlace a CU023 con el contexto de la fila, para abrirla en consulta. */
function enlaceDeFila(item) {
  const parametros = new URLSearchParams({
    colegio: String(item.colegio.id),
    grado: String(item.grado.id),
    subprograma: String(item.subprograma.id),
    mes: String(item.mes),
  })
  return `/seguimiento-lectura?${parametros.toString()}`
}

export default function DetalleLibrosIncompletos({ filtros, scope, contexto, onVolver }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'libros-incompletos', filtros, scope],
    queryFn: () => obtenerLibrosIncompletos(filtros, scope),
    enabled: Boolean(filtros),
  })

  const items = consulta.data ?? []
  const sinTabla = items.filter((i) => i.motivo === 'sin_tabla')
  const filasPendientes = items.filter((i) => i.motivo === 'filas_pendientes')

  return (
    <BloqueDashboard
      titulo="Información incompleta del consolidado de libros"
      contexto={contexto}
      consulta={consulta}
      vacio={Boolean(consulta.data) && items.length === 0}
      mensajeVacio="No hay semanas ni tablas pendientes para esta selección."
      acciones={
        <Button size="sm" variant="ghost" iconLeft={ArrowLeft} onClick={onVolver}>
          Volver al consolidado
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <DataTable
          rows={items}
          getRowId={(i) => `${i.colegio.id}-${i.grado.id}-${i.anio}-${i.mes}-${i.motivo}`}
          columns={[
            { key: 'colegio', header: 'Colegio', render: (i) => i.colegio.nombre },
            { key: 'grado', header: 'Grado', render: (i) => i.grado.nombre },
            { key: 'subprograma', header: 'Subprograma', render: (i) => i.subprograma.nombre },
            { key: 'semana', header: 'Semana', render: (i) => textoDeSemana(i.semana) },
            {
              key: 'motivo',
              header: 'Qué falta',
              render: (i) => (
                <span className="flex items-center gap-2">
                  <Badge tone={i.motivo === 'sin_tabla' ? 'warning' : 'neutral'}>
                    {ETIQUETA_MOTIVO[i.motivo] ?? i.motivo}
                  </Badge>
                  {/* "Con id_alumno sigue siendo el total de la tabla": el
                      número no se recorta a 1 cuando se acota por alumno. */}
                  {i.motivo === 'filas_pendientes' && i.filas_pendientes != null && (
                    <span className="text-xs text-ink-500">{i.filas_pendientes} alumnos</span>
                  )}
                </span>
              ),
            },
            {
              key: 'acciones',
              header: '',
              render: (i) =>
                i.motivo === 'filas_pendientes' ? (
                  <Link to={enlaceDeFila(i)} className="text-xs font-semibold text-brand-600 hover:underline">
                    Ver en Seguimiento de Lectura
                  </Link>
                ) : null,
            },
          ]}
          footNote="Es la misma regla que marca Información incompleta en el consolidado: si un mes, colegio, grado o alumno sale incompleto, aquí aparece al menos una fila suya."
        />

        {sinTabla.length > 0 && filasPendientes.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-ink-500">
            <CalendarX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {sinTabla.length} semana{sinTabla.length === 1 ? '' : 's'} sin tabla todavía, {filasPendientes.length}{' '}
            tabla{filasPendientes.length === 1 ? '' : 's'} con filas pendientes.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
