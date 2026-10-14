// La lista de alumnos con Virtual Scrolling (CU022, paso 5).
//
// Solo se montan las filas que caben en la ventana; los dos espaciadores
// mantienen la barra de desplazamiento del tamaño de la lista completa, así que
// arrastrarla se siente igual que si estuviera entera.
import FilaAsistencia from './FilaAsistencia'
import useVentanaVirtual from './useVentanaVirtual'

const ALTO_FILA = 56

export default function ListaAsistencia({ alumnos, presenteDe, soloLectura, onMarcar }) {
  const { contenedor, alDesplazar, desde, hasta, huecoArriba, huecoAbajo } = useVentanaVirtual({
    total: alumnos.length,
    altoFila: ALTO_FILA,
  })

  return (
    <div ref={contenedor} onScroll={alDesplazar} className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <tr>
            <th className="px-4 py-3 text-left">Nombres</th>
            <th className="px-4 py-3 text-left">Apellidos</th>
            <th className="px-4 py-3 text-center">Asistencia</th>
          </tr>
        </thead>
        <tbody>
          {/* Espaciadores: solo reservan alto. `role="presentation"` los saca del
              árbol de accesibilidad (no son filas de datos) y no son enfocables. */}
          {huecoArriba > 0 && (
            <tr role="presentation">
              <td colSpan={3} style={{ height: huecoArriba }} />
            </tr>
          )}

          {alumnos.slice(desde, hasta).map((alumno) => (
            <FilaAsistencia
              key={alumno.id_alumno}
              alumno={alumno}
              presente={presenteDe(alumno)}
              soloLectura={soloLectura}
              alto={ALTO_FILA}
              onMarcar={onMarcar}
            />
          ))}

          {huecoAbajo > 0 && (
            <tr role="presentation">
              <td colSpan={3} style={{ height: huecoAbajo }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
