// La tabla de lectura de una semana, con su cabecera de contexto (CU024, CU026).
//
// La cabecera no es decorativa: dice de qué CLASE son estas filas. La tabla se
// ata a una clase de referencia de la semana, y si no se dijera cuál, dos
// tablas distintas de la misma semana se verían idénticas.
import { CalendarClock, Ban, CalendarCog, Undo2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import FilaLectura from './FilaLectura'
import HistorialDeclaraciones from './HistorialDeclaraciones'

const FECHA = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const comoFecha = (iso) => (iso ? FECHA.format(new Date(`${iso}T12:00:00`)) : '—')

const ETIQUETA_CLASE = {
  habitual: 'Clase programada',
  adicional: 'Clase adicional',
}

export default function TablaLectura({
  tabla,
  soloLectura,
  onGuardarFila,
  onObservar,
  onNoRealizada,
  onHabilitarRegistro,
  onCambiarClase,
  marcando,
  habilitando,
  sinConexion,
}) {
  const bloqueada = tabla.estado === 'no_realizada'
  const clase = tabla.clase_referencia ?? {}
  const pendientes = tabla.filas.filter((f) => f.estado_fila === 'pendiente').length

  /**
   * ¿Se puede cambiar la clase de referencia? (B6)
   *
   * Solo mientras la tabla NO TENGA DATOS DE LECTURA: cambiarla rehace las
   * filas con la lista de la clase nueva, y con libros dentro eso sería
   * perderlos. El servidor lo rechaza con 409 `tabla_con_datos`, pero
   * enseñar el botón para que lo rechace es peor que no enseñarlo.
   *
   * Las observaciones NO cuentan como datos de lectura, igual que para
   * "no realizada".
   */
  const conLecturas = tabla.filas.some((f) => f.total_libros > 0 || f.lsn_titulo || f.cantidad_lsl > 0)
  const puedeCambiarClase = !soloLectura && !bloqueada && !conLecturas && !sinConexion

  return (
    <Card
      padded={false}
      title={`${tabla.filas.length} alumno${tabla.filas.length === 1 ? '' : 's'}`}
      actions={
        /*
         * "No realizada" es una acción de la SEMANA, no de una fila, y solo
         * tiene sentido mientras no haya libros guardados: el servidor la
         * rechaza si los hay, porque marcarla borraría el sentido de lo que ya
         * se registró.
         */
        !soloLectura ? (
          <span className="flex flex-col items-end gap-1">
            {/*
              Con la tabla declarada "no realizada" la única acción posible es
              deshacerla (CU026): marcarla otra vez no tendría sentido y
              registrar está bloqueado hasta que el servidor confirme.
            */}
            {bloqueada ? (
              <Button variant="secondary" iconLeft={Undo2} onClick={onHabilitarRegistro} disabled={habilitando}>
                Habilitar registro de lectura
              </Button>
            ) : (
              <Button variant="secondary" iconLeft={Ban} onClick={onNoRealizada} disabled={marcando}>
                Marcar como no realizada
              </Button>
            )}
            {/*
              SIN CONEXIÓN TAMBIÉN SE PUEDE (CU026).

              Las dos se encolan: el caso de uso tiene su propio flujo
              "Registro sin conexión a Internet", donde la declaración queda
              "Pendiente de sincronización" y la reversión va vinculada a ella.
              Aquí estuvieron un tiempo deshabilitadas por prudencia —cambian la
              tabla entera—, hasta que se leyó que el CU ya había resuelto esa
              duda en sentido contrario.
            */}
            {sinConexion && <span className="text-xs text-ink-500">Se enviará al recuperar la conexión</span>}
          </span>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 text-sm">
        {/* B6 — "Clase de esta semana: DD/MM/AAAA", con el tipo de clase al
            lado: una reprogramada o una adicional no se leen igual. */}
        <span className="inline-flex items-center gap-1.5 font-medium text-ink-700">
          <CalendarClock className="h-4 w-4 text-ink-400" aria-hidden="true" />
          {`Clase de esta semana: ${comoFecha(clase.fecha)}`}
        </span>
        <span className="text-ink-500">
          {clase.reprogramada ? 'Clase reprogramada' : (ETIQUETA_CLASE[clase.tipo] ?? 'Clase de referencia')}
        </span>

        {puedeCambiarClase && (
          <Button size="sm" variant="ghost" iconLeft={CalendarCog} onClick={onCambiarClase}>
            Cambiar clase
          </Button>
        )}

        {!bloqueada && pendientes > 0 && (
          <span className="text-ink-500">
            {pendientes} fila{pendientes === 1 ? '' : 's'} pendiente{pendientes === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* CU026: si la semana no se dio, se dice POR QUÉ y con el motivo que
          escribió el docente. Un simple "no realizada" no serviría de nada al
          Supervisor que revisa después. */}
      {bloqueada && (
        <div
          role="note"
          className="flex items-start gap-2 border-b border-line bg-surface-100 px-4 py-3 text-sm text-ink-700"
        >
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
          <span>
            <strong className="font-semibold">Lectura no realizada.</strong>{' '}
            {tabla.motivo_no_realizada ?? 'Sin motivo registrado.'}
          </span>
        </div>
      )}

      {/* El historial se ensena aunque la tabla ya este normal: una
          declaracion revertida sigue habiendo ocurrido. */}
      <HistorialDeclaraciones declaraciones={tabla.declaraciones} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface-100 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Alumno
              </th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">
                Asistencia
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                LSN · título
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                LSN · nota
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                LSL
              </th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">
                Total
              </th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">
                Obs.
              </th>
              <th scope="col" className="px-3 py-2 text-center font-semibold">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {tabla.filas.map((fila) => (
              <FilaLectura
                key={fila.id_alumno}
                fila={fila}
                soloLectura={soloLectura}
                bloqueada={bloqueada}
                onGuardar={onGuardarFila}
                onObservar={onObservar}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
