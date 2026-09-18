// Cubre: RF-007, RF-008, RN-002, RN-004
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import ResumenColegio from './ResumenColegio'
import useDetalleColegio from './useDetalleColegio'
import { usePeriodos } from '../../hooks/useCatalogos'

/** Detalle de un colegio (P13). Roles 2 y 3, solo lectura. */
export default function ColegioDetallePage() {
  const { id } = useParams()
  const { data: periodos = [] } = usePeriodos()
  const { detalle, cargando, error, periodo, setPeriodo, mensaje } = useDetalleColegio(id)

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/colegios"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a colegios
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{detalle?.colegio.nombre ?? 'Colegio'}</h1>
          {detalle && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="neutral">Zona {detalle.colegio.zona}</Badge>
              <Badge tone="neutral">Distrito {detalle.colegio.distrito}</Badge>
            </div>
          )}
        </div>
        <Select
          label="Periodo"
          className="w-48"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          options={periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))}
        />
      </header>

      {cargando && <Skeleton variant="card" />}
      {error && <EmptyState title="No se pudo cargar el colegio" description={mensaje} />}
      {detalle && <ResumenColegio detalle={detalle} />}
    </div>
  )
}

