// El backend devuelve unos campos como texto y otros como objeto {id, nombre},
// según el endpoint. Pintar el objeto tal cual lanza "Objects are not valid as
// a React child" y tumba la pantalla entera: por eso toda celda que venga de
// la API pasa por aquí.
import { describe, expect, it } from 'vitest'
import { etiquetaDe } from '../format'

describe('etiquetaDe', () => {
  it('acepta el texto que manda el simulador', () => {
    expect(etiquetaDe('I.E. 86021 Ranrahirca')).toBe('I.E. 86021 Ranrahirca')
  })

  it('acepta el objeto que manda el backend real', () => {
    expect(etiquetaDe({ id: 1, nombre: 'I.E. 86021 Ranrahirca' })).toBe('I.E. 86021 Ranrahirca')
  })

  it('nunca devuelve un objeto, que es lo que rompía React', () => {
    expect(typeof etiquetaDe({ id: 1, nombre: 'x' })).toBe('string')
    expect(typeof etiquetaDe({ id: 1 })).toBe('string')
  })

  it('un número se pinta, no se confunde con vacío', () => {
    expect(etiquetaDe(0)).toBe('0')
    expect(etiquetaDe(4)).toBe('4')
  })

  it('vacío, null e indefinido dan guion', () => {
    expect(etiquetaDe(null)).toBe('—')
    expect(etiquetaDe(undefined)).toBe('—')
    expect(etiquetaDe('')).toBe('—')
  })
})
