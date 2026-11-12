import { Children, cloneElement, isValidElement, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { CeldaFiltro } from './BarraDeFiltros'
import Button from './Button'
import Drawer from './Drawer'
import { controlClases } from './Field'
import cn from '../../lib/cn'
import resumenDeFiltros from './resumenDeFiltros'
import { useIsDesktop } from '../../hooks/useMediaQuery'

/**
 * El ancho que pide cada filtro (`ancho="corto" | "normal" | "largo"`), quitado
 * del elemento para que no llegue al DOM.
 */
const sinAncho = (hijo) => cloneElement(hijo, { ancho: undefined })

/**
 * Fila de filtros + buscador + "Aplicar filtros".
 * RNF-002: bajo `lg` el conjunto colapsa en un Drawer para no romper el ancho.
 *
 * N006 — CADA FILTRO CON EL ANCHO DE SU CONTENIDO, como en `BarraDeFiltros`
 * (D007). Antes era una rejilla de cuatro columnas iguales: "3.º" ocupaba lo
 * mismo que el nombre del colegio, y el quinto filtro ("Mes", "Fecha") quedaba
 * solo en una segunda fila. Cada hijo puede pedir `ancho`; sin él, "normal".
 */
export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  onApply,
  onClear,
  activeCount = 0,
  /** Lo filtrado, dicho en una línea junto al botón del celular (U18). Se deduce de los hijos si no se da. */
  resumen,
  className,
  children,
}) {
  const esEscritorio = useIsDesktop()
  const [abierto, setAbierto] = useState(false)

  const buscador = onSearchChange && (
    <div className="relative min-w-0 flex-1 lg:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={search ?? ''}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className={controlClases(false, 'h-11 pl-9 pr-3 sm:h-10')}
      />
    </div>
  )

  const acciones = (
    <div className="flex flex-wrap items-center gap-2">
      {onClear && (
        <Button variant="ghost" size="md" iconLeft={X} onClick={onClear}>
          Limpiar
        </Button>
      )}
      {onApply && (
        <Button variant="primary" size="md" onClick={onApply}>
          Aplicar filtros
        </Button>
      )}
    </div>
  )

  if (esEscritorio) {
    return (
      <div
        className={cn(
          'rounded-xl border border-line bg-surface-0 p-4 shadow-card',
          className,
        )}
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            {Children.toArray(children)
              .filter(isValidElement)
              .map((hijo) => (
                <CeldaFiltro key={hijo.key} ancho={hijo.props.ancho}>
                  {sinAncho(hijo)}
                </CeldaFiltro>
              ))}
          </div>
          {buscador}
          {acciones}
        </div>
      </div>
    )
  }

  const filtrado = resumen ?? resumenDeFiltros(children)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {buscador}
      <Button
        variant="outline"
        size="md"
        iconLeft={SlidersHorizontal}
        onClick={() => setAbierto(true)}
        className="shrink-0"
      >
        Filtros
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-brand-100 px-1.5 text-xs font-bold tabular-nums text-brand-700">
            {activeCount}
          </span>
        )}
      </Button>
      {filtrado && !buscador && (
        <p className="min-w-0 truncate text-sm text-ink-700" title={filtrado}>
          {filtrado}
        </p>
      )}

      <Drawer
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Filtros"
        footer={
          <>
            {onClear && (
              <Button variant="ghost" onClick={onClear}>
                Limpiar
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                onApply?.()
                setAbierto(false)
              }}
            >
              Aplicar filtros
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {Children.toArray(children)
            .filter(isValidElement)
            .map((hijo) => sinAncho(hijo))}
        </div>
      </Drawer>
    </div>
  )
}
