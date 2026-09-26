// Cubre: RF-021, RF-023, RN-014, RN-015, RNF-005
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'

/**
 * Sugerencia calculada y decisión del docente (P6).
 * RF-023 / RN-015: si el docente cambia la sugerencia, la justificación es obligatoria.
 */
export default function BloqueDecision({ nivelSugerido, accion, nivelFinal, cambiaSugerencia, faltaJustificacion, valores, cambiar, catalogoRazkids }) {
  return (
    <>
      {/* Bloque de sugerencia calculada (RNF-005). */}
      <section className="rounded-xl border border-success-600/20 bg-success-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-success-600">
          Sugerencia (calculada)
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LevelChip letra={nivelSugerido || '—'} />
          <span className="text-sm font-semibold text-ink-900">{accion}</span>
        </div>
        <p className="mt-2 text-xs text-ink-700">
          Las sugerencias no son definitivas hasta que el docente confirme la evaluación.
        </p>
      </section>

      <Select
        label="Nivel final (decisión del docente)"
        value={nivelFinal}
        onChange={cambiar('nivel_ajustado')}
        options={catalogoRazkids.map((n) => ({ value: n.letra, label: n.letra }))}
      />

      {/* RF-023 / RN-015 */}
      {cambiaSugerencia && (
        <Textarea
          label="Justificación del cambio"
          required
          maxLength={500}
          value={valores.justificacion}
          onChange={cambiar('justificacion')}
          error={faltaJustificacion ? 'Obligatoria al modificar el nivel sugerido' : undefined}
          hint="Explique por qué modifica el nivel propuesto"
        />
      )}
    </>
  )
}
