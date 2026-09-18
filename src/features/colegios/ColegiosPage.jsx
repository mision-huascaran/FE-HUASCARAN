// Cubre: RF-007, RF-008, RF-009, RN-002, RN-004
// RF-008 y RF-009 (rankings de aulas y de colegios) son NICE TO HAVE en el
// documento de requerimientos.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import { GraficoDispersion, TarjetaGrafico } from '../../components/charts'
import Ranking from './Ranking'
import TablaColegios from '../dashboard/TablaColegios'
import { obtenerRankingColegios } from '../../api/resources/dashboard'
import { mensajeDeError } from '../../api/client'
import { usePeriodos, useProgramas } from '../../hooks/useCatalogos'
import useFiltrosStore from '../../store/filtrosStore'

const VACIO = { programa: '', periodo: '', dimension: '', zona: '' }

/** Comparativa y ranking de los nueve colegios (P13). Roles 2 y 3, solo lectura. */
export default function ColegiosPage() {
  const idPeriodoVigente = useFiltrosStore((s) => s.idPeriodo)
  const { data: programas = [] } = useProgramas()
  const { data: periodos = [] } = usePeriodos()
  const [filtros, setFiltros] = useState(VACIO)

  const aplicados = { ...filtros, periodo: filtros.periodo || (idPeriodoVigente ? String(idPeriodoVigente) : '') }

  const consulta = useQuery({
    queryKey: ['ranking-colegios', aplicados],
    queryFn: () => obtenerRankingColegios(aplicados),
    enabled: Boolean(aplicados.periodo),
    placeholderData: (previos) => previos,
  })

  const ranking = consulta.data ?? []
  const al = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }))

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Colegios y ranking</h1>
        <p className="mt-1 text-sm text-ink-500">
          Comparativa de los nueve colegios por porcentaje de estudiantes en Logrado o Destacado.
        </p>
      </header>

      <FilterBar onClear={() => setFiltros(VACIO)} activeCount={Object.values(filtros).filter(Boolean).length}>
        <Select label="Programa" value={filtros.programa} onChange={al('programa')} placeholder="Todos" options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))} />
        <Select label="Periodo" value={aplicados.periodo} onChange={al('periodo')} options={periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))} />
        <Select
          label="Dimensión"
          value={filtros.dimension}
          onChange={al('dimension')}
          placeholder="Nivel general"
          options={[{ value: 'Fluidez', label: 'Fluidez lectora' }, { value: 'Comprensión', label: 'Comprensión lectora' }]}
        />
        <Select label="Zona" value={filtros.zona} onChange={al('zona')} placeholder="Todas" options={['Yungay', 'Carhuaz']} />
      </FilterBar>

      {consulta.isError ? (
        <EmptyState title="No se pudo cargar el ranking" description={mensajeDeError(consulta.error)} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card title="Ranking de colegios" subtitle="% en Logrado o Destacado (RF-009)">
              {consulta.isLoading ? <p className="text-sm text-ink-500">Cargando…</p> : <Ranking filas={ranking} />}
            </Card>

            <TarjetaGrafico
              titulo="Logro frente a cobertura"
              subtitulo="Un punto por colegio"
              ayuda="Separa 'le va mal' de 'todavía no cargó datos'. Arriba a la derecha: mucho logro y datos completos. Abajo a la izquierda: poco logro con poca cobertura, un resultado que todavía no es confiable."
              nombre="logro-vs-cobertura"
              csv={{
                filas: ranking,
                columnas: [
                  { titulo: 'Colegio', valor: 'colegio' },
                  { titulo: 'Cobertura (%)', valor: 'cobertura' },
                  { titulo: 'Logro (%)', valor: 'pct_logro' },
                ],
              }}
            >
              <GraficoDispersion datos={ranking} />
            </TarjetaGrafico>
          </div>

          <TablaColegios colegios={ranking} loading={consulta.isLoading} titulo="Comparativa de los nueve colegios" conDocente />
        </>
      )}
    </div>
  )
}
