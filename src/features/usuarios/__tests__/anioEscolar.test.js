// El año escolar de un permiso (CU028) y de una asignación (CU016).
//
// No es el año calendario y no siempre coinciden: el receso posterior a PA4
// puede cruzar diciembre, así que "2026" puede incluir días de 2027. Por eso es
// una entidad con id y se elige de una lista, no se teclea ni se saca de un
// DatePicker.
//
// Lo que sí se hace es PROPONER el vigente, porque es con el que se trabaja
// casi siempre; pero se deja cambiar, porque un permiso excepcional sirve
// justamente para regularizar un periodo anterior.
import { describe, expect, it } from 'vitest'
import { anioVigente } from '../../../api/resources/administracion'

const ANIOS = [
  { id: 1, nombre: '2025', vigente: false },
  { id: 2, nombre: '2026', vigente: true },
  { id: 3, nombre: '2027', vigente: false },
]

describe('Año escolar propuesto por defecto', () => {
  it('es el vigente, no el primero de la lista', () => {
    expect(anioVigente(ANIOS)).toMatchObject({ id: 2, nombre: '2026' })
  })

  it('si ninguno está vigente, cae al primero en vez de quedarse sin nada', () => {
    // Pasa entre años escolares: el anterior cerró y el siguiente no ha
    // empezado. Mejor proponer uno que dejar el formulario sin año.
    const ninguno = ANIOS.map((a) => ({ ...a, vigente: false }))
    expect(anioVigente(ninguno)).toMatchObject({ id: 1 })
  })

  it('sin años no revienta', () => {
    expect(anioVigente([])).toBeNull()
    expect(anioVigente()).toBeNull()
  })
})
