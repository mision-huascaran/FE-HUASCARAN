import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { listarEvaluaciones } from '../../api/resources/evaluaciones'
import { useColegios, useEsperadoPorGrado, useGrados, useNivelesRazkids, usePeriodos, useProgramas } from '../../hooks/useCatalogos'
import { calcularNivelFinal } from '../../domain/nivelFinal'
import { secuenciaDeLetras, tendenciaDe } from '../../domain/niveles'

/**
 * Filtros y datos del histórico del registro de vuelo (P6).
 *
 * Los filtros viven en la URL para poder compartir la vista, pero se editan
 * sobre un borrador: la consulta solo se dispara al pulsar "Aplicar filtros",
 * porque cada cambio recarga el histórico de cientos de alumnos.
 */
const VACIO = { colegio: '', grado: '', programa: '', periodo: '', q: '' }

export default function useHistoricoVuelo() {
  const [params, setParams] = useSearchParams()

  const aplicados = useMemo(
    () => ({
      colegio: params.get('colegio') ?? '',
      grado: params.get('grado') ?? '',
      programa: params.get('programa') ?? '',
      periodo: params.get('periodo') ?? '',
      q: params.get('q') ?? '',
    }),
    [params],
  )

  const [borrador, setBorrador] = useState(aplicados)

  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data: periodos = [] } = usePeriodos()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()
  const { data: esperadoPorGrado = [] } = useEsperadoPorGrado()

  const consulta = useQuery({
    queryKey: ['registro-vuelo', aplicados],
    queryFn: () => listarEvaluaciones(aplicados),
    // Sin colegio serían 413 alumnos de golpe: se exige al menos un colegio.
    enabled: Boolean(aplicados.colegio),
  })

  /**
   * Tendencia y sugerencia se calculan aquí, en el cliente: la tendencia compara
   * la secuencia por `orden` (RN-012) y la sugerencia sale de `domain/nivelFinal`,
   * que es la única fuente del cálculo (RN-009).
   */
  const filas = useMemo(() => {
    const evaluaciones = consulta.data ?? []
    return evaluaciones.map((fila) => {
      const secuencia = fila.secuencia ?? []
      const evaluacion = fila.evaluacion
      const nivelEntrada = catalogoRazkids.find((n) => n.letra === evaluacion?.nivel_inicial_razkids) ?? null
      const nivelEsperadoGrado = esperadoPorGrado.find((e) => e.id_grado === fila.id_grado) ?? null

      const calculo = evaluacion
        ? calcularNivelFinal({
            nivelEntrada,
            aciertos: evaluacion.aciertos,
            total: evaluacion.total,
            fluidez: evaluacion.fluidez,
            comprension: evaluacion.comprension,
            programa: fila.id_programa,
            nivelEsperadoGrado,
            catalogoRazkids,
          })
        : null

      return {
        ...fila,
        tendencia: tendenciaDe(secuencia.map((s) => s.orden)),
        ultimos3: secuenciaDeLetras(secuencia.map((s) => s.letra)),
        calculo,
        estado: evaluacion?.estado ?? 'sin-registro',
      }
    })
  }, [consulta.data, catalogoRazkids, esperadoPorGrado])

  function aplicar(siguiente = borrador) {
    const nuevos = new URLSearchParams()
    Object.entries(siguiente).forEach(([clave, valor]) => {
      if (valor !== '' && valor != null) nuevos.set(clave, String(valor))
    })
    setParams(nuevos, { replace: true })
  }

  function limpiar() {
    setBorrador(VACIO)
    setParams(new URLSearchParams(), { replace: true })
  }

  const activos = Object.values(aplicados).filter(Boolean).length

  return {
    catalogos: { colegios, grados, programas, periodos, catalogoRazkids, esperadoPorGrado },
    borrador,
    setCampo: (clave, valor) => setBorrador((b) => ({ ...b, [clave]: valor })),
    aplicados,
    aplicar,
    limpiar,
    activos,
    filas,
    cargando: consulta.isLoading,
    error: consulta.error,
    sinColegio: !aplicados.colegio,
    refrescar: consulta.refetch,
  }
}
