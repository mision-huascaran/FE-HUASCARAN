// La barra de filtros del dashboard, con su "Aplicar".
//
// "Aplicar" NO ES UN BOTÓN DE BUSCAR: es la frontera entre lo que se está
// eligiendo y lo que se está mirando. Mientras haya cambios sin aplicar, la
// pantalla lo dice y los bloques siguen rotulados con los filtros de SU
// consulta (ver `useFiltrosDashboard`).
//
// Los periodos se nombran por su nombre visible —"Segundo periodo"—, nunca
// "PA2": los tres CU lo prohíben expresamente, dos veces cada uno.
//
// UNA SOLA FILA. Antes "Colegios" era un panel siempre abierto —buscador y
// casillas visibles sin importar cuántos colegios hubiera—, con una altura
// que no tenía nada que ver con la de un `Select` cerrado: la fila se partía
// en dos y dejaba un hueco en blanco del alto del panel debajo de "Año
// escolar" y "Periodo académico". Ahora `SelectorColegios` es un desplegable
// —mide lo mismo que un `Select`, 40 px— y los cuatro controles (los tres
// filtros y "Aplicar") caben en una fila, alineados por abajo como el resto
// de las barras de filtros del sistema.
import { Filter } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import { CeldaFiltro } from '../../components/ui/BarraDeFiltros'

/**
 * En el teléfono cada filtro ocupa su línea.
 *
 * A 150 px caben dos por fila, pero "Periodo académico" no se lee entero y el
 * desplegable queda demasiado estrecho para el pulgar. Desde `sm` vuelven a
 * compartir fila, que es donde el ancho sobra.
 */
const ANCHO_EN_MOVIL = 'basis-full sm:basis-[150px]'
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
      className="flex flex-wrap items-end gap-3 border-b border-line p-4"
      onSubmit={(e) => {
        e.preventDefault()
        onAplicar()
      }}
    >
      <CeldaFiltro className={ANCHO_EN_MOVIL}>
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
        <CeldaFiltro className={ANCHO_EN_MOVIL}>
          <Select
            label="Periodo académico"
            placeholder="Selecciona"
            required
            value={borrador.idPeriodoAcademico}
            // Sin año no hay periodos que ofrecer: los PA pertenecen a un año.
            pendienteDe={!borrador.idAnioEscolar && 'año escolar'}
            options={periodos.map((p) => ({ value: p.id_periodo_academico, label: p.nombre }))}
            onChange={(e) => onCambiar('idPeriodoAcademico', e.target.value)}
          />
        </CeldaFiltro>
      )}

      <CeldaFiltro className="basis-full sm:min-w-[220px] sm:basis-[220px]">
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

      {/* En móvil el botón ocupa la fila entera: pegado al último filtro y a
          media anchura, se perdía entre los desplegables. */}
      <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:ml-auto sm:w-auto sm:items-end">
        <Button type="submit" iconLeft={Filter} disabled={!completos} className="w-full sm:w-auto">
          Aplicar
        </Button>
        {hayCambios && (
          <span className="text-xs font-semibold text-warning-600 sm:text-right">{CAMBIOS_SIN_APLICAR}</span>
        )}
        {aviso && <span className="text-xs text-warning-600 sm:max-w-xs sm:text-right">{aviso}</span>}
      </div>
    </form>
  )
}
