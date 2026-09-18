// Cubre: RF-020, RF-021, RF-022, RF-023, RN-005, RN-010, RN-011, RN-014, RN-015, RNF-005
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, TriangleAlert } from 'lucide-react'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import Input from '../../components/ui/Input'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { guardarEvaluacion } from '../../api/resources/evaluaciones'
import { mensajeDeError } from '../../api/client'
import { calcularNivelFinal } from '../../domain/nivelFinal'
import { agruparNivelesRubrica, useNivelesRubrica } from '../../hooks/useCatalogos'

const VACIO = {
  nivel_prueba: '',
  aciertos: '',
  total: '',
  fluidez: '',
  comprension: '',
  nivel_ajustado: '',
  justificacion: '',
  observacion: '',
}

export default function DrawerEvaluacion({ open, onClose, fila, periodos, catalogoRazkids, esperadoPorGrado }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: nivelesRubrica = [] } = useNivelesRubrica()

  const [idPeriodo, setIdPeriodo] = useState('')
  const [valores, setValores] = useState(VACIO)

  const evaluacion = fila?.evaluacion ?? null

  // Al abrir el panel se precarga la evaluación del periodo vigente del alumno.
  useEffect(() => {
    if (!open || !fila) return
    const abierto = periodos.find((p) => p.estado === 'abierto') ?? periodos.at(-1)
    const inicial = fila.por_periodo?.[abierto?.id_periodo]
    setIdPeriodo(String(abierto?.id_periodo ?? ''))
    setValores({
      nivel_prueba: evaluacion?.nivel_prueba ?? '',
      aciertos: evaluacion?.aciertos ?? '',
      total: evaluacion?.total ?? '',
      fluidez: evaluacion?.fluidez ?? '',
      comprension: evaluacion?.comprension ?? '',
      nivel_ajustado: inicial?.letra ?? evaluacion?.nivel_ajustado ?? '',
      justificacion: evaluacion?.justificacion ?? '',
      observacion: evaluacion?.observacion ?? '',
    })
  }, [open, fila, evaluacion, periodos])

  const periodo = periodos.find((p) => p.id_periodo === Number(idPeriodo))
  // RN-010: solo el corte vigente se edita; los anteriores están cerrados.
  const periodoCerrado = periodo?.estado === 'cerrado'

  const opciones = agruparNivelesRubrica(nivelesRubrica)[fila?.id_programa] ?? {}

  /**
   * RN-005: el nivel inicial es el nivel final del periodo anterior. Es un dato
   * derivado, nunca editable, y se muestra bloqueado.
   */
  const nivelInicial = useMemo(() => {
    if (!fila) return null
    const anteriores = (fila.secuencia ?? []).filter((s) => s.id_periodo < Number(idPeriodo))
    const letra = anteriores.at(-1)?.letra ?? evaluacion?.nivel_inicial_razkids ?? null
    return catalogoRazkids.find((n) => n.letra === letra) ?? null
  }, [fila, idPeriodo, evaluacion, catalogoRazkids])

  // RNF-005: el cálculo corre en el cliente y se memoriza; la sugerencia se
  // pinta al instante, sin esperar respuesta del servidor.
  const calculo = useMemo(
    () =>
      calcularNivelFinal({
        nivelEntrada: nivelInicial,
        aciertos: valores.aciertos,
        total: valores.total,
        fluidez: valores.fluidez,
        comprension: valores.comprension,
        programa: fila?.id_programa,
        nivelEsperadoGrado: esperadoPorGrado.find((e) => e.id_grado === fila?.id_grado) ?? null,
        catalogoRazkids,
      }),
    [nivelInicial, valores, fila, esperadoPorGrado, catalogoRazkids],
  )

  const nivelSugerido = calculo.nivelSugerido?.letra ?? ''
  const nivelFinal = valores.nivel_ajustado || nivelSugerido
  // RF-023 / RN-015: cambiar la sugerencia obliga a justificar por escrito.
  const cambiaSugerencia = Boolean(nivelSugerido && nivelFinal && nivelFinal !== nivelSugerido)
  const faltaJustificacion = cambiaSugerencia && !valores.justificacion.trim()

  const mutacion = useMutation({
    mutationFn: guardarEvaluacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registro-vuelo'] })
      toast.success('Evaluación guardada')
      onClose()
    },
    onError: (error) =>
      toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  function enviar(estado) {
    mutacion.mutate({
      id_alumno: fila.id_alumno,
      id_periodo: Number(idPeriodo),
      nivel_inicial_razkids: nivelInicial?.letra ?? null,
      nivel_prueba: valores.nivel_prueba || nivelInicial?.letra || null,
      aciertos: Number(valores.aciertos),
      total: Number(valores.total),
      fluidez: valores.fluidez,
      comprension: valores.comprension,
      nivel_sugerido: nivelSugerido,
      nivel_ajustado: nivelFinal,
      nivel_general: calculo.nivelGeneral,
      justificacion: valores.justificacion,
      observacion: valores.observacion,
      estado,
    })
  }

  const cambiar = (clave) => (e) => setValores((v) => ({ ...v, [clave]: e.target.value }))

  if (!fila) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Editar evaluación"
      subtitle={`${fila.nombre} · ${fila.grado_nombre} · ${fila.colegio}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => enviar('pendiente')} loading={mutacion.isPending}>
            Guardar borrador
          </Button>
          <Button
            onClick={() => enviar('revisado')}
            loading={mutacion.isPending}
            disabled={faltaJustificacion || !calculo.completo}
          >
            Confirmar evaluación
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
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
          hint="Automático: es el nivel final del periodo anterior (RN-005)"
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

        {/* Bloque de sugerencia calculada (RNF-005). */}
        <section className="rounded-xl border border-success-600/20 bg-success-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-success-600">
            Sugerencia (calculada)
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LevelChip letra={nivelSugerido || '—'} />
            <span className="text-sm font-semibold text-ink-900">{calculo.accion}</span>
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
          hint="RN-014: el nivel del docente y el de Raz-Kids se conservan por separado"
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
            hint="El sistema propuso otro nivel: explique por qué lo modifica."
          />
        )}

        <Textarea
          label="Observación"
          maxLength={500}
          value={valores.observacion}
          onChange={cambiar('observacion')}
        />

        {!calculo.completo && (
          <p className="flex items-start gap-2 text-xs font-medium text-warning-600">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Complete la prueba y las dos dimensiones de la rúbrica para poder confirmar.
          </p>
        )}
      </div>
    </Drawer>
  )
}
