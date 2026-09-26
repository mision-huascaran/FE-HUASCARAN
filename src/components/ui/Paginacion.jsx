/**
 * Pie de paginación de `DataTable`: "Mostrando 1 a 5 de 5", registros por
 * página y botones anterior/siguiente (§4.5).
 */
export default function Paginacion({ desde, hasta, total, pagina, totalPaginas, porPagina, opciones, onPagina, onPorPagina }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-ink-500">
        Mostrando <span className="font-semibold tabular-nums text-ink-700">{desde}</span> a{' '}
        <span className="font-semibold tabular-nums text-ink-700">{hasta}</span> de{' '}
        <span className="font-semibold tabular-nums text-ink-700">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ink-500">
          <span>Por página</span>
          <select
            value={porPagina}
            onChange={(e) => onPorPagina(Number(e.target.value))}
            className="h-8 rounded-lg border border-line-strong bg-surface-0 px-2 text-xs text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {opciones.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPagina(Math.max(1, pagina - 1))}
            disabled={pagina === 1}
            className="h-8 rounded-lg border border-line-strong px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-2 text-xs tabular-nums text-ink-500">
            {pagina} / {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => onPagina(Math.min(totalPaginas, pagina + 1))}
            disabled={pagina === totalPaginas}
            className="h-8 rounded-lg border border-line-strong px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
