import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import Field, { controlClases } from './Field'
import cn from '../../lib/cn'

/** El texto de un filtro encadenado cuando falta el anterior: «Primero selecciona un colegio». */
export const primeroSelecciona = (anterior) => `Primero selecciona un ${anterior}`

/**
 * `options` acepta [{ value, label }] o una lista de strings.
 * `placeholder` añade una opción vacía inicial.
 *
 * `pendienteDe` es para los FILTROS ENCADENADOS: con el nombre del filtro
 * anterior («colegio», «grado»), el control queda deshabilitado y dice qué
 * falta —«Primero selecciona un colegio»— en vez de abrirse como una lista en
 * blanco. Con un valor falso se comporta como siempre.
 */
const Select = forwardRef(function Select(
  { label, hint, error, required, id, className, options = [], placeholder, pendienteDe, children, ...props },
  ref,
) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const items = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))

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
          >
            <option value="">{primeroSelecciona(pendienteDe)}</option>
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
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
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
