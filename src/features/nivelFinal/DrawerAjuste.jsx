// Cubre: RF-023, RN-009, RN-015
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { ajustarNivelFinal } from '../../api/resources/nivelFinal'
import { mensajeDeError } from '../../api/client'

/**
 * Ajuste del nivel final mensual (P9).
 *
 * El nivel calculado se muestra bloqueado: es un valor derivado de las rúbricas
 * semanales (RF-018), no algo que el docente escriba. Solo el nivel final se
 * puede cambiar, y hacerlo obliga a justificarlo (RN-015).
 */
export default function DrawerAjuste({ open, onClose, fila, nivelesGenerales = [], mes }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [nivelFinal, setNivelFinal] = useState('')
  const [justificacion, setJustificacion] = useState('')

  useEffect(() => {
    if (!open || !fila) return
    setNivelFinal(fila.nivel_final ?? fila.nivel_calculado ?? '')
    setJustificacion(fila.justificacion ?? '')
  }, [open, fila])

  const hayCambio = Boolean(nivelFinal && nivelFinal !== fila?.nivel_calculado)
  const faltaJustificacion = hayCambio && !justificacion.trim()

  const mutacion = useMutation({
    mutationFn: ajustarNivelFinal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nivel-final'] })
      toast.success('Nivel final ajustado', fila?.nombre)
      onClose()
    },
    onError: (error) =>
      toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  if (!fila) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ajustar nivel final"
      subtitle={`${fila.nombre} · ${fila.codigo}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={mutacion.isPending}
            disabled={faltaJustificacion}
            onClick={() =>
              mutacion.mutate({
                id_nivel_final: fila.id_nivel_final,
                id_alumno: fila.id_alumno,
                mes,
                nivel_final: nivelFinal,
                justificacion,
              })
            }
          >
            Guardar ajuste
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-line bg-surface-50 p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-ink-400" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Nivel calculado</p>
          </div>
          <div className="mt-2">
            <LevelChip nivel={fila.nivel_calculado} />
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Derivado de {fila.semanas_sustento} de {fila.semanas_mes} rúbricas semanales del mes. No es
            editable.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs text-ink-400">Fluidez</p>
            <div className="mt-1">
              <LevelChip nivel={fila.fluidez} size="sm" />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs text-ink-400">Comprensión</p>
            <div className="mt-1">
              <LevelChip nivel={fila.comprension} size="sm" />
            </div>
          </div>
        </div>

        <Select
          label="Nivel final"
          required
          value={nivelFinal}
          onChange={(e) => setNivelFinal(e.target.value)}
          options={nivelesGenerales.map((n) => ({ value: n.nombre_nivel, label: n.nombre_nivel }))}
        />

        {/* RN-015: cambiar el nivel calculado exige justificación escrita. */}
        <Textarea
          label="Justificación"
          required={hayCambio}
          maxLength={500}
          value={justificacion}
          onChange={(e) => setJustificacion(e.target.value)}
          error={faltaJustificacion ? 'Obligatoria al modificar el nivel calculado' : undefined}
          hint={
            hayCambio
              ? 'Está cambiando el nivel que calculó el sistema: explique por qué.'
              : 'Solo se exige cuando el nivel final difiere del calculado.'
          }
        />
      </div>
    </Drawer>
  )
}
