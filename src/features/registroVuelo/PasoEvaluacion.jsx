// Cubre: RF-020, RF-022, RN-005, RN-008, RN-010, RN-011
import { Lock } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'

/**
 * Paso 2 (P7) — datos de la prueba y las dos dimensiones de la rúbrica.
 * Solo pinta y reporta cambios: el cálculo vive en `domain/nivelFinal.js`.
 */
export default function PasoEvaluacion({
  alumno,
  valores,
  cambiar,
  periodos,
  catalogoRazkids,
  opciones,
  nivelInicial,
  completo,
  onAnterior,
  onSiguiente,
}) {
  return (
    <Card title="Registrar evaluación" subtitle={alumno?.nombre}>
      <div className="flex flex-col gap-4">
        {/* RN-010: los cuatro cortes del año. */}
        <Select
          label="Periodo de evaluación"
          required
          value={valores.id_periodo}
          onChange={cambiar('id_periodo')}
          placeholder="Seleccione el corte"
          options={periodos.map((p) => ({
            value: p.id_periodo,
            label: p.nombre,
            disabled: p.estado === 'cerrado',
          }))}
          hint="Los cortes cerrados no admiten registros nuevos"
        />

        <div className="rounded-xl border border-line bg-surface-50 p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-ink-400" aria-hidden="true" />
            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-ink-500">
              AUTOMÁTICO
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Nivel inicial Raz-Kids</p>
          <div className="mt-2">
            <LevelChip letra={nivelInicial?.letra} />
          </div>
          <p className="mt-2 text-xs text-ink-500">Es el nivel final del periodo anterior. No se edita (RN-005).</p>
        </div>

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
            max={valores.total}
            required
            value={valores.aciertos}
            onChange={cambiar('aciertos')}
          />
          <Input label="Total de preguntas" type="number" min="1" required value={valores.total} onChange={cambiar('total')} />
        </div>

        {/* RN-008 / RN-011: ambas dimensiones, con opciones del catálogo. */}
        <Select
          label="Rúbrica de Fluidez"
          required
          value={valores.fluidez}
          onChange={cambiar('fluidez')}
          placeholder="Seleccione"
          options={(opciones.Fluidez ?? []).map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
        />
        <Select
          label="Rúbrica de Comprensión"
          required
          value={valores.comprension}
          onChange={cambiar('comprension')}
          placeholder="Seleccione"
          options={(opciones['Comprensión'] ?? []).map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
        />

        <Textarea label="Observaciones" maxLength={500} value={valores.observacion} onChange={cambiar('observacion')} />

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button variant="ghost" onClick={onAnterior}>
            Anterior
          </Button>
          <Button onClick={onSiguiente} disabled={!completo}>
            Revisar y guardar
          </Button>
        </div>
      </div>
    </Card>
  )
}
