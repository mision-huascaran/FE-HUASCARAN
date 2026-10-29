// La barra de filtros del dashboard, con su "Aplicar".
//
// "Aplicar" NO ES UN BOTÓN DE BUSCAR: es la frontera entre lo que se está
// eligiendo y lo que se está mirando. Mientras haya cambios sin aplicar, la
// pantalla lo dice y los bloques siguen rotulados con los filtros de SU
// consulta (ver `useFiltrosDashboard`).
//
// Los periodos se nombran por su nombre visible —"Segundo periodo"—, nunca
// "PA2": los tres CU lo prohíben expresamente, dos veces cada uno.
import { Filter } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { CeldaFiltro } from '../../components/ui/BarraDeFiltros'
import SelectorColegios from './SelectorColegios'
import { CAMBIOS_SIN_APLICAR } from './estados'

export default function FiltrosDashboard({
  anios = [],
  periodos = [],
  colegios = [],
  borrador,
  /** CU034 no usa periodo académico: se organiza por meses del año escolar. */
  conPeriodo = true,
  completos,
  hayCambios,
  aviso,
  onCambiar,
  onAplicar,
}) {
  return (
    <form
      className="flex flex-wrap items-start gap-3 border-b border-line p-4"
      onSubmit={(e) => {
        e.preventDefault()
        onAplicar()
      }}
    >
      <CeldaFiltro>
        <Select
          label="Año escolar"
          placeholder="Selecciona"
          required
          value={borrador.idAnioEscolar}
          options={anios.map((a) => ({ value: a.id_anio_escolar, label: a.nombre }))}
          onChange={(e) => onCambiar('idAnioEscolar', e.target.value)}
        />
      </CeldaFiltro>

      {conPeriodo && (
        <CeldaFiltro>
          <Select
            label="Periodo académico"
            placeholder="Selecciona"
            required
            value={borrador.idPeriodoAcademico}
            // Sin año no hay periodos que ofrecer: los PA pertenecen a un año.
            disabled={!borrador.idAnioEscolar}
            options={periodos.map((p) => ({ value: p.id_periodo_academico, label: p.nombre }))}
            onChange={(e) => onCambiar('idPeriodoAcademico', e.target.value)}
          />
        </CeldaFiltro>
      )}

      <CeldaFiltro className="min-w-[260px] basis-[260px]">
        <SelectorColegios
          colegios={colegios}
          todos={borrador.todosLosColegios}
          elegidos={borrador.idColegios}
          onChange={({ todos, elegidos }) => {
            onCambiar('todosLosColegios', todos)
            onCambiar('idColegios', elegidos)
          }}
        />
      </CeldaFiltro>

      <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
        <Button type="submit" iconLeft={Filter} disabled={!completos}>
          Aplicar
        </Button>
        {hayCambios && <span className="text-xs font-semibold text-warning-600">{CAMBIOS_SIN_APLICAR}</span>}
        {aviso && <span className="max-w-xs text-right text-xs text-warning-600">{aviso}</span>}
      </div>
    </form>
  )
}
