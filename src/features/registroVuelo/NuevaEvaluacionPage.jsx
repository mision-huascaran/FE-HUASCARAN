// Cubre: RF-019, RF-020, RF-021, RF-022, RN-004, RN-005, RN-009, RN-010, RN-012, RN-013, RNF-005
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Stepper from '../../components/ui/Stepper'
import { useToast } from '../../components/ui/Toast'
import PanelResultados from './PanelResultados'
import PasoEstudiante from './PasoEstudiante'
import PasoEvaluacion from './PasoEvaluacion'
import PasoRevision from './PasoRevision'
import { PASOS_EVALUACION } from './constantes'
import { listarEvaluaciones, guardarEvaluacion } from '../../api/resources/evaluaciones'
import { mensajeDeError } from '../../api/client'
import { calcularNivelFinal } from '../../domain/nivelFinal'
import { agruparNivelesRubrica, useEsperadoPorGrado, useNivelesRazkids, useNivelesRubrica, usePeriodos, useProgramas } from '../../hooks/useCatalogos'

const VACIO = {
  id_periodo: '',
  nivel_prueba: '',
  aciertos: '',
  total: '5',
  fluidez: '',
  comprension: '',
  observacion: '',
}

/**
 * Registrar evaluación diagnóstica (P7): formulario guiado de tres pasos con
 * el panel de resultados a la derecha. Esta página guarda el estado y hace el
 * cálculo; cada paso vive en su propio archivo y solo pinta.
 */
export default function NuevaEvaluacionPage() {
  const navegar = useNavigate()
  const toast = useToast()

  const [paso, setPaso] = useState(0)
  const [alumno, setAlumno] = useState(null)
  const [valores, setValores] = useState(VACIO)

  const { data: periodos = [] } = usePeriodos()
  const { data: programas = [] } = useProgramas()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()
  const { data: esperadoPorGrado = [] } = useEsperadoPorGrado()
  const { data: nivelesRubrica = [] } = useNivelesRubrica()

  // RN-005: el nivel inicial es el nivel final del periodo anterior. Se pide el
  // histórico del alumno para deducirlo; el docente nunca lo escribe.
  const { data: historico = [] } = useQuery({
    queryKey: ['registro-vuelo', 'alumno', alumno?.id_alumno],
    queryFn: () => listarEvaluaciones({ colegio: alumno.id_colegio, q: alumno.codigo }),
    enabled: Boolean(alumno),
  })

  const filaAlumno = historico.find((f) => f.id_alumno === alumno?.id_alumno) ?? null

  const nivelInicial = useMemo(() => {
    const anteriores = (filaAlumno?.secuencia ?? []).filter((s) => s.id_periodo < Number(valores.id_periodo))
    const letra = anteriores.at(-1)?.letra ?? null
    return catalogoRazkids.find((n) => n.letra === letra) ?? null
  }, [filaAlumno, valores.id_periodo, catalogoRazkids])

  // RNF-005: se recalcula en el cliente al cambiar cualquier insumo, memorizado.
  const calculo = useMemo(
    () =>
      calcularNivelFinal({
        nivelEntrada: nivelInicial,
        aciertos: valores.aciertos,
        total: valores.total,
        fluidez: valores.fluidez,
        comprension: valores.comprension,
        programa: alumno?.id_programa,
        nivelEsperadoGrado: esperadoPorGrado.find((e) => e.id_grado === alumno?.id_grado) ?? null,
        catalogoRazkids,
      }),
    [nivelInicial, valores, alumno, esperadoPorGrado, catalogoRazkids],
  )

  const opciones = agruparNivelesRubrica(nivelesRubrica)[alumno?.id_programa] ?? {}
  const nombrePeriodo = periodos.find((p) => p.id_periodo === Number(valores.id_periodo))?.nombre ?? '—'
  const cambiar = (clave) => (e) => setValores((v) => ({ ...v, [clave]: e.target.value }))
  const paso2Completo = Boolean(valores.id_periodo) && Boolean(valores.nivel_prueba) && calculo.completo

  const mutacion = useMutation({
    mutationFn: guardarEvaluacion,
    onSuccess: () => {
      toast.success('Evaluación guardada', `${alumno.nombre} · ${nombrePeriodo}`)
      navegar('/registro-vuelo')
    },
    onError: (error) => toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  function guardar(estado) {
    mutacion.mutate({
      id_alumno: alumno.id_alumno,
      id_periodo: Number(valores.id_periodo),
      nivel_inicial_razkids: nivelInicial?.letra ?? null,
      nivel_prueba: valores.nivel_prueba,
      aciertos: Number(valores.aciertos),
      total: Number(valores.total),
      fluidez: valores.fluidez,
      comprension: valores.comprension,
      nivel_sugerido: calculo.nivelSugerido?.letra ?? null,
      nivel_ajustado: calculo.nivelSugerido?.letra ?? null,
      nivel_general: calculo.nivelGeneral,
      observacion: valores.observacion,
      estado,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Registrar evaluación diagnóstica</h1>
        <p className="mt-1 text-sm text-ink-500">
          Los datos de Raz-Kids se transcriben a mano: la plataforma no expone una API (RF-020).
        </p>
      </header>

      <Card>
        <Stepper steps={PASOS_EVALUACION} current={paso} onStepClick={setPaso} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          {paso === 0 && (
            <PasoEstudiante
              alumno={alumno}
              programas={programas}
              onSeleccionar={(a) => {
                setAlumno(a)
                setPaso(1)
              }}
            />
          )}

          {paso === 1 && (
            <PasoEvaluacion
              alumno={alumno}
              valores={valores}
              cambiar={cambiar}
              periodos={periodos}
              catalogoRazkids={catalogoRazkids}
              opciones={opciones}
              nivelInicial={nivelInicial}
              completo={paso2Completo}
              onAnterior={() => setPaso(0)}
              onSiguiente={() => setPaso(2)}
            />
          )}

          {paso === 2 && (
            <PasoRevision
              alumno={alumno}
              nombrePeriodo={nombrePeriodo}
              valores={valores}
              nivelInicial={nivelInicial}
              calculo={calculo}
              guardando={mutacion.isPending}
              onCancelar={() => navegar('/registro-vuelo')}
              onGuardar={guardar}
            />
          )}
        </div>

        <PanelResultados
          calculo={calculo}
          nivelInicial={nivelInicial}
          nivelPrueba={valores.nivel_prueba}
          aciertos={valores.aciertos}
          total={valores.total}
        />
      </div>
    </div>
  )
}
