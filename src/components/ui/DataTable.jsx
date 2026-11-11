import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import cn from '../../lib/cn'
import EmptyState from './EmptyState'
import Paginacion from './Paginacion'
import Skeleton from './Skeleton'

/**
 * Flecha de la cabecera (D008 del reporte de UX).
 *
 * La que se ordena lleva una flecha clara hacia arriba o hacia abajo; las
 * demás, una doble tenue que solo dice «se puede ordenar». Antes las tres
 * formas eran chevrones del mismo peso y no se distinguía cuál mandaba.
 */
function iconoDeOrden(activa, direccion) {
  if (!activa) return ArrowUpDown
  return direccion === 'asc' ? ArrowUp : ArrowDown
}

/** Qué hace el próximo clic, dicho en la propia cabecera. */
function tituloDeOrden(activa, direccion, header) {
  if (!activa) return `Ordenar por ${String(header).toLowerCase()}`
  return direccion === 'asc' ? 'Orden ascendente. Pulsa para invertirlo' : 'Orden descendente. Pulsa para quitarlo'
}

const SIN_ORDEN = { key: null, dir: 'asc' }
const CLAVE_ORDEN = (nombre) => `sicedu.orden.${nombre}`

/**
 * El orden elegido se recuerda en la pestaña (D008): ir a otro módulo y volver
 * lo borraba. `sessionStorage` y no `localStorage`: al cerrar el navegador la
 * tabla vuelve a salir como la manda el servidor.
 */
function leerOrden(persistirOrden) {
  if (!persistirOrden) return SIN_ORDEN
  try {
    const guardado = JSON.parse(window.sessionStorage.getItem(CLAVE_ORDEN(persistirOrden)) ?? 'null')
    return guardado?.key ? { key: guardado.key, dir: guardado.dir === 'desc' ? 'desc' : 'asc' } : SIN_ORDEN
  } catch {
    return SIN_ORDEN
  }
}

/** `aria-sort` solo va en la columna por la que se está ordenando. */
function ariaSort(activa, direccion) {
  if (!activa) return undefined
  return direccion === 'asc' ? 'ascending' : 'descending'
}

/** Alineación de la columna. Los números van a la derecha y con cifras de ancho fijo. */
function alineacion(align, extra = '') {
  if (align === 'right') return `text-right ${extra}`.trim()
  if (align === 'center') return 'text-center'
  return 'text-left'
}

/**
 * Tabla propia sobre Tailwind (el stack prohíbe librerías de tablas).
 *
 * columns: [{ key, header, align, sortable, sortValue, width, className, headerClassName, render }]
 * RNF-002: el desplazamiento horizontal vive DENTRO de la tarjeta, nunca en el body.
 */
