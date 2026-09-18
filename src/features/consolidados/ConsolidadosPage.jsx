// Cubre: RF-006, RF-010, RF-016
import { useMemo, useState } from 'react'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import Tabs from '../../components/ui/Tabs'
import ConsolidadoLibros from './ConsolidadoLibros'
import ConsolidadoNivel from './ConsolidadoNivel'
import { useColegios, useGrados, usePeriodos, useSemanas } from '../../hooks/useCatalogos'
import useFiltrosStore from '../../store/filtrosStore'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Consolidados (P14): de niveles y de libros, en dos pestañas con los mismos
 * filtros. El de niveles se mide por periodo de evaluación; el de libros, por
 * mes, porque el reporte semanal no sigue los cortes diagnósticos.
 */
export default function ConsolidadosPage() {
  const idPeriodoVigente = useFiltrosStore((s) => s.idPeriodo)
  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: periodos = [] } = usePeriodos()
  const { data: semanas = [] } = useSemanas()

  const [pestana, setPestana] = useState('niveles')
  const [filtros, setFiltros] = useState({ colegio: '', grado: '', q: '', periodo: '', mes: '' })

  const meses = useMemo(() => {
    const claves = [...new Set(semanas.map((s) => `${s.anio}-${String(s.mes).padStart(2, '0')}`))]
    return claves.map((c) => {
      const [anio, mes] = c.split('-').map(Number)
      return { value: c, label: `${MESES[mes - 1]} ${anio}` }
    })
  }, [semanas])

  const aplicados = {
    ...filtros,
    periodo: filtros.periodo || (idPeriodoVigente ? String(idPeriodoVigente) : ''),
    mes: filtros.mes || meses.at(-1)?.value || '',
  }
  const al = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }))

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Consolidados</h1>
        <p className="mt-1 text-sm text-ink-500">
          Los consolidados que hoy se arman a mano en el Excel, calculados por el sistema y listos para descargar.
        </p>
      </header>

      <FilterBar
        search={filtros.q}
        onSearchChange={(q) => setFiltros((f) => ({ ...f, q }))}
        searchPlaceholder="Estudiante (nombre o código)"
        onClear={() => setFiltros({ colegio: '', grado: '', q: '', periodo: '', mes: '' })}
        activeCount={[filtros.colegio, filtros.grado, filtros.q].filter(Boolean).length}
      >
        <Select label="Colegio" value={filtros.colegio} onChange={al('colegio')} placeholder="Todos" options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))} />
        <Select label="Grado" value={filtros.grado} onChange={al('grado')} placeholder="Todos" options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))} />
        {pestana === 'niveles' ? (
          <Select label="Periodo" value={aplicados.periodo} onChange={al('periodo')} options={periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))} />
        ) : (
          <Select label="Mes" value={aplicados.mes} onChange={al('mes')} options={meses} />
        )}
      </FilterBar>

      <Tabs
        value={pestana}
        onChange={setPestana}
        items={[
          { value: 'niveles', label: 'Consolidado de niveles' },
          { value: 'libros', label: 'Consolidado de libros' },
        ]}
      />

      {pestana === 'niveles' ? (
        <ConsolidadoNivel filtros={{ colegio: aplicados.colegio, grado: aplicados.grado, q: aplicados.q, periodo: aplicados.periodo }} />
      ) : (
        <ConsolidadoLibros filtros={{ colegio: aplicados.colegio, grado: aplicados.grado, q: aplicados.q, mes: aplicados.mes }} />
      )}
    </div>
  )
}
