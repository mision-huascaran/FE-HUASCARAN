// Cubre: RF-018, RF-019, RF-023, RF-024, RN-009, RN-014, RN-015, RNF-005
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import DrawerAjuste from './DrawerAjuste'
import { listarNivelFinal } from '../../api/resources/nivelFinal'
import {
  useColegios,
  useGrados,
  useNivelGeneral,
  useNivelesRazkids,
  useProgramas,
  useSemanas,
} from '../../hooks/useCatalogos'
import columnasNivelFinal, { MINIMO_SEMANAS } from './columnasNivelFinal'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

export default function NivelFinalPage() {
  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data: nivelesGenerales = [] } = useNivelGeneral()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()
  const { data: semanas = [] } = useSemanas()

  // Los meses disponibles son los que tienen semanas lectivas cargadas.
  const meses = useMemo(() => {
    const claves = [...new Set(semanas.map((s) => `${s.anio}-${String(s.mes).padStart(2, '0')}`))]
    return claves.map((clave) => {
      const [anio, mes] = clave.split('-').map(Number)
      return { value: clave, label: `${MESES[mes - 1]} ${anio}` }
    })
  }, [semanas])

  const [filtros, setFiltros] = useState({ mes: '', colegio: '', grado: '', programa: '', estado: '' })
  const [ajustando, setAjustando] = useState(null)

  const mes = filtros.mes || meses.at(-1)?.value || ''

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['nivel-final', { ...filtros, mes }],
    queryFn: () => listarNivelFinal({ ...filtros, mes }),
    enabled: Boolean(mes && filtros.colegio),
  })

  const cambiar = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }))

  const columnas = columnasNivelFinal({ catalogoRazkids, setAjustando })

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Nivel final mensual</h1>
        <p className="mt-1 text-sm text-ink-500">
          El consolidado del mes se deriva de las rúbricas semanales: el sistema lo calcula y el docente
          puede ajustarlo con una justificación.
        </p>
      </header>

      <FilterBar
        onClear={() => setFiltros({ mes: '', colegio: '', grado: '', programa: '', estado: '' })}
        activeCount={Object.values(filtros).filter(Boolean).length}
      >
        <Select
          label="Mes"
          value={mes}
          onChange={cambiar('mes')}
          options={meses}
        />
        <Select
          label="Colegio"
          required
          value={filtros.colegio}
          onChange={cambiar('colegio')}
          placeholder="Seleccione un colegio"
          options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={filtros.grado}
          onChange={cambiar('grado')}
          placeholder="Todos"
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
        />
        <Select
          label="Programa"
          value={filtros.programa}
          onChange={cambiar('programa')}
          placeholder="Todos"
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
        <Select
          label="Estado"
          value={filtros.estado}
          onChange={cambiar('estado')}
          placeholder="Todos"
          options={[
            { value: 'ajustados', label: 'Ajustados' },
            { value: 'sin-ajustar', label: 'Sin ajustar' },
          ]}
        />
      </FilterBar>

      <Card padded={false}>
        {!filtros.colegio ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Elija un colegio"
            description="El consolidado mensual se revisa colegio por colegio."
          />
        ) : (
          <DataTable
            columns={columnas}
            rows={filas}
            loading={isLoading}
            getRowId={(f) => f.id_nivel_final}
            initialPageSize={10}
            stickyFirstColumn
            footNote={`El consolidado se deriva de las rúbricas semanales del mes. Con menos de ${MINIMO_SEMANAS} semanas registradas se marca en advertencia.`}
          />
        )}
      </Card>

      <DrawerAjuste
        open={Boolean(ajustando)}
        onClose={() => setAjustando(null)}
        fila={ajustando}
        nivelesGenerales={nivelesGenerales}
        mes={mes}
      />
    </div>
  )
}
