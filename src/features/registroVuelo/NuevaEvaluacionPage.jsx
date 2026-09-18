// Cubre: RF-019, RF-020, RF-021, RF-022, RN-004, RN-005, RN-009, RN-010, RN-012, RN-013, RNF-005
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Check, Lock, Search } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import LevelChip from '../../components/ui/LevelChip'
import Select from '../../components/ui/Select'
import Stepper from '../../components/ui/Stepper'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import PanelResultados from './PanelResultados'
import { PASOS_EVALUACION } from './constantes'
import { listarAlumnos } from '../../api/resources/alumnos'
import { listarEvaluaciones, guardarEvaluacion } from '../../api/resources/evaluaciones'
import { mensajeDeError } from '../../api/client'
import { calcularNivelFinal } from '../../domain/nivelFinal'
import { agruparNivelesRubrica, useEsperadoPorGrado, useNivelesRazkids, useNivelesRubrica, usePeriodos, useProgramas } from '../../hooks/useCatalogos'
import useDebounce from '../../hooks/useDebounce'

const VACIO = {
  id_periodo: '',
  nivel_prueba: '',
  aciertos: '',
  total: '5',
  fluidez: '',
  comprension: '',
  observacion: '',
}

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

  const mutacion = useMutation({
    mutationFn: guardarEvaluacion,
    onSuccess: () => {
      toast.success('Evaluación guardada', `${alumno.nombre} · ${nombrePeriodo}`)
      navegar('/registro-vuelo')
    },
    onError: (error) =>
      toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  const nombrePeriodo = periodos.find((p) => p.id_periodo === Number(valores.id_periodo))?.nombre ?? '—'
  const cambiar = (clave) => (e) => setValores((v) => ({ ...v, [clave]: e.target.value }))

  const paso2Completo =
    Boolean(valores.id_periodo) && Boolean(valores.nivel_prueba) && calculo.completo

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
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                    Nivel inicial Raz-Kids
                  </p>
                  <div className="mt-2">
                    <LevelChip letra={nivelInicial?.letra} />
                  </div>
                  <p className="mt-2 text-xs text-ink-500">
                    Es el nivel final del periodo anterior. No se edita (RN-005).
                  </p>
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
                  <Input
                    label="Total de preguntas"
                    type="number"
                    min="1"
                    required
                    value={valores.total}
                    onChange={cambiar('total')}
                  />
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
                  options={(opciones['Comprensión'] ?? []).map((n) => ({
                    value: n.nombre_nivel,
                    label: n.nombre_nivel,
                  }))}
                />

                <Textarea
                  label="Observaciones"
                  maxLength={500}
                  value={valores.observacion}
                  onChange={cambiar('observacion')}
                />

                <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                  <Button variant="ghost" onClick={() => setPaso(0)}>
                    Anterior
                  </Button>
                  <Button onClick={() => setPaso(2)} disabled={!paso2Completo}>
                    Revisar y guardar
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {paso === 2 && (
            <Card title="Revisar y guardar" subtitle={`${alumno?.nombre} · ${nombrePeriodo}`}>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Resumen termino="Estudiante" valor={alumno?.nombre} />
                <Resumen termino="Código" valor={alumno?.codigo} />
                <Resumen termino="Colegio" valor={alumno?.colegio} />
                <Resumen termino="Ciclo evaluado" valor={alumno?.ciclo_evaluado} />
                <Resumen termino="Periodo" valor={nombrePeriodo} />
                <Resumen termino="Nivel inicial" valor={nivelInicial?.letra ?? '—'} />
                <Resumen termino="Prueba aplicada" valor={valores.nivel_prueba} />
                <Resumen termino="Resultado" valor={`${valores.aciertos} / ${valores.total}`} />
                <Resumen termino="Fluidez" valor={valores.fluidez} />
                <Resumen termino="Comprensión" valor={valores.comprension} />
                <Resumen termino="Nivel sugerido" valor={calculo.nivelSugerido?.letra ?? '—'} />
                <Resumen termino="Nivel final de rúbrica" valor={calculo.nivelGeneral ?? '—'} />
              </dl>

              {valores.observacion && (
                <p className="mt-4 rounded-xl bg-surface-50 p-3 text-sm text-ink-700">{valores.observacion}</p>
              )}

              <p className="mt-5 flex items-center gap-2 rounded-xl border border-success-600/20 bg-success-100 px-4 py-3 text-sm font-medium text-success-600">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                Todos los campos obligatorios están completos
              </p>

              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <Button variant="ghost" onClick={() => navegar('/registro-vuelo')}>
                  Cancelar
                </Button>
                <Button variant="secondary" onClick={() => guardar('pendiente')} loading={mutacion.isPending}>
                  Guardar borrador
                </Button>
                <Button onClick={() => guardar('revisado')} loading={mutacion.isPending}>
                  Guardar evaluación
                </Button>
              </div>
            </Card>
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

/**
 * Paso 1 — al elegir al estudiante, sus datos se autocompletan y se bloquean.
 * RN-004: grado, ciclo evaluado y programa son tres datos distintos; el grado no
 * determina ni el ciclo ni el programa.
 */
function PasoEstudiante({ alumno, programas, onSeleccionar }) {
  const [texto, setTexto] = useState('')
  const busqueda = useDebounce(texto, 400)

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['alumnos', 'buscar', busqueda],
    queryFn: () => listarAlumnos({ q: busqueda }),
    enabled: busqueda.trim().length >= 3,
  })

  const nombrePrograma = programas.find((p) => p.id_programa === alumno?.id_programa)?.nombre ?? '—'

  return (
    <Card title="Datos del estudiante">
      <Input
        label="Buscar estudiante"
        iconLeft={Search}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre o código (mínimo 3 caracteres)"
        hint="Los datos se completan automáticamente al seleccionar al estudiante"
      />

      {busqueda.trim().length >= 3 && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-line">
          {isFetching && <p className="p-4 text-sm text-ink-500">Buscando…</p>}
          {!isFetching && resultados.length === 0 && (
            <EmptyState title="Sin resultados" description="Revise el nombre o el código." />
          )}
          {resultados.slice(0, 25).map((a) => (
            <button
              key={a.id_alumno}
              type="button"
              onClick={() => onSeleccionar(a)}
              className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-0 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-900">{a.nombre}</span>
                <span className="block text-xs text-ink-400">
                  {a.codigo} · {a.colegio}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-brand-700">Seleccionar</span>
            </button>
          ))}
        </div>
      )}

      {alumno && (
        <div className="mt-5 border-t border-line pt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="ID del sistema" value={alumno.codigo} disabled />
            <Input label="Nombre" value={alumno.nombre} disabled />
            <Input label="Colegio" value={alumno.colegio ?? '—'} disabled />
            <Input label="Grado" value={`${alumno.id_grado}.°`} disabled />
            <Input label="Programa" value={nombrePrograma} disabled />
            <Input label="Ciclo evaluado" value={alumno.ciclo_evaluado ?? '—'} disabled />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Estos datos se completan automáticamente al seleccionar al estudiante
          </p>
        </div>
      )}
    </Card>
  )
}

function Resumen({ termino, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{termino}</dt>
      <dd className="text-sm font-medium text-ink-900">{valor ?? '—'}</dd>
    </div>
  )
}
