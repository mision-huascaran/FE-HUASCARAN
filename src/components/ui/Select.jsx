import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import Field, { controlClases } from './Field'
import cn from '../../lib/cn'

/** El texto de un filtro encadenado cuando falta el anterior: «Primero selecciona un colegio». */
export const primeroSelecciona = (anterior) => `Primero selecciona un ${anterior}`

/**
 * Lo que se LEE en el control pendiente: corto, porque en la barra de filtros
 * Grado y Sección tienen el ancho de su contenido (N006) y la frase entera se
 * cortaba («Primero selecc»). La frase completa sigue en el `title`.
 */
export const eligeAntes = (anterior) => `Elige un ${anterior}`

/**
 * `options` acepta [{ value, label }] o una lista de strings.
 *
 * EL VACÍO TIENE DOS SIGNIFICADOS, y por eso dos formas de pedirlo:
 *
 *   · `placeholder` es una INDICACIÓN («Selecciona»): el texto que se ve
 *     mientras no hay nada elegido. No es una opción: no aparece en la lista
 *     ni se puede volver a elegir una vez que hay un valor. Antes salía como
 *     primera opción con un grado ya elegido, y elegirla dejaba el filtro en
 *     un estado que ninguna pantalla sabe tratar.
 *   · `vacioElegible` convierte el placeholder en una opción DE VERDAD, para
 *     cuando el vacío significa algo que se elige: «Todos» en un filtro, «Sin
 *     evaluar» en una celda que se puede devolver a su estado inicial.
 *
 * `pendienteDe` es para los FILTROS ENCADENADOS: con el nombre del filtro
 * anterior («colegio», «grado»), el control queda deshabilitado y dice qué
 * falta —«Primero selecciona un colegio»— en vez de abrirse como una lista en
 * blanco. Con un valor falso se comporta como siempre.
 */
const Select = forwardRef(function Select(
  {
    label,
    hint,
    error,
    required,
    id,
    className,
    options = [],
    placeholder,
    vacioElegible = false,
    pendienteDe,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const items = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))

  // Sin `value` ni `defaultValue` el navegador elegiría la primera opción
  // habilitada, saltándose la indicación: se arranca en el vacío.
  const sinValorInicial = !('value' in props) && !('defaultValue' in props)

  if (pendienteDe) {
    return (
      <Field id={selectId} label={label} hint={hint} error={error} required={required} className={className}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error) || undefined}
            className={cn(controlClases(error, 'h-11 appearance-none pr-9 sm:h-10'))}
            {...props}
            value=""
            onChange={props.onChange ?? (() => {})}
            disabled
            // Si la celda es angosta, el texto completo sigue a mano.
            title={primeroSelecciona(pendienteDe)}
          >
            <option value="">{eligeAntes(pendienteDe)}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
        </div>
      </Field>
    )
  }

  return (
    <Field id={selectId} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={Boolean(error) || undefined}
          className={cn(controlClases(error, 'h-11 appearance-none pr-9 sm:h-10'))}
          disabled={disabled}
          {...(placeholder && !vacioElegible && sinValorInicial ? { defaultValue: '' } : {})}
          {...props}
        >
          {placeholder &&
            (vacioElegible ? (
              <option value="">{placeholder}</option>
            ) : (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            ))}
          {items.map((o) => (
            <option key={String(o.value)} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
      </div>
    </Field>
  )
})

export default Select
