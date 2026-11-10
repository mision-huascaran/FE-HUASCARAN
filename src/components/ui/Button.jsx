import { Loader2 } from 'lucide-react'
import cn from '../../lib/cn'

const VARIANTES = {
  primary: 'bg-gradient-to-b from-brand-solid to-brand-solidHover text-white shadow-[0_1px_2px_rgb(29_78_216/0.3)] hover:brightness-110 disabled:brightness-100',
  secondary: 'bg-brand-100 text-brand-700 hover:bg-brand-100/70',
  outline: 'border border-line-strong bg-surface-0 text-ink-700 hover:border-ink-400 hover:bg-surface-50',
  ghost: 'text-ink-700 hover:bg-surface-100',
  danger: 'bg-danger-solid text-white hover:bg-danger-solidHover',
  warning: 'bg-warning-500 text-navy-900 hover:brightness-105',
  // Para la acción que ABRE el trabajo del día. Va en verde y no en el azul de
  // marca a propósito: el botón de actividad se perdía entre los demás de la
  // barra, y es el que habilita todo lo que el docente viene a hacer.
  success: 'bg-success-solid text-white hover:bg-success-solidHover',
}

const TAMANOS = {
  // En el teléfono crecen hasta el objetivo táctil; desde `sm` recuperan la densidad.
  sm: 'h-9 px-3 text-xs gap-1.5 sm:h-8',
  md: 'h-11 px-4 text-sm gap-2 sm:h-10',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-[background-color,border-color,color,filter,transform] duration-150 active:scale-[0.98] disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTES[variant],
        TAMANOS[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        IconLeft && <IconLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </button>
  )
}
