// Cubre: RF-025, RN-011, RN-012, RN-016
import { Lock } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import LevelChip from '../../components/ui/LevelChip'
import { useEsperadoPorGrado, useGrados, useNivelesRazkids, useNivelesRubrica, useProgramas } from '../../hooks/useCatalogos'

/**
 * Catálogos en modo LECTURA (P16).
 *
 * RF-025 / RN-016: la rúbrica es un instrumento oficial de Misión Huascarán.
 * En ninguna pantalla existe forma de crear, editar o borrar niveles ni
 * descriptores: aquí no hay ni un botón de edición, a propósito.
 */
export default function TabCatalogos() {
  const { data: razkids = [], isLoading: cargandoRazkids } = useNivelesRazkids()
  const { data: rubrica = [], isLoading: cargandoRubrica } = useNivelesRubrica()
  const { data: esperado = [] } = useEsperadoPorGrado()
  const { data: programas = [] } = useProgramas()
  const { data: grados = [] } = useGrados()

  const nombrePrograma = (id) => programas.find((p) => p.id_programa === id)?.nombre ?? id

  return (
    <div className="flex flex-col gap-5">
      <div role="note" className="flex items-start gap-2 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm font-medium text-warning-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        La rúbrica es un instrumento oficial de Misión Huascarán y no puede modificarse desde el sistema.
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Niveles de la rúbrica" subtitle={`${rubrica.length} niveles, por programa y dimensión`} padded={false}>
          <DataTable
            loading={cargandoRubrica}
            rows={rubrica}
            getRowId={(n) => n.id_nivel_rubrica}
            initialPageSize={10}
            columns={[
              { key: 'id_programa', header: 'Programa', render: (n) => nombrePrograma(n.id_programa) },
              { key: 'dimension', header: 'Dimensión' },
              { key: 'orden', header: 'Orden', align: 'center' },
              { key: 'nombre_nivel', header: 'Nivel', render: (n) => <LevelChip nivel={n.nombre_nivel} size="sm" /> },
            ]}
          />
        </Card>

        <Card title="Nivel esperado por grado" subtitle="Nivel Raz-Kids que se espera al terminar cada grado" padded={false}>
          <DataTable
            rows={esperado}
            getRowId={(e) => e.id_grado}
            paginated={false}
            columns={[
              { key: 'id_grado', header: 'Grado', render: (e) => grados.find((g) => g.id_grado === e.id_grado)?.nombre ?? e.id_grado },
              { key: 'letra', header: 'Nivel esperado', align: 'center', render: (e) => <LevelChip letra={e.letra} orden={e.orden} totalNiveles={razkids.length} size="sm" /> },
              { key: 'orden', header: 'Orden', align: 'center' },
            ]}
            footNote="TODO RN-013: tabla provisional, pendiente de confirmación con Misión Huascarán."
          />
        </Card>
      </div>

      <Card title="Niveles Raz-Kids" subtitle="Se comparan siempre por su orden, nunca por la letra (RN-012)">
        {cargandoRazkids ? (
          <p className="text-sm text-ink-500">Cargando…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {razkids.map((n) => (
              <span key={n.id_nivel_razkids} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1">
                <span className="text-[10px] tabular-nums text-ink-400">{n.orden}</span>
                <LevelChip letra={n.letra} orden={n.orden} totalNiveles={razkids.length} size="sm" />
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
