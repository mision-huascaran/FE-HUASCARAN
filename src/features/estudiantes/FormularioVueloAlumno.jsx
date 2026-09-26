// Cubre: RF-020, RF-021, RF-022, RN-005, RN-008, RN-011, RN-012, RNF-005
import Input from '../../components/ui/Input'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import Textarea from '../../components/ui/Textarea'

/** Evaluación diagnóstica de un alumno (P7), con su sugerencia calculada. */
export default function FormularioVuelo({ periodos, idPeriodo, onPeriodo, valores, setValores, catalogoRazkids, opciones, nivelInicial, calculo, cargando, soloLectura }) {
  if (cargando || !valores) return <Skeleton variant="table" rows={4} />
  const cambiar = (clave) => (e) => setValores((v) => ({ ...v, [clave]: e.target.value }))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Periodo de evaluación"
          value={idPeriodo}
          onChange={(e) => onPeriodo(e.target.value)}
          options={periodos.map((p) => ({ value: p.id_periodo, label: p.nombre, disabled: p.estado === 'cerrado' }))}
          disabled={soloLectura}
        />
        <Input
          label="Nivel inicial Raz-Kids"
          value={nivelInicial?.letra ?? '—'}
          disabled
          hint="Automático"
        />
      </div>

      <Select
        label="Nivel de la prueba tomada"
        required
        value={valores.nivel_prueba}
        onChange={cambiar('nivel_prueba')}
        placeholder="Seleccione"
        options={catalogoRazkids.map((n) => ({ value: n.letra, label: n.letra }))}
        disabled={soloLectura}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Aciertos" type="number" min="0" required value={valores.aciertos} onChange={cambiar('aciertos')} disabled={soloLectura} />
        <Input label="Total de preguntas" type="number" min="1" required value={valores.total} onChange={cambiar('total')} disabled={soloLectura} />
      </div>

      {/* RN-008: las dos dimensiones van siempre juntas. RN-011: del catálogo. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Fluidez lectora"
          required
          value={valores.fluidez}
          onChange={cambiar('fluidez')}
          placeholder="Seleccione"
          options={(opciones.Fluidez ?? []).map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
          disabled={soloLectura}
        />
        <Select
          label="Comprensión lectora"
          required
          value={valores.comprension}
          onChange={cambiar('comprension')}
          placeholder="Seleccione"
          options={(opciones['Comprensión'] ?? []).map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
          disabled={soloLectura}
        />
      </div>

      <section className="rounded-xl border border-success-600/20 bg-success-100 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-success-600">Sugerencia (calculada)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <LevelChip letra={calculo.nivelSugerido?.letra ?? '—'} />
          <span className="text-sm font-semibold text-ink-900">{calculo.accion}</span>
          {calculo.nivelGeneral && <LevelChip nivel={calculo.nivelGeneral} size="sm" />}
        </div>
        <p className="mt-2 text-xs text-ink-700">
          Las sugerencias no son definitivas hasta que el docente confirme la evaluación.
        </p>
      </section>

      <Textarea label="Observación" maxLength={500} value={valores.observacion} onChange={cambiar('observacion')} disabled={soloLectura} />
    </div>
  )
}

