import cn from '../../lib/cn'

/**
 * Un nombre de persona que nunca desarma la pantalla.
 *
 * Un nombre importado de 300 o 10 000 caracteres sin espacios estiraba la
 * columna "Alumno" y empujaba el resto de la tabla fuera de la vista. Aquí se
 * corta en `lineas` líneas con puntos suspensivos, las palabras sin espacios se
 * parten donde haga falta (`overflow-wrap: anywhere`, que además deja que la
 * columna se angoste) y el nombre completo queda en el `title`.
 *
 * `max-w-*` va por `className`: en una tabla conviene un tope; en un título, no.
 */
export default function NombreLargo({ children, lineas = 2, className, as: Etiqueta = 'span' }) {
  const texto = String(children ?? '')
  return (
    <Etiqueta
      title={texto}
      className={cn('[overflow-wrap:anywhere]', lineas === 1 ? 'line-clamp-1' : 'line-clamp-2', className)}
    >
      {texto}
    </Etiqueta>
  )
}
