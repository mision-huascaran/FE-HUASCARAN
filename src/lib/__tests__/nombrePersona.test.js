// Nombres de personas: qué se acepta y cómo se exporta. Datos inventados.
import { describe, expect, it } from 'vitest'
import { LARGO_MAXIMO_NOMBRE, motivoNombreInvalido, neutralizarCelda } from '../nombrePersona'

describe('motivoNombreInvalido', () => {
  it.each(['Rosa', 'José María', 'Ñahui Quispe', 'Huamán-Villar', "O'Higgins", 'D’Alessandro', 'Müller', 'Ana  Luz ', 'Ana2', 'Luis 3ro'])(
    'acepta «%s»',
    (nombre) => expect(motivoNombreInvalido(nombre)).toBeNull(),
  )

  it('vacío lo decide el formulario (obligatorio), no esta regla', () => {
    expect(motivoNombreInvalido('')).toBeNull()
    expect(motivoNombreInvalido(null)).toBeNull()
  })

  it('solo espacios no es un nombre', () => {
    expect(motivoNombreInvalido('     ')).toBe('No puede tener solo espacios.')
  })

  it.each([LARGO_MAXIMO_NOMBRE + 1, 300, 10000])('rechaza %i caracteres sin espacios', (largo) => {
    expect(motivoNombreInvalido('a'.repeat(largo))).toBe(`Tiene ${largo} caracteres; el máximo es ${LARGO_MAXIMO_NOMBRE}.`)
  })

  it('acepta justo el máximo', () => {
    expect(motivoNombreInvalido('a'.repeat(LARGO_MAXIMO_NOMBRE))).toBeNull()
  })

  it.each(['<script>', 'Ana>', 'Ana=Luz', 'Ana;', '{Ana}', 'Ana$', 'ana@correo', 'Ana, Luz', '=SUM(1)', '+SUM(1,1)', '@Ana', 'Ana (2)'])(
    'rechaza símbolos: «%s»',
    (nombre) => expect(motivoNombreInvalido(nombre)).toBe('Usa solo letras, números, espacios, apóstrofo y guion.'),
  )

  it.each(['-Ana', "'Ana", 'Ana-'])('rechaza que empiece o termine con guion o apóstrofo: «%s»', (nombre) => {
    expect(motivoNombreInvalido(nombre)).toBe('No puede empezar ni terminar con un apóstrofo o un guion.')
  })
})

describe('neutralizarCelda', () => {
  it.each([
    ['=HYPERLINK("http://ejemplo.invalid","x")', '\'=HYPERLINK("http://ejemplo.invalid","x")'],
    ['+SUM(1,1)', "'+SUM(1,1)"],
    ['-1+1', "'-1+1"],
    ['@SUM(1)', "'@SUM(1)"],
    ['\t=1', "'\t=1"],
  ])('antepone un apóstrofo a «%s»', (valor, esperado) => expect(neutralizarCelda(valor)).toBe(esperado))

  it('deja igual el texto normal, el guion largo de "sin dato" y los números', () => {
    expect(neutralizarCelda('Quispe, Juan')).toBe('Quispe, Juan')
    expect(neutralizarCelda('—')).toBe('—')
    expect(neutralizarCelda(-5)).toBe(-5)
    expect(neutralizarCelda(null)).toBeNull()
  })
})
