// Cubre: RF-020, RF-021, RN-005, RN-008, RN-010, RN-011
import { Lock } from 'lucide-react'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'

/** Campos de la prueba y de la rúbrica del panel "Editar evaluación" (P6). */
export default function CamposPrueba({ idPeriodo, setIdPeriodo, periodoCerrado, periodos, nivelInicial, valores, cambiar, catalogoRazkids, opciones }) {
  return (
    <>
      {/* RN-010: los cortes anteriores están bloqueados. */}
      <div className="flex items-start gap-2 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-xs font-medium text-warning-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Los históricos anteriores están bloqueados. Para corregirlos se requiere una justificación.
      </div>

      <Select
        label="Periodo de evaluación"
        required
        value={idPeriodo}
        onChange={(e) => setIdPeriodo(e.target.value)}
        options={periodos.map((p) => ({
          value: p.id_periodo,
          label: `${p.nombre}${p.estado === 'cerrado' ? ' 🔒' : ''}`,
        }))}
        hint={periodoCerrado ? 'Periodo cerrado: requiere justificación para corregirse' : undefined}
      />

      <Input
        label="Nivel inicial Raz-Kids"
        value={nivelInicial?.letra ?? '—'}
        disabled
        hint="Automático"
      />

      <Select
        label="Nivel de la prueba tomada"
        required
        value={valores.nivel_prueba}
        onChange={cambiar('nivel_prueba')}
        placeholder="Seleccione"
        options={catalogoRazkids.map((n) => ({ value: n.letra, label: n.letra }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Aciertos"
          type="number"
          min="0"
          required
          value={valores.aciertos}
          onChange={cambiar('aciertos')}
        />
        <Input
          label="Total de preguntas"
          type="number"
          min="1"
          required
          value={valores.total}
          onChange={cambiar('total')}
        />
      </div>

      {/* RN-011: las opciones vienen del catálogo, filtradas por programa. */}
      <Select
        label="Fluidez lectora"
        required
        value={valores.fluidez}
        onChange={cambiar('fluidez')}
        placeholder="Seleccione"
        options={(opciones.Fluidez ?? []).map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
      />
      <Select
        label="Comprensión lectora"
        required
        value={valores.comprension}
        onChange={cambiar('comprension')}
        placeholder="Seleccione"
        options={(opciones['Comprensión'] ?? []).map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
      />
    </>
  )
}