export default function DataTable({
  columns = [],
  rows = [],
  getRowId = (row, i) => row?.id ?? i,
  loading = false,
  empty,
  paginated = true,
  // Cuarenta, que es lo que tiene un salón: así un grado entero cabe en una
  // sola página y nadie pasa de hoja a mitad de la lista. Las opciones suben
  // de ahí para los listados grandes y bajan para las pantallas pequeñas.
  pageSizeOptions = [10, 20, 40, 80],
  initialPageSize = 40,
  rowClassName,
  onRowClick,
  stickyFirstColumn = false,
  // En el teléfono cada fila se lee como una tarjeta, salvo las tablas de
  // captura con columna fija, que necesitan seguir comparándose por columnas.
  tarjetasEnMovil = !stickyFirstColumn,
  footNote,
  className,
  // Nombre con el que se recuerda el orden elegido en la pestaña (D008).
  persistirOrden,
}) {
  const [orden, setOrden] = useState(() => leerOrden(persistirOrden))

  useEffect(() => {
    if (!persistirOrden) return
    try {
      if (orden.key) window.sessionStorage.setItem(CLAVE_ORDEN(persistirOrden), JSON.stringify(orden))
      else window.sessionStorage.removeItem(CLAVE_ORDEN(persistirOrden))
    } catch {
      // Sin almacenamiento, el orden vale mientras la tabla esté en pantalla.
    }
  }, [orden, persistirOrden])
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(initialPageSize)

  /**
   * EL ORDEN DE ENTRADA ES EL DEL SERVIDOR Y NO SE TOCA.
   *
   * Desde la tanda H el backend entrega todos los listados ordenados sin
   * distinguir mayúsculas ni tildes (la Ñ como N) y con desempate por id:
   * `ALVA`, `álvarez`, `Ávila`, `Ñahui`, `nuñez`, `Pérez`. Por eso
   * `orden.key` nace en `null` y las filas se pintan tal como llegan.
   *
   * Lo de abajo solo entra cuando la PERSONA pulsa una cabecera, que es otra
   * cosa. Y ojo con una condición que hoy se cumple y conviene no romper:
   * ordena el conjunto COMPLETO porque los listados de mantenimiento piden
   * todas las páginas (`todasLasPaginas`) y paginan aquí. Si alguna pantalla
   * pasara a recibir UNA página del servidor, este orden reordenaría solo esas
   * 40 filas y mentiría: ahí habría que quitarle `sortable` a sus columnas.
   */
  const ordenadas = useMemo(() => {
    if (!orden.key) return rows
    const col = columns.find((c) => c.key === orden.key)
    if (!col) return rows
    const valor = col.sortValue ?? ((row) => row[col.key])
    return [...rows].sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      if (va == null) return 1
      if (vb == null) return -1
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es', { numeric: true })
      return orden.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, orden, columns])

  const total = ordenadas.length
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const visibles = paginated
    ? ordenadas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina)
    : ordenadas

  const desde = total === 0 ? 0 : (paginaActual - 1) * porPagina + 1
  const hasta = Math.min(paginaActual * porPagina, total)

  function alternarOrden(col) {
    if (!col.sortable) return
    // Ascendente → descendente → sin orden (el del servidor). Una sola columna
    // manda a la vez: elegir otra reemplaza a la anterior.
    setOrden((prev) => {
      if (prev.key !== col.key) return { key: col.key, dir: 'asc' }
      return prev.dir === 'asc' ? { key: col.key, dir: 'desc' } : SIN_ORDEN
    })
    setPagina(1)
  }

  if (loading) {
    return <Skeleton variant="table" rows={5} className={cn('p-5', className)} />
  }

  if (total === 0) {
    return (
      empty ?? (
        <EmptyState
          title="Sin registros"
          description="No hay datos para los filtros seleccionados."
        />
      )
    )
  }

  return (
    <div className={className}>
      <div className="sicedu-scrollbar overflow-x-auto">
        <table className={cn('w-full min-w-full border-collapse text-sm', tarjetasEnMovil && 'sicedu-tabla-tarjetas')}>
          <thead>
            <tr className="bg-surface-100">
              {columns.map((col, i) => {
                const activa = orden.key === col.key
                const Icono = iconoDeOrden(activa, orden.dir)
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={ariaSort(activa, orden.dir)}
                    className={cn(
                      'whitespace-nowrap border-b border-line/70 px-3 py-3 text-[11px] first:pl-4 last:pr-4 xl:px-4 font-semibold uppercase tracking-wide text-ink-500',
                      alineacion(col.align),
                      col.sortable && 'sicedu-th-ordenable',
                      stickyFirstColumn && i === 0 && 'sticky left-0 z-10 bg-surface-100',
                      col.headerClassName,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => alternarOrden(col)}
                        title={tituloDeOrden(activa, orden.dir, col.header)}
                        className={cn(
                          'group inline-flex items-center gap-1 rounded transition-colors hover:text-ink-900',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                          activa && 'text-brand-700',
                        )}
                      >
                        {col.header}
                        <Icono
                          className={cn('h-3.5 w-3.5', !activa && 'opacity-40 group-hover:opacity-80')}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((row, i) => (
              <tr
                key={getRowId(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-brand-50/70',
                  onRowClick && 'cursor-pointer',
                  typeof rowClassName === 'function' ? rowClassName(row) : rowClassName,
                )}
              >
                {columns.map((col, ci) => (
                  <td
                    key={col.key}
                    data-etiqueta={typeof col.header === 'string' ? col.header : undefined}
                    className={cn(
                      'px-3 py-3.5 align-middle text-ink-700 first:pl-4 last:pr-4 xl:px-4',
                      alineacion(col.align, 'tabular-nums'),
                      stickyFirstColumn && ci === 0 && 'sticky left-0 z-10 bg-surface-0',
                      col.className,
                    )}
                  >
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {footNote && <p className="border-t border-line/70 px-4 py-3 text-xs text-ink-500">{footNote}</p>}

      {paginated && (
        <Paginacion
          desde={desde}
          hasta={hasta}
          total={total}
          pagina={paginaActual}
          totalPaginas={totalPaginas}
          porPagina={porPagina}
          opciones={pageSizeOptions}
          onPagina={setPagina}
          onPorPagina={(n) => {
            setPorPagina(n)
            setPagina(1)
          }}
        />
      )}
    </div>
  )
}
