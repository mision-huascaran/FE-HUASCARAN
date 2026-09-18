import { FileSpreadsheet, FileText } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { descargarCSV, descargarExcel } from '../../lib/export'

/**
 * Pie común de los consolidados (P14): la nota de origen del dato y los botones
 * de exportación a Excel y CSV.
 *
 * `origen` distingue un snapshot congelado al cierre del periodo de un cálculo
 * en vivo, que puede cambiar mientras los docentes siguen registrando.
 */
export default function BarraExportacion({ origen, filas, columnas, nombre, hoja }) {
  const snapshot = origen === 'snapshot'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <Badge tone={snapshot ? 'neutral' : 'info'}>{snapshot ? 'Snapshot del cierre' : 'Cálculo en vivo'}</Badge>
        {snapshot
          ? 'Datos congelados al cierre del periodo: no cambian.'
          : 'Se recalcula con cada registro: puede cambiar mientras el periodo siga abierto.'}
      </div>
      <div className="flex gap-2 print:hidden">
        <Button size="sm" variant="outline" iconLeft={FileSpreadsheet} disabled={!filas.length} onClick={() => descargarExcel(filas, columnas, nombre, hoja)}>
          Excel
        </Button>
        <Button size="sm" variant="outline" iconLeft={FileText} disabled={!filas.length} onClick={() => descargarCSV(filas, columnas, nombre)}>
          CSV
        </Button>
      </div>
    </div>
  )
}
