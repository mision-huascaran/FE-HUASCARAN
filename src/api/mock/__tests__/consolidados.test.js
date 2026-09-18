// Agregados de las Fases 6 y 7. Son el contrato con el que se construyen el
// dashboard, los rankings y los consolidados: si un porcentaje deja de sumar
// 100 o un ranking deja de estar ordenado, las pantallas mienten en silencio.
import { describe, expect, it } from 'vitest'
import * as agregados from '../consolidados'
import handlers from '../handlers'
import * as db from '../db'

const VIGENTE = db.PERIODO_VIGENTE.id_periodo

describe('indicadores', () => {
  it('devuelve porcentajes entre 0 y 100 y no más evaluados que estudiantes', () => {
    const ind = agregados.indicadores({ periodo: VIGENTE })
    expect(ind.evaluados).toBeLessThanOrEqual(ind.estudiantes)
    ;[ind.pct_logro, ind.cobertura, ind.pct_subio].forEach((p) => {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(100)
    })
  })

  it('no inventa un "subió de nivel" en el primer corte: no hay con qué comparar', () => {
    expect(agregados.indicadores({ periodo: 1 }).pct_subio).toBeNull()
  })

  it('cobertura de un corte casi vacío es baja, no nula', () => {
    // Diciembre está casi sin registrar en el mock (§9): la cobertura lo refleja.
    const diciembre = agregados.indicadores({ periodo: 4 })
    expect(diciembre.cobertura).toBeLessThan(20)
  })
})

describe('distribución por nivel', () => {
  it('los conteos de cada corte suman el total evaluado', () => {
    agregados.distribucion({}).filas.forEach((fila) => {
      const suma = Object.values(fila.conteos).reduce((s, n) => s + n, 0)
      expect(suma).toBe(fila.total)
    })
  })

  it('con la dimensión Fluidez aparece Pre Inicio; con el nivel general, no (§13)', () => {
    expect(agregados.distribucion({ dimension: 'Fluidez' }).niveles).toContain('Pre Inicio')
    expect(agregados.distribucion({}).niveles).not.toContain('Pre Inicio')
  })
})

describe('variación de nivel', () => {
  it('las categorías suman el total, incluida "Baja"', () => {
    const v = agregados.variacion({ periodo: VIGENTE })
    expect(v.categorias.reduce((s, c) => s + c.cantidad, 0)).toBe(v.total)
    expect(v.categorias.map((c) => c.nombre)).toContain('Baja')
  })
})

describe('rankings (RF-008, RF-009)', () => {
  it('ordena los colegios de mayor a menor logro y deja al final a los sin datos', () => {
    const ranking = agregados.rankingColegios({ periodo: VIGENTE })
    expect(ranking).toHaveLength(db.COLEGIOS.length)
    const conDatos = ranking.filter((r) => r.pct_logro != null).map((r) => r.pct_logro)
    expect(conDatos).toEqual([...conDatos].sort((a, b) => b - a))
    ranking.forEach((r, i) => expect(r.posicion).toBe(i + 1))
  })

  it('filtra por zona', () => {
    const yungay = agregados.rankingColegios({ periodo: VIGENTE, zona: 'Yungay' })
    expect(yungay.every((r) => r.zona === 'Yungay')).toBe(true)
  })

  it('rankea las aulas dentro de un colegio', () => {
    const aulas = agregados.rankingAulas({ colegio: 1, periodo: VIGENTE })
    expect(aulas.length).toBeGreaterThan(0)
    aulas.forEach((a) => expect(a.nombre).toMatch(/^\d\.° [AB]$/))
  })
})

describe('consolidados (P14)', () => {
  it('el consolidado de niveles marca un periodo cerrado como snapshot y el abierto como en vivo', () => {
    expect(agregados.consolidadoNivel({ periodo: 1 }).origen).toBe('snapshot')
    expect(agregados.consolidadoNivel({ periodo: VIGENTE }).origen).toBe('en-vivo')
  })

  it('el total general de libros es la suma de las filas y LSB + LSL = total (RF-016)', () => {
    const c = agregados.consolidadoLibros({ colegio: 1 })
    c.filas.forEach((f) => expect(f.total).toBe(f.lsb + f.lsl))
    expect(c.total_general.total).toBe(c.filas.reduce((s, f) => s + f.total, 0))
  })
})

describe('alertas de inconsistencia (P15)', () => {
  it('solo alerta diferencias distintas de cero, en meses ya cerrados', () => {
    const alertas = agregados.alertasInconsistencias({})
    expect(alertas.length).toBeGreaterThan(0)
    alertas.forEach((a) => {
      expect(a.diferencia).not.toBe(0)
      expect(a.diferencia).toBe(a.valor_consolidado - a.valor_semanal)
      expect(a.mes).not.toBe(db.MES_ACTUAL)
    })
  })

  it('una alerta marcada como revisada lo sigue estando en la siguiente consulta', () => {
    const [primera] = agregados.alertasInconsistencias({})
    agregados.marcarAlertaRevisada(primera.id_alerta)
    const otra = agregados.alertasInconsistencias({}).find((a) => a.id_alerta === primera.id_alerta)
    expect(otra.estado).toBe('revisada')
  })
})

describe('administración (P16, RN-003)', () => {
  const programado = db.PERIODOS.find((p) => p.estado === 'programado')
  const cerrado = db.PERIODOS.find((p) => p.estado === 'cerrado')

  it('no asigna en un periodo cerrado: la rotación ocurre al cierre', async () => {
    await expect(
      handlers.administracion.crearAsignacion({ id_docente: 2, id_colegio: 9, id_periodo: cerrado.id_periodo }),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })

  it('asigna el colegio completo, con los seis grados, en un periodo programado', async () => {
    const nueva = await handlers.administracion.crearAsignacion({ id_docente: 2, id_colegio: 9, id_periodo: programado.id_periodo })
    expect(nueva.grados).toHaveLength(6)
    await handlers.administracion.eliminarAsignacion(nueva.id_asignacion)
  })

  it('no duplica una asignación existente', async () => {
    const existente = db.ASIGNACIONES.find((a) => a.id_periodo === programado.id_periodo)
    await expect(
      handlers.administracion.crearAsignacion({ id_docente: existente.id_docente, id_colegio: existente.id_colegio, id_periodo: programado.id_periodo }),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })
})

describe('panel ejecutivo (P17)', () => {
  it('entrega los seis indicadores con valores coherentes', () => {
    const p = agregados.panelEjecutivo({ periodo: VIGENTE })
    expect(p.estudiantes).toBeGreaterThan(0)
    expect(p.colegios_al_dia).toBeLessThanOrEqual(p.total_colegios)
    expect(p.libros_anio).toBeGreaterThan(0)
    expect(p.asistencia_promedio).toBeGreaterThan(50)
    expect(typeof p.avance_pp).toBe('number')
  })
})
