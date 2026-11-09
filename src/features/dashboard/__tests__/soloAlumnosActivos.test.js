// El Dashboard cuenta SOLO alumnos activos.
//
// El bug: cada cálculo del simulador leía `db.ALUMNOS` filtrando por colegio
// (y a veces por grado o subprograma) pero nunca por `activo`, así que los
// dados de baja entraban en los totales y en los denominadores de todos los
// porcentajes. Se corrigió en la fuente —una constante `ALUMNOS_ACTIVOS` que
// usan los ocho sitios que leen alumnos—, no en cada gráfica.
//
// SE COMPRUEBA CONTRA EL PADRÓN, no contra un número escrito a mano: el
// simulador genera ~2 % de inactivos con su propia semilla, así que una cifra
// fija aquí se rompería al cambiar la semilla y no diría nada. Lo que tiene
// que cumplirse es la relación: lo que suma el dashboard es exactamente la
// cuenta de activos, y es MENOR que el padrón completo.
import { describe, expect, it } from 'vitest'
import * as db from '../../../api/mock/db'
import { distribucionSubprograma, resultadosAprendizaje } from '../../../api/mock/dashboard'

/**
 * Todos los colegios y un periodo académico, que estos dos indicadores exigen
 * (`33` es el tercero, el que el simulador deja en curso).
 */
const TODOS = { todos_los_colegios: true, id_anio_escolar: 2, id_periodo_academico: 33 }

const activosDe = (filtro = () => true) => db.ALUMNOS.filter((a) => a.activo !== false && filtro(a)).length

/**
 * Los colegios que SÍ entran en la cifra.
 *
 * No son todos los consultados: el simulador deja a Yanama con el periodo sin
 * iniciar y lo manda a `colegios_sin_informacion`, fuera del total. Compararse
 * contra los consultados a secas daría de más justo por esos alumnos.
 */
const colegiosIncluidos = (respuesta) => {
  const fuera = new Set((respuesta.colegios_sin_informacion ?? []).map((c) => c.colegio.id))
  return new Set((respuesta.contexto?.colegios ?? []).map((c) => c.id).filter((id) => !fuera.has(id)))
}

describe('El Dashboard cuenta solo alumnos activos', () => {
  it('el simulador tiene inactivos: si no, esta prueba no probaría nada', () => {
    const inactivos = db.ALUMNOS.filter((a) => a.activo === false).length
    expect(inactivos).toBeGreaterThan(0)
  })

  it('la distribución por subprograma suma los activos, no el padrón entero', () => {
    const { subprogramas, total } = distribucionSubprograma(TODOS)

    const sumado = subprogramas.reduce((suma, s) => suma + s.alumnos, 0)
    expect(sumado).toBe(total)

    // Yanama no empezó el periodo y queda fuera del total a propósito, así que
    // el total es MENOR o igual que los activos, y en todo caso menor que el
    // padrón completo. Lo que no puede es incluir a un inactivo.
    expect(total).toBeLessThanOrEqual(activosDe())
    expect(total).toBeLessThan(db.ALUMNOS.length)
  })

  it('cada subprograma cuenta exactamente sus activos de los colegios incluidos', () => {
    const respuesta = distribucionSubprograma(TODOS)
    const incluidos = colegiosIncluidos(respuesta)

    respuesta.subprogramas.forEach((s) => {
      const esperados = activosDe((a) => a.id_programa === s.subprograma.id && incluidos.has(a.id_colegio))
      expect(s.alumnos).toBe(esperados)
    })
  })

  it('los resultados de aprendizaje evalúan sobre activos', () => {
    const respuesta = resultadosAprendizaje(TODOS)
    const incluidos = colegiosIncluidos(respuesta)

    respuesta.subprogramas.forEach((s) => {
      const esperados = activosDe((a) => a.id_programa === s.subprograma.id && incluidos.has(a.id_colegio))
      expect(s.total_a_evaluar).toBe(esperados)
      // Y cada dimensión reparte ese mismo total entre evaluados y pendientes.
      s.distribuciones.forEach((d) => expect(d.evaluados + d.pendientes).toBe(esperados))
    })
  })
})
