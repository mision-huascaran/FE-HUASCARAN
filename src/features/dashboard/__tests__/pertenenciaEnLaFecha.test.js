// El Dashboard cuenta por PERTENENCIA EN LA FECHA, no por `activo`.
//
// Historia de dos arreglos, porque el segundo corrige al primero:
//
//   1. El bug: ninguna lectura de alumnos miraba la baja, así que los dados de
//      baja inflaban el denominador de todos los porcentajes.
//   2. El primer arreglo filtró por `activo`, y estaba MAL: eso saca al alumno
//      también de los periodos anteriores a su baja. CU014 dice lo contrario
//      —la baja no borra lo histórico— y el backend lo confirma: cierra la
//      pertenencia desde la fecha de baja y cuenta a quien pertenecía al grupo
//      en la fecha que toca a cada consulta.
//
// Lo que se comprueba aquí es la regla, con la relación contra el padrón y no
// contra números escritos a mano: el simulador reparte las bajas con su propia
// semilla, así que una cifra fija se rompería al cambiarla y no diría nada.
import { describe, expect, it } from 'vitest'
import * as db from '../../../api/mock/db'
import { distribucionSubprograma, resultadosAprendizaje } from '../../../api/mock/dashboard'

/** Los cuatro PA del simulador. El 33 está en curso; el 31 ya terminó. */
const PA_EN_CURSO = 33
const PA_TERMINADO = 31
const consulta = (idPeriodo) => ({ todos_los_colegios: true, id_anio_escolar: 2, id_periodo_academico: idPeriodo })

/** Pertenecía al grupo en `fecha` quien no tiene baja, o la tiene posterior. */
const perteneceEn = (a, fecha) => !a.baja_desde || fecha < a.baja_desde

/**
 * Los colegios que SÍ entran en la cifra.
 *
 * No son todos los consultados: el simulador deja a Yanama con el periodo sin
 * iniciar y lo manda a `colegios_sin_informacion`, fuera del total.
 */
const colegiosIncluidos = (respuesta) => {
  const fuera = new Set((respuesta.colegios_sin_informacion ?? []).map((c) => c.colegio.id))
  return new Set((respuesta.contexto?.colegios ?? []).map((c) => c.id).filter((id) => !fuera.has(id)))
}

/** La fecha de corte que dice la propia respuesta, por colegio. */
const corteDe = (respuesta) => respuesta.fechas_corte[0].fecha

describe('El simulador tiene bajas repartidas en el año', () => {
  it('hay alumnos dados de baja: si no, estas pruebas no probarían nada', () => {
    const bajas = db.ALUMNOS.filter((a) => a.baja_desde)
    expect(bajas.length).toBeGreaterThan(0)
    // Y todos los inactivos tienen su fecha: un inactivo sin fecha no se
    // podría situar en el tiempo y volvería a contarse siempre o nunca.
    expect(db.ALUMNOS.filter((a) => a.activo === false && !a.baja_desde)).toHaveLength(0)
  })
})

describe('Cuenta a quien pertenecía al grupo en la fecha de corte', () => {
  it('la distribución por subprograma cuadra con la pertenencia en su corte', () => {
    const respuesta = distribucionSubprograma(consulta(PA_EN_CURSO))
    const incluidos = colegiosIncluidos(respuesta)
    const corte = corteDe(respuesta)

    respuesta.subprogramas.forEach((s) => {
      const esperados = db.ALUMNOS.filter(
        (a) => a.id_programa === s.subprograma.id && incluidos.has(a.id_colegio) && perteneceEn(a, corte),
      ).length
      expect(s.alumnos).toBe(esperados)
    })
  })

  it('los resultados de aprendizaje evalúan sobre esa misma pertenencia', () => {
    const respuesta = resultadosAprendizaje(consulta(PA_EN_CURSO))
    const incluidos = colegiosIncluidos(respuesta)
    const corte = corteDe(respuesta)

    respuesta.subprogramas.forEach((s) => {
      const esperados = db.ALUMNOS.filter(
        (a) => a.id_programa === s.subprograma.id && incluidos.has(a.id_colegio) && perteneceEn(a, corte),
      ).length
      expect(s.total_a_evaluar).toBe(esperados)
      // Y cada dimensión reparte ese mismo total entre evaluados y pendientes.
      s.distribuciones.forEach((d) => expect(d.evaluados + d.pendientes).toBe(esperados))
    })
  })

  it('no cuenta a quien ya estaba de baja: el total es menor que el padrón', () => {
    const { total } = distribucionSubprograma(consulta(PA_EN_CURSO))
    expect(total).toBeLessThan(db.ALUMNOS.length)
  })
})

/**
 * LA PARTE QUE EL ARREGLO ANTERIOR ROMPÍA (CU014).
 *
 * Un alumno dado de baja en septiembre sí estuvo en el grupo durante el primer
 * periodo, así que en ese PA tiene que seguir contando: su baja no borra sus
 * asistencias, lecturas ni evaluaciones de entonces. Filtrando por `activo`
 * desaparecía de los cuatro periodos por igual.
 */
describe('Una baja no borra los periodos anteriores', () => {
  it('un PA ya terminado cuenta MÁS alumnos que el PA en curso', () => {
    const terminado = distribucionSubprograma(consulta(PA_TERMINADO))
    const enCurso = distribucionSubprograma(consulta(PA_EN_CURSO))

    // Las bajas del año se acumulan: cuanto más tarde el corte, menos alumnos.
    expect(corteDe(terminado) < corteDe(enCurso)).toBe(true)
    expect(terminado.total).toBeGreaterThan(enCurso.total)
  })

  it('quien se dio de baja DESPUÉS del corte de un PA sigue contando en ese PA', () => {
    const terminado = distribucionSubprograma(consulta(PA_TERMINADO))
    const corte = corteDe(terminado)
    const incluidos = colegiosIncluidos(terminado)

    // Hay alumnos de baja que en ese corte todavía pertenecían al grupo...
    const deBajaPeroPresentes = db.ALUMNOS.filter(
      (a) => a.baja_desde && incluidos.has(a.id_colegio) && perteneceEn(a, corte),
    )
    expect(deBajaPeroPresentes.length).toBeGreaterThan(0)

    // ...y están dentro del total de ese periodo.
    const sumado = terminado.subprogramas.reduce((suma, s) => suma + s.alumnos, 0)
    const soloActivos = db.ALUMNOS.filter((a) => incluidos.has(a.id_colegio) && a.activo !== false).length
    expect(sumado).toBe(terminado.total)
    expect(terminado.total).toBeGreaterThan(soloActivos)
  })
})
