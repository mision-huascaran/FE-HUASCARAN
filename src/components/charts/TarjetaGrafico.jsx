import { Suspense, useRef, useState } from 'react'
import { Download, Info } from 'lucide-react'
import Card from '../ui/Card'
import Skeleton from '../ui/Skeleton'
import Tooltip from '../ui/Tooltip'
import { descargarCSV, descargarPNG } from '../../lib/export'

/**
 * Envoltura común de todos los gráficos consolidados (P12, P13, P17).
 *
 * - `ayuda`: qué mide el gráfico, en un Tooltip junto al título (§P12).
 * - `csv`: `{ filas, columnas }` para descargar los datos del gráfico. Es
 *   además la "vista de tabla" que exige la accesibilidad: quien no distingue
 *   los colores de las series puede leer los números.
 * - PNG: se rasteriza el SVG que dibuja recharts dentro de la tarjeta.
 *
 * El gráfico va en un Suspense porque recharts se carga de forma diferida.
 */
export default function TarjetaGrafico({ titulo, subtitulo, ayuda, csv, nombre, className, children }) {
  const contenedor = useRef(null)
  const [exportando, setExportando] = useState(false)
  const base = nombre ?? titulo

  async function png() {
    setExportando(true)
    try {
      await descargarPNG(contenedor.current, base)
    } finally {
      setExportando(false)
    }
  }

  return (
    <Card
      className={className}
      title={
        <span className="inline-flex items-center gap-1.5">
          {titulo}
          {ayuda && (
            <Tooltip content={ayuda}>
              <button
                type="button"
                aria-label={`Qué mide: ${titulo}`}
                className="rounded text-ink-400 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Info className="h-4 w-4" aria-hidden="true" />
              </button>
            </Tooltip>
          )}
        </span>
      }
      subtitle={subtitulo}
      actions={
        <div className="flex items-center gap-1 print:hidden">
          <BotonDescarga etiqueta="PNG" onClick={png} disabled={exportando} />
          {csv && (
            <BotonDescarga etiqueta="CSV" onClick={() => descargarCSV(csv.filas, csv.columnas, base)} />
          )}
        </div>
      }
    >
      <div ref={contenedor}>
        <Suspense fallback={<Skeleton variant="chart" />}>{children}</Suspense>
      </div>
    </Card>
  )
}

function BotonDescarga({ etiqueta, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Descargar ${etiqueta}`}
      className="inline-flex h-7 items-center gap-1 rounded-lg border border-line px-2 text-[11px] font-semibold text-ink-500 transition-colors hover:bg-surface-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {etiqueta}
    </button>
  )
}
