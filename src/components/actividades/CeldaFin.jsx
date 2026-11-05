// La hora de finalización de una actividad.
//
// CARGA CON TRES CASOS, y por eso es un componente y no un `render` suelto
// repetido en dos tablas:
//
//   · La jornada sigue abierta. Antes iba un guion, que se lee como "falta el
//     dato"; lo que pasa es otra cosa y se dice: "En curso". Desde que esta
//     celda lo cuenta, la columna "Estado de la actividad" sobraba.
//   · Terminó el mismo día: solo la hora. La fecha ya está en su columna, y
//     repetirla en cada fila ensancha la tabla sin añadir nada (U15).
//   · Terminó OTRO día —se trabajó pasada la medianoche o la sesión expiró de
//     madrugada—. Entonces la fecha es imprescindible: sin ella, "16:53 →
//     00:51" parece un error de datos.
//
// El tercero se apila en dos líneas en vez de escribirse seguido. En una
// línea, "31/10/2026 00:51" obliga a la columna entera a ser el doble de
// ancha por una fila de veinte, y las otras diecinueve pagan ese ancho. Apilado,
// solo crece el alto de ESA fila. Y la hora queda arriba, en el mismo sitio
// donde está en las demás filas: la columna de horas se sigue leyendo en
// vertical de un vistazo, con la fecha como anotación debajo.
import { enOtroDia, formatearFecha, formatearHora } from '../../lib/format'

export default function CeldaFin({ sesion }) {
  if (!sesion?.fin) return <span className="font-medium text-info-600">En curso</span>

  const hora = formatearHora(sesion.fin)
  if (!enOtroDia(sesion.inicio, sesion.fin)) return hora

  return (
    <span className="flex flex-col leading-tight">
      <span>{hora}</span>
      <span className="text-xs text-ink-500">{formatearFecha(sesion.fin)}</span>
    </span>
  )
}
