// Una fila de la lista de asistencia (CU022, paso 6).
//
// Las columnas son las que pide el caso de uso: Nombres, Apellidos y el
// Segmented Control. La observación que había antes se quitó: CU022 no la
// contempla y, sin botón de guardar, un campo de texto libre con Auto-save
// mandaría un micro-paquete por cada tecla.
import ControlSegmentado from './ControlSegmentado'

export default function FilaAsistencia({ alumno, presente, soloLectura, alto, onMarcar }) {
  const nombre = `${alumno.nombres} ${alumno.apellidos}`
  return (
    <tr className="border-t border-line" style={{ height: alto }}>
      <td className="px-4 py-2">
        <span className="font-medium text-ink-900">{alumno.nombres}</span>
      </td>
      <td className="px-4 py-2">
        <span className="text-ink-700">{alumno.apellidos}</span>
        {/* CU022, paso 5: en una fecha pasada pueden salir alumnos dados de
            baja que ese día sí constaban. Se marcan para no confundir. */}
        {alumno.activo === false && (
          <span className="ml-2 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-ink-500">
            Inactivo
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-center">
        <ControlSegmentado
          valor={presente}
          nombre={nombre}
          deshabilitado={soloLectura}
          onElegir={(valor) => onMarcar(alumno, valor)}
        />
      </td>
    </tr>
  )
}
