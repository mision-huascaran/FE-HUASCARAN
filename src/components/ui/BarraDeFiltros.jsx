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
//   · ENTRE FILTROS, por ARRIBA (`items-start`), no por abajo. Un campo con
//     error (el rango de fechas de Sesiones, por ejemplo) añade una línea de
//     texto bajo su caja; con `items-end` esa línea empujaba hacia abajo las
//     CAJAS de los filtros vecinos —se veía como si "el filtro entero se
//     moviera" cada vez que la fecha dejaba de ser válida—. Con las etiquetas
//     arriba alineadas, el que crece lo hace hacia su propio pie, sin tocar
//     a los demás.
import { Filter, X } from 'lucide-react'
import Button from './Button'
import cn from '../../lib/cn'

/**
 * Anchos según lo que cabe en el filtro (D007 del reporte de UX).
 *
 * Antes todas las celdas crecían sin tope: una que caía sola en la segunda
 * fila («Pertenencia», con «Definida» o «Pendiente») ocupaba media pantalla,
 * mientras las de la primera se encogían hasta cortar «Comprensión Lectora».
 */
const ANCHOS = new Map([
  ['corto', 'min-w-[130px] basis-[140px] max-w-[180px]'],
  ['normal', 'min-w-[150px] basis-[170px] max-w-[250px]'],
  ['largo', 'min-w-[200px] basis-[230px] max-w-[320px]'],
])

/** Una celda de la fila: puede encogerse, con un mínimo legible y un tope. */
export function CeldaFiltro({ ancho = 'normal', className, children }) {
  const clases = ANCHOS.get(ancho) ?? ANCHOS.get('normal')
  return <div className={cn('flex-1', clases, className)}>{children}</div>
}

export default function BarraDeFiltros({ onFiltrar, onLimpiar, filtrarDeshabilitado, className, children }) {
  return (
    <form
      className={cn('flex flex-wrap items-start gap-3 p-4', className)}
      onSubmit={(e) => {
        e.preventDefault()
        onFiltrar?.()
      }}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">{children}</div>

      {/* Los botones bajan a su propia fila en móvil, donde no caben al lado
          de los filtros sin dejarlos en dos columnas de 100px. */}
      <div className="flex w-full shrink-0 items-center gap-2 sm:ml-auto sm:w-auto sm:pt-[26px]">
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
