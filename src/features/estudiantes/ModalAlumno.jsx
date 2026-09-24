// Cubre: RF-012, RF-013, RF-015, RF-016, RF-017, RF-020, RF-021, RF-022,
//        RN-006, RN-007, RN-008, RN-011, RN-012, RNF-001, RNF-005, RNF-006
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Tabs from '../../components/ui/Tabs'
import FormularioSemanal from './FormularioSemanalAlumno'
import FormularioVuelo from './FormularioVueloAlumno'
import ResumenFicha from './ResumenFichaAlumno'
import useDatosAlumno from './useDatosAlumno'
import useGuardadoAlumno from './useGuardadoAlumno'
import { calcularNivelFinal } from '../../domain/nivelFinal'
import { agruparNivelesRubrica, useEsperadoPorGrado, useNivelesRazkids, useNivelesRubrica, usePeriodos, useSemanas } from '../../hooks/useCatalogos'

/**
 * Atajo de captura para UN estudiante (RNF-006).
 *
 * Abre desde la tabla de estudiantes y trae, en una sola ventana, el reporte
 * semanal y el registro de vuelo de ese alumno más su ficha resumida, sin tener
 * que ir a cada pantalla por separado y filtrar hasta encontrarlo.
 *
 * Guarda por la MISMA vía que las pantallas completas: el reporte semanal pasa
 * por la cola offline con su clave de idempotencia (RNF-001) y la evaluación por
 * su recurso, así que no hay un segundo camino de guardado que mantener.
 */
const PESTANAS = [
  { value: 'semanal', label: 'Reporte semanal' },
  { value: 'vuelo', label: 'Registro de vuelo' },
  { value: 'ficha', label: 'Ficha del estudiante' },
]

export default function ModalAlumno({ alumno, abierto, onCerrar, soloLectura = false }) {
  const [pestana, setPestana] = useState('semanal')

  const { data: semanas = [] } = useSemanas()
  const { data: periodos = [] } = usePeriodos()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()
  const { data: esperadoPorGrado = [] } = useEsperadoPorGrado()
  const { data: nivelesRubrica = [] } = useNivelesRubrica()

  const [idSemana, setIdSemana] = useState('')
  const [idPeriodo, setIdPeriodo] = useState('')
  const [semanal, setSemanal] = useState(null)
  const [vuelo, setVuelo] = useState(null)

  const semanaActual = idSemana || semanas.at(-1)?.id_semana || ''
  const periodoAbierto = periodos.find((p) => p.estado === 'abierto') ?? periodos.at(-1)
  const periodoActual = idPeriodo || periodoAbierto?.id_periodo || ''

  const { filaSemanal, filaVuelo, consultaSemanal, consultaVuelo, consultaFicha } = useDatosAlumno({
    alumno,
    abierto,
    semanaActual,
    pestana,
  })
  // Al abrir (o al cambiar de semana) se cargan los datos guardados en el formulario.
  useEffect(() => {
    if (!abierto) return
    setSemanal({
      asistio: filaSemanal?.asistio ?? true,
      lsl: filaSemanal?.lsl ?? 0,
      libros: (filaSemanal?.libros ?? []).map((l) => ({ ...l })),
      observacion: filaSemanal?.observacion ?? '',
    })
  }, [abierto, filaSemanal])

  useEffect(() => {
    if (!abierto) return
    const ev = filaVuelo?.por_periodo?.[periodoActual] ? filaVuelo.evaluacion : null
    setVuelo({
      nivel_prueba: ev?.nivel_prueba ?? '',
      aciertos: ev?.aciertos ?? '',
      total: ev?.total ?? 5,
      fluidez: ev?.fluidez ?? '',
      comprension: ev?.comprension ?? '',
      observacion: ev?.observacion ?? '',
    })
  }, [abierto, filaVuelo, periodoActual])

  useEffect(() => {
    if (abierto) setPestana('semanal')
  }, [abierto])

  // RN-005: el nivel inicial es el nivel final del corte anterior, nunca se escribe.
  const nivelInicial = useMemo(() => {
    const anteriores = (filaVuelo?.secuencia ?? []).filter((s) => s.id_periodo < Number(periodoActual))
    return catalogoRazkids.find((n) => n.letra === anteriores.at(-1)?.letra) ?? null
  }, [filaVuelo, periodoActual, catalogoRazkids])

  // RNF-005: la sugerencia se calcula en el cliente, sin esperar al servidor.
  const calculo = useMemo(
    () =>
      calcularNivelFinal({
        nivelEntrada: nivelInicial,
        aciertos: vuelo?.aciertos,
        total: vuelo?.total,
        fluidez: vuelo?.fluidez,
        comprension: vuelo?.comprension,
        programa: alumno?.id_programa,
        nivelEsperadoGrado: esperadoPorGrado.find((e) => e.id_grado === alumno?.id_grado) ?? null,
        catalogoRazkids,
      }),
    [nivelInicial, vuelo, alumno, esperadoPorGrado, catalogoRazkids],
  )

  const opciones = agruparNivelesRubrica(nivelesRubrica)[alumno?.id_programa] ?? {}

  const { guardarSemanal, guardarVuelo, guardando } = useGuardadoAlumno({
    alumno,
    semanas,
    semanaActual,
    periodoActual,
    semanal,
    vuelo,
    nivelInicial,
    calculo,
    onCerrar,
  })

  // Con todos los hooks ya llamados: React exige el mismo orden en cada render.
  if (!alumno) return null

  const puedeGuardarVuelo = Boolean(periodoActual) && Boolean(vuelo?.nivel_prueba) && calculo.completo

  return (
    <Modal
      open={abierto}
      onClose={onCerrar}
      size="max-w-3xl"
      title={alumno.nombre}
      subtitle={`${alumno.codigo} · ${alumno.colegio} · ${alumno.id_grado}.° grado`}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>Cancelar</Button>
          {pestana === 'semanal' && (
            <Button disabled={soloLectura || !semanal} onClick={guardarSemanal}>Guardar</Button>
          )}
          {pestana === 'vuelo' && (
            <Button disabled={soloLectura || !puedeGuardarVuelo} loading={guardando} onClick={guardarVuelo}>
              Guardar
            </Button>
          )}
          {pestana === 'ficha' && (
            <Link
              to={`/estudiantes/${alumno.id_alumno}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Abrir ficha completa
            </Link>
          )}
        </>
      }
    >
      <Tabs value={pestana} onChange={setPestana} items={PESTANAS} />

      <div className="mt-5">
        {pestana === 'semanal' && (
          <FormularioSemanal
            semanas={semanas}
            idSemana={String(semanaActual)}
            onSemana={setIdSemana}
            valores={semanal}
            setValores={setSemanal}
            cargando={consultaSemanal.isLoading}
            soloLectura={soloLectura}
          />
        )}

        {pestana === 'vuelo' && (
          <FormularioVuelo
            periodos={periodos}
            idPeriodo={String(periodoActual)}
            onPeriodo={setIdPeriodo}
            valores={vuelo}
            setValores={setVuelo}
            catalogoRazkids={catalogoRazkids}
            opciones={opciones}
            nivelInicial={nivelInicial}
            calculo={calculo}
            cargando={consultaVuelo.isLoading}
            soloLectura={soloLectura}
          />
        )}

        {pestana === 'ficha' && <ResumenFicha ficha={consultaFicha.data} cargando={consultaFicha.isLoading} catalogoRazkids={catalogoRazkids} />}
      </div>
    </Modal>
  )
}
