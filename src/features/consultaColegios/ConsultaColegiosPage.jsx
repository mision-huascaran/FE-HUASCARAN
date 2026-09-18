// Cubre: RF-003, RN-001, RN-003, RNF-004
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { School } from 'lucide-react'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import ResumenColegio from '../colegios/ResumenColegio'
import useDetalleColegio from '../colegios/useDetalleColegio'
import { obtenerAsignaciones } from '../../api/resources/docentes'
import { useColegios, usePeriodos } from '../../hooks/useCatalogos'
import useFiltrosStore from '../../store/filtrosStore'
import useSessionStore from '../../store/sessionStore'

/**
 * Consulta de otros colegios (RF-003), solo para el Profesor.
 *
 * El docente EDITA únicamente los colegios que tiene asignados en el periodo
 * vigente, pero puede CONSULTAR cualquiera. Esta pantalla es de lectura por
 * construcción: no tiene ni un control de edición, y cuando el colegio no es
 * suyo lo dice con el aviso fijo de modo consulta (§5).
 */
export default function ConsultaColegiosPage() {
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const { data: colegios = [] } = useColegios()
  const { data: periodos = [] } = usePeriodos()
  const [idColegio, setIdColegio] = useState('')

  // id_docente puede ser null (cuenta no docente): la consulta no se dispara.
  const { data: asignaciones = [] } = useQuery({
    queryKey: ['asignaciones', idDocente, idPeriodo],
    queryFn: () => obtenerAsignaciones(idDocente, idPeriodo),
    enabled: Boolean(idDocente && idPeriodo),
  })

  const asignados = useMemo(() => new Set(asignaciones.map((a) => a.id_colegio)), [asignaciones])
  const { detalle, cargando, error, mensaje, periodo, setPeriodo } = useDetalleColegio(idColegio)
  const esAjeno = Boolean(idColegio) && !asignados.has(Number(idColegio))

  // Los colegios ajenos primero: es lo que esta pantalla viene a resolver.
  const opciones = [...colegios]
    .sort((a, b) => Number(asignados.has(a.id_colegio)) - Number(asignados.has(b.id_colegio)))
    .map((c) => ({ value: c.id_colegio, label: `${c.nombre}${asignados.has(c.id_colegio) ? ' (asignado)' : ''}` }))

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Consulta de colegios</h1>
        <p className="mt-1 text-sm text-ink-500">
          Revise los indicadores de cualquier colegio del programa. Solo puede registrar datos en los que
          tiene asignados.
        </p>
      </header>

      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Colegio"
            value={idColegio}
            onChange={(e) => setIdColegio(e.target.value)}
            placeholder="Seleccione un colegio"
            options={opciones}
          />
          <Select
            label="Periodo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            options={periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))}
          />
        </div>
      </Card>

      {esAjeno && <AvisoModoConsulta />}

      {!idColegio && (
        <Card padded={false}>
          <EmptyState icon={School} title="Elija un colegio" description="Verá sus indicadores, grados y aulas en modo lectura." />
        </Card>
      )}
      {idColegio && cargando && <Skeleton variant="card" />}
      {error && <EmptyState title="No se pudo cargar el colegio" description={mensaje} />}
      {detalle && <ResumenColegio detalle={detalle} />}
    </div>
  )
}
