// Cubre: RF-005, RF-007, RF-009
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import { BarraSegmentada } from '../../components/charts'
import { formatoPct } from '../../components/charts/tema'
import { descargarCSV } from '../../lib/export'

/**
 * Tabla inferior de colegios (P12, reutilizada en P13): distribución en barra
 * segmentada, % de logro, cobertura y enlace al detalle.
 */
export default function TablaColegios({ colegios = [], loading, titulo = 'Colegios', conDocente = false }) {
  const columnas = [
    {
      key: 'colegio',
      header: 'Colegio',
      sortable: true,
      render: (c) => (
        <div className="min-w-[11rem]">
          <p className="font-medium text-ink-900">{c.colegio}</p>
          <p className="text-xs text-ink-400">Zona {c.zona}</p>
        </div>
      ),
    },
    ...(conDocente
      ? [{ key: 'docente', header: 'Docente', render: (c) => <span className="text-xs text-ink-500">{c.docente}</span> }]
      : []),
    {
      key: 'distribucion',
      header: 'Distribución',
      render: (c) => <BarraSegmentada conteos={c.conteos} />,
    },
    { key: 'pct_logro', header: '% logro', align: 'right', sortable: true, render: (c) => formatoPct(c.pct_logro) },
    {
      key: 'cobertura',
      header: 'Cobertura',
      align: 'right',
      sortable: true,
      render: (c) => (
        <span className={c.cobertura != null && c.cobertura < 80 ? 'font-semibold text-warning-600' : ''}>
          {formatoPct(c.cobertura)}
        </span>
      ),
    },
    {
      key: 'detalle',
      header: '',
      align: 'right',
      render: (c) => (
        <Link
          to={`/colegios/${c.id_colegio}`}
          className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-brand-600 hover:text-brand-700"
        >
          Ver detalle <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ),
    },
  ]

  return (
    <Card
      title={titulo}
      subtitle="La cobertura por debajo del 80 % se resalta: con pocos datos el % de logro todavía no es confiable"
      padded={false}
      actions={
        <button
          type="button"
          onClick={() =>
            descargarCSV(colegios, [
              { titulo: 'Colegio', valor: 'colegio' },
              { titulo: 'Zona', valor: 'zona' },
              { titulo: 'Estudiantes', valor: 'estudiantes' },
              { titulo: 'Evaluados', valor: 'evaluados' },
              { titulo: '% logro', valor: 'pct_logro' },
              { titulo: 'Cobertura (%)', valor: 'cobertura' },
            ], 'colegios')
          }
          className="h-8 rounded-lg border border-line px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-surface-100 print:hidden"
        >
          Descargar CSV
        </button>
      }
    >
      <DataTable columns={columnas} rows={colegios} loading={loading} getRowId={(c) => c.id_colegio} paginated={false} stickyFirstColumn />
    </Card>
  )
}
