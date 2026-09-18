// Cubre: RF-020, RF-021, RF-022, RF-023, RN-005, RN-010, RN-011, RN-014, RN-015, RNF-005
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import BloqueDecision from './BloqueDecision'
import CamposPrueba from './CamposPrueba'
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
        <CamposPrueba
          idPeriodo={idPeriodo}
          setIdPeriodo={setIdPeriodo}
          periodoCerrado={periodoCerrado}
          periodos={periodos}
          nivelInicial={nivelInicial}
          valores={valores}
          cambiar={cambiar}
          catalogoRazkids={catalogoRazkids}
          opciones={opciones}
        />

        <BloqueDecision
          nivelSugerido={nivelSugerido}
          accion={calculo.accion}
          nivelFinal={nivelFinal}
          cambiaSugerencia={cambiaSugerencia}
          faltaJustificacion={faltaJustificacion}
          valores={valores}
          cambiar={cambiar}
          catalogoRazkids={catalogoRazkids}
        />

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
