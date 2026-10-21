// La lista de alumnos con Virtual Scrolling (CU022, paso 5).
//
// Solo se montan las filas que caben en la ventana; los dos espaciadores
// mantienen la barra de desplazamiento del tamaño de la lista completa, así que
// arrastrarla se siente igual que si estuviera entera.
import FilaAsistencia from './FilaAsistencia'
import useVentanaVirtual from './useVentanaVirtual'

const ALTO_FILA = 56

export default function ListaAsistencia({ alumnos, marcaDe, soloLectura, onMarcar, onObservar }) {
  const { contenedor, alDesplazar, desde, hasta, huecoArriba, huecoAbajo } = useVentanaVirtual({
    total: alumnos.length,
    altoFila: ALTO_FILA,
  })

  return (
    <div ref={contenedor} onScroll={alDesplazar} className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm">
        {/* Mismo tamaño y tono que `DataTable`: esta lista no puede usar ese
            componente porque necesita scroll virtual, pero puesta al lado de
            cualquier otra tabla tiene que leerse igual. */}
        <thead className="sticky top-0 z-10 bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-3 text-left">Alumno</th>
            <th className="px-4 py-3 text-center">Asistencia</th>
            <th className="px-4 py-3 text-center">Observación</th>
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

          {alumnos.slice(desde, hasta).map((alumno) => {
            const marca = marcaDe(alumno)
            return (
              <FilaAsistencia
                key={alumno.id_alumno}
                alumno={alumno}
                estado={marca.estado}
                observacion={marca.observacion}
                soloLectura={soloLectura}
                alto={ALTO_FILA}
                onMarcar={onMarcar}
                onObservar={onObservar}
              />
            )
          })}

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
