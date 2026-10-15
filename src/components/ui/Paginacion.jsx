/**
 * Pie de paginación de `DataTable`: "Mostrando 1 a 5 de 5", registros por
 * página y botones anterior/siguiente (§4.5).
 *
 * CONTRASTE: "Anterior" y "Siguiente" apenas se leían. Iban sin fondo, con
 * texto `ink-700` sobre blanco y borde claro, y deshabilitados con
 * `opacity-50`, que sobre un gris ya suave los dejaba casi invisibles: no se
 * distinguía un botón apagado de uno vivo. Ahora llevan fondo propio, texto
 * `ink-900` y el estado apagado es un color explícito, no una transparencia.
 */
const BOTON_PAGINA = [
  'h-8 rounded-lg border px-3 text-xs font-semibold transition-colors',
  'border-line-strong bg-surface-0 text-ink-900 hover:bg-brand-100 hover:border-brand-500 hover:text-brand-700',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
  // Apagado: gris sólido y legible, en vez de medio transparente.
  'disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-100 disabled:text-ink-400 disabled:hover:bg-surface-100',
].join(' ')
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
            className="h-8 rounded-lg border border-line-strong bg-surface-0 px-2 text-xs font-semibold text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
            className={BOTON_PAGINA}
          >
            Anterior
          </button>
          <span className="px-2 text-xs font-semibold tabular-nums text-ink-700">
            {pagina} / {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => onPagina(Math.min(totalPaginas, pagina + 1))}
            disabled={pagina === totalPaginas}
            className={BOTON_PAGINA}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
