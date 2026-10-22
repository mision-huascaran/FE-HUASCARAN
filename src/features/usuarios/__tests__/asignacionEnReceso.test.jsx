// CU016 / T4 — asignar a un Docente a un colegio que está en RECESO.
//
// Durante un PR, asignar significa dos cosas muy distintas: que el Docente
// entre a regularizar el periodo que acaba de terminar, o que empiece en el que
// viene. El backend responde 422 `inicio_asignacion_requerido` si no se dice
// cuál, así que la pregunta no se puede evitar.
//
// En un PA, en cambio, no hay ambigüedad y el servidor ignora el campo: por eso
// la pregunta aparece SOLO cuando el colegio elegido está en receso. Y cada
// colegio tiene su propio calendario desde CU027, así que depende del colegio y
// no de una fecha global.
import { describe, expect, it } from 'vitest'
import { opcionesDeInicio, recesoDelColegio } from '../../../api/resources/administracion'

const EN_PA = { id: 1, estado_calendario: { tipo: 'PA', numero: 3, es_pr4: false } }
const EN_PR = { id: 2, estado_calendario: { tipo: 'PR', numero: 3, es_pr4: false, fecha_fin: '2026-11-08' } }
const EN_PR4 = { id: 3, estado_calendario: { tipo: 'PR', numero: 4, es_pr4: true } }
const SIN_CALENDARIO = { id: 4, estado_calendario: null }

const ESTADOS = [EN_PA, EN_PR, EN_PR4, SIN_CALENDARIO]

describe('¿Hay que preguntar desde qué periodo?', () => {
  it('en un PA, no', () => {
    expect(recesoDelColegio(ESTADOS, 1)).toBeNull()
  })

  it('en un PR, sí, y se sabe cuál es', () => {
    expect(recesoDelColegio(ESTADOS, 2)).toMatchObject({ tipo: 'PR', numero: 3 })
  })

  it('sin calendario configurado, tampoco', () => {
    // No hay nada que preguntar: el backend rechaza la asignación entera con
    // `calendario_no_configurado`, que es otro problema y otro mensaje.
    expect(recesoDelColegio(ESTADOS, 4)).toBeNull()
  })

  it('un colegio que no está en la lista no rompe nada', () => {
    expect(recesoDelColegio(ESTADOS, 99)).toBeNull()
    expect(recesoDelColegio([], 1)).toBeNull()
  })

  it('compara el id como texto: el formulario devuelve cadenas', () => {
    expect(recesoDelColegio(ESTADOS, '2')).toMatchObject({ numero: 3 })
  })
})

describe('Opciones de "desde qué periodo"', () => {
  const valores = (receso) => opcionesDeInicio(receso).map((o) => o.value)

  it('en un PR normal, las dos', () => {
    expect(valores(EN_PR.estado_calendario)).toEqual(['retroactivo', 'proximo'])
  })

  it('en el PR4 NO se ofrece "Próximo"', () => {
    /**
     * No existe un PA siguiente dentro de ese año escolar: el backend lo
     * rechaza pidiendo que se elija el año que viene. Ofrecerlo sería invitar
     * a un error que el servidor va a devolver igual.
     */
    expect(valores(EN_PR4.estado_calendario)).toEqual(['retroactivo'])
  })

  it('sin receso no hay opciones que ofrecer', () => {
    expect(opcionesDeInicio(null)).toEqual([])
  })

  it('la etiqueta dice QUÉ periodo se regulariza', () => {
    // "Retroactivo" a secas no dice nada; con el número, sí.
    expect(opcionesDeInicio(EN_PR.estado_calendario)[0].label).toContain('PA3')
  })
})
