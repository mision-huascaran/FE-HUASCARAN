// Contrato de errores de FastAPI (APIS_BACKEND.md).
//
// `detail` llega de dos formas y confundirlas rompe la interfaz: en un 422 es un
// ARRAY de objetos de validación y pintarlo tal cual haría que React reviente
// con "Objects are not valid as a React child".
import { describe, expect, it } from 'vitest'
import { mensajeDeError } from '../client'

const errorHttp = (status, detail) => ({ response: { status, data: { detail } } })

describe('mensajeDeError', () => {
  it('convierte el array de validación de un 422 en texto legible', () => {
    const error = errorHttp(422, [
      { type: 'missing', loc: ['body', 'correo'], msg: 'Field required', input: {} },
      { type: 'missing', loc: ['body', 'password'], msg: 'Field required', input: {} },
    ])
    const mensaje = mensajeDeError(error)
    expect(typeof mensaje).toBe('string')
    expect(mensaje).toContain('correo')
    expect(mensaje).toContain('password')
    expect(mensaje).not.toContain('[object Object]')
  })

  it('omite el segmento "body" al nombrar el campo', () => {
    const mensaje = mensajeDeError(errorHttp(422, [{ loc: ['body', 'aciertos'], msg: 'Input should be a valid integer' }]))
    expect(mensaje).toBe('aciertos: Input should be a valid integer')
  })

  it('devuelve tal cual el detail string de un HTTPException', () => {
    expect(mensajeDeError(errorHttp(422, 'Ambas dimensiones son obligatorias'))).toBe(
      'Ambas dimensiones son obligatorias',
    )
  })

  it('sin respuesta del servidor nombra el fallo de red y tranquiliza sobre el dato', () => {
    const mensaje = mensajeDeError({ message: 'Network Error' })
    expect(mensaje).toMatch(/Sin conexión/i)
    expect(mensaje).toMatch(/guardado en este dispositivo/i)
  })

  it('cae al texto por defecto cuando el error no trae nada aprovechable', () => {
    expect(mensajeDeError(errorHttp(500, undefined), 'Falló')).toBe('Falló')
    expect(mensajeDeError(null, 'Falló')).toBe('Falló')
  })

  it('no se rompe con un array de validación vacío o deforme', () => {
    expect(mensajeDeError(errorHttp(422, []), 'Falló')).toBe('Falló')
    expect(mensajeDeError(errorHttp(422, [{}]), 'Falló')).toBe('Falló')
  })
})
