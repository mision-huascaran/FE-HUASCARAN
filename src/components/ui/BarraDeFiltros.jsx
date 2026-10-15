// La fila de filtros que comparten las pantallas de listado.
//
// Nació dentro de la plantilla de mantenimiento (Alumnos, Usuarios, Colegios) y
// se sacó aquí porque Seguimiento y Sesiones la estaban reinventando cada una a
// su manera: una sin botones y la otra con «Buscar» y «Limpiar filtros», con
// otro aspecto y otros nombres para lo mismo.
//
// Dos cosas que no son adorno:
//
//   · LA CELDA. `Input` y `Select` llevan `w-full` heredado de `Field`, así que
//     sueltos dentro de un `flex` cada uno se come la fila entera y los filtros
//     salen EN VERTICAL, uno debajo de otro. La celda les pone un ancho base y
//     permiso para encogerse, que es lo que los pone en horizontal.
//   · LOS BOTONES, en su propio bloque con `ml-auto`. Pegados al último filtro
//     bailaban: con dos filtros salían a media pantalla y con seis al extremo
//     derecho. Y van alineados por abajo (`items-end`), no centrados: lo que
//     tiene que cuadrar con ellos es la caja del control, no la etiqueta.
import { Filter, X } from 'lucide-react'
import Button from './Button'
import cn from '../../lib/cn'

/** Una celda de la fila: puede encogerse, con un mínimo legible. */
export function CeldaFiltro({ className, children }) {
  return <div className={cn('min-w-[150px] flex-1 basis-[150px]', className)}>{children}</div>
}

export default function BarraDeFiltros({ onFiltrar, onLimpiar, filtrarDeshabilitado, className, children }) {
  return (
    <form
      className={cn('flex flex-wrap items-end gap-3 border-b border-line p-4', className)}
      onSubmit={(e) => {
        e.preventDefault()
        onFiltrar?.()
      }}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button type="submit" iconLeft={Filter} disabled={filtrarDeshabilitado}>
          Filtrar
        </Button>
        <Button type="button" variant="ghost" iconLeft={X} onClick={onLimpiar}>
          Limpiar
        </Button>
      </div>
    </form>
  )
}
