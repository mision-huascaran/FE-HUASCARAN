// El contrato nuevo del backend trae `motivo` en cada error y unifica el 422.
//
// Estas comprobaciones son baratas y valen mucho: si `motivo` deja de leerse,
// la interfaz vuelve a ramificar por el TEXTO del error, que es justo lo que
// el backend pidió no hacer porque la redacción puede cambiar.
import { describe, expect, it } from 'vitest'
import { erroresDeCampo, estadoDe, mensajeDeError, motivoDe } from '../client'

const error = (status, data) => ({ response: { status, data } })

describe('Errores del backend (api_sicedu_frontend §1.3)', () => {
  it('lee el código estable, no el texto', () => {
    expect(motivoDe(error(409, { detail: 'Da igual el texto', motivo: 'sin_asignaciones' }))).toBe('sin_asignaciones')
    expect(motivoDe(error(403, { detail: 'x', motivo: 'sin_permiso' }))).toBe('sin_permiso')
  })

  it('sin motivo devuelve null en vez de romper', () => {
    expect(motivoDe(error(500, {}))).toBeNull()
    expect(motivoDe(null)).toBeNull()
    expect(motivoDe({})).toBeNull()
  })

  it('muestra el `detail` del servidor, que viene ya redactado', () => {
    const e = error(401, { detail: 'Correo o contraseña incorrectos.', motivo: 'credenciales' })
    expect(mensajeDeError(e, 'respaldo')).toBe('Correo o contraseña incorrectos.')
  })

  it('en el 422 unificado nombra el campo que falla, no solo "datos no válidos"', () => {
    // Respuesta real de dev al editar un usuario (PATCH /usuarios/4).
    const e = error(422, {
      detail: 'Los datos enviados no son válidos.',
      motivo: 'validacion',
      errores: [{ campo: 'asignacion.grados', mensaje: 'Este campo no puede ser nulo.' }],
    })
    expect(mensajeDeError(e)).toBe('Los datos enviados no son válidos. asignacion.grados: Este campo no puede ser nulo.')
  })

  it('cae al respaldo cuando el servidor no manda texto', () => {
    expect(mensajeDeError(error(500, {}), 'respaldo')).toBe('respaldo')
  })

  it('reparte el 422 por campo para marcar el formulario', () => {
    const e = error(422, {
      detail: 'Datos inválidos',
      motivo: 'validacion',
      errores: [
        { campo: 'dni', mensaje: 'Debe tener 8 dígitos' },
        { campo: 'correo', mensaje: 'Ya está registrado' },
      ],
    })
    expect(erroresDeCampo(e)).toEqual({ dni: 'Debe tener 8 dígitos', correo: 'Ya está registrado' })
  })

  it('entiende también el 422 antiguo de FastAPI, por si queda algún endpoint sin migrar', () => {
    const e = error(422, { detail: [{ loc: ['body', 'nombre'], msg: 'campo requerido' }] })
    expect(erroresDeCampo(e)).toEqual({ nombre: 'campo requerido' })
  })

  it('sin errores por campo devuelve un objeto vacío, no undefined', () => {
    expect(erroresDeCampo(error(409, { detail: 'conflicto' }))).toEqual({})
  })

  it('un fallo de red no tiene estado', () => {
    expect(estadoDe(new Error('Network Error'))).toBeNull()
  })
})
