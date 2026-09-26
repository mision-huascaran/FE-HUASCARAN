// RN-009 / RF-019 / RN-013 / RN-012 — ÚNICA fuente del cálculo del nivel final.
//
// Pendiente RN-009: fórmula por validar con Patricia.
//
// Lo que está implementado aquí es la REGLA PROVISIONAL documentada en §P7 del
// prompt del proyecto. La fórmula definitiva no está cerrada con el cliente, así
// que vive aislada en este archivo y no se replica en ningún componente: el día
// que Misión Huascarán confirme la fórmula, se cambia aquí y en ningún otro
// lugar.
//
// RNF-005: el cálculo se ejecuta en el cliente y es síncrono, para que la
// sugerencia se pinte sin esperar respuesta del servidor. Quien lo llame desde
// un componente debe envolverlo en `useMemo`.

import { normalizarNivel } from './niveles'

/** Regla provisional §P7: ≥0.8 sube un nivel, ≤0.4 baja uno, en otro caso se mantiene. */
function deltaPorRazon(razon) {
  if (razon == null) return 0
  if (razon >= UMBRAL_SUBE) return 1
  if (razon <= UMBRAL_BAJA) return -1
  return 0
}

/** Qué se le propone al docente. Sin datos completos, revisar antes que sugerir. */
function accionSugerida(completo, delta) {
  if (!completo) return ACCIONES.REVISAR
  if (delta > 0) return ACCIONES.SUBIR
  if (delta < 0) return ACCIONES.BAJAR
  return ACCIONES.MANTENER
}

/** Umbrales de la regla provisional (§P7). */
export const UMBRAL_SUBE = 0.8
export const UMBRAL_BAJA = 0.4

export const ACCIONES = {
  SUBIR: 'Subir 1',
  MANTENER: 'Mantener',
  BAJAR: 'Bajar 1',
  REVISAR: 'Revisar',
}

/**
 * Mueve un nivel Raz-Kids `delta` posiciones dentro del catálogo.
 * RN-012: se navega por el campo `orden`, nunca sumando letras como texto.
 */
export function moverNivelRazkids(nivel, delta, catalogo = []) {
  if (!nivel || !catalogo.length) return null
  const ordenDestino = Math.max(1, Math.min(catalogo.length, (nivel.orden ?? 0) + delta))
  return catalogo.find((n) => n.orden === ordenDestino) ?? null
}

/**
 * RN-013 — nivel general a partir del nivel alcanzado y el esperado para el grado.
 *
 * Es "Inicio" si la Fluidez es Pre Inicio o si el alumno quedó POR DEBAJO del
 * nivel esperado para su grado. En caso contrario, la distancia por encima del
 * esperado decide entre Proceso, Logrado y Destacado.
 *
 * Pendiente RN-013: los cortes de la brecha (1 y 3) son provisionales, igual que la
 * tabla `nivel_esperado_por_grado`. Pendientes de confirmar.
 */
export function calcularNivelGeneral({ fluidez, ordenAlcanzado, ordenEsperado }) {
  if (normalizarNivel(fluidez) === 'preinicio') return 'Inicio'
  if (ordenAlcanzado == null || ordenEsperado == null) return null
  if (ordenAlcanzado < ordenEsperado) return 'Inicio'

  const brecha = ordenAlcanzado - ordenEsperado
  if (brecha >= 3) return 'Destacado'
  if (brecha >= 1) return 'Logrado'
  return 'Proceso'
}

/** Redacta por qué el sistema propuso ese nivel. Lo muestra P8. */
function redactarMotivo({ letraSugerida, aciertos, total, fluidez, comprension }) {
  if (!letraSugerida) return 'Faltan datos para calcular una sugerencia.'
  const partes = []
  if (total) partes.push(`${aciertos}/${total}`)
  if (fluidez) partes.push(`Fluidez en ${fluidez.toLowerCase()}`)
  if (comprension) partes.push(`Comprensión en ${comprension.toLowerCase()}`)
  if (!partes.length) return `El sistema sugirió ${letraSugerida}.`
  return `El sistema sugirió ${letraSugerida} al considerar ${partes.join(', ')}.`
}

/**
 * Calcula la sugerencia de nivel final de una evaluación diagnóstica.
 *
 * @param {object}   params
 * @param {object}   params.nivelEntrada       Nivel Raz-Kids de partida `{ letra, orden }` (RN-005).
 * @param {number}   params.aciertos           Aciertos de la prueba tomada.
 * @param {number}   params.total              Preguntas de la prueba tomada.
 * @param {string}   params.fluidez            Nombre del nivel de rúbrica de Fluidez.
 * @param {string}   params.comprension        Nombre del nivel de rúbrica de Comprensión.
 * @param {number}   params.programa           `id_programa` del alumno (hoy no altera la regla).
 * @param {object}   params.nivelEsperadoGrado Nivel esperado para su grado `{ letra, orden }`.
 * @param {object[]} params.catalogoRazkids    Catálogo completo, para resolver la letra resultante.
 */
export function calcularNivelFinal({
  nivelEntrada,
  aciertos,
  total,
  fluidez,
  comprension,
  programa,
  nivelEsperadoGrado,
  catalogoRazkids = [],
} = {}) {
  const aciertosNum = Number(aciertos)
  const totalNum = Number(total)
  const pruebaValida =
    Number.isFinite(aciertosNum) && Number.isFinite(totalNum) && totalNum > 0 && aciertosNum >= 0 && aciertosNum <= totalNum

  const razon = pruebaValida ? aciertosNum / totalNum : null

  // Ambas dimensiones de la rúbrica son obligatorias y van siempre juntas (RN-008).
  const rubricaCompleta = Boolean(fluidez && comprension)
  const completo = pruebaValida && rubricaCompleta && Boolean(nivelEntrada)

  // Regla provisional §P7: ≥0.8 sube un nivel, ≤0.4 baja uno, en otro caso se mantiene.
  const delta = deltaPorRazon(razon)

  const nivelSugerido = pruebaValida ? moverNivelRazkids(nivelEntrada, delta, catalogoRazkids) : null

  const accion = accionSugerida(completo, delta)

  const nivelGeneral = rubricaCompleta
    ? calcularNivelGeneral({
        fluidez,
        ordenAlcanzado: nivelSugerido?.orden ?? nivelEntrada?.orden ?? null,
        ordenEsperado: nivelEsperadoGrado?.orden ?? null,
      })
    : null

  return {
    completo,
    razon,
    delta,
    accion,
    nivelSugerido,
    nivelGeneral,
    motivo: redactarMotivo({
      letraSugerida: nivelSugerido?.letra,
      aciertos: aciertosNum,
      total: totalNum,
      fluidez,
      comprension,
    }),
    // Se devuelve para que la interfaz pueda mostrar de dónde salió cada insumo
    // sin recalcular nada por su cuenta.
    insumos: {
      nivelEntrada: nivelEntrada ?? null,
      nivelEsperadoGrado: nivelEsperadoGrado ?? null,
      fluidez: fluidez ?? null,
      comprension: comprension ?? null,
      programa: programa ?? null,
    },
  }
}

export default calcularNivelFinal
