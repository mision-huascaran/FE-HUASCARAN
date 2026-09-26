// El JWT del backend dura 8 horas (APIS_BACKEND.md), así que una sesión caduca
// con el docente dentro. Leer `exp` evita disparar peticiones condenadas al 401.
import { describe, expect, it } from 'vitest'
import { caducaEn, leerPayload, tokenCaducado } from '../jwt'
import { normalizarPerfil } from '../../api/resources/auth'

/** Arma un JWT de mentira con el payload indicado (firma irrelevante: no se valida). */
function armarToken(payload) {
  const base64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.firma`
}

const enSegundos = (offset) => Math.floor(Date.now() / 1000) + offset

describe('leerPayload', () => {
  it('lee los campos que el backend pone en el token', () => {
    const token = armarToken({
      id_usuario: 1,
      id_rol: 1,
      correo: 'profesor.prueba@sicedu.test',
      id_docente: 1,
      exp: enSegundos(28_800),
    })
    expect(leerPayload(token)).toMatchObject({ id_usuario: 1, id_rol: 1, id_docente: 1 })
  })

  it('soporta acentos en el payload', () => {
    expect(leerPayload(armarToken({ nombres: 'Rosa Elena', apellidos: 'Cárdenas Villanueva' }))).toMatchObject({
      apellidos: 'Cárdenas Villanueva',
    })
  })

  it('devuelve null ante un token del mock o malformado, sin lanzar', () => {
    expect(leerPayload('mock.1.2026')).toBeNull()
    expect(leerPayload('')).toBeNull()
    expect(leerPayload(null)).toBeNull()
    expect(leerPayload('a.b.c')).toBeNull()
  })
})

describe('tokenCaducado', () => {
  it('reconoce un token vencido', () => {
    expect(tokenCaducado(armarToken({ exp: enSegundos(-60) }))).toBe(true)
  })

  it('acepta un token con horas por delante', () => {
    expect(tokenCaducado(armarToken({ exp: enSegundos(28_800) }))).toBe(false)
  })

  it('descarta el token que expira en segundos, por el margen de la petición', () => {
    expect(tokenCaducado(armarToken({ exp: enSegundos(5) }))).toBe(true)
  })

  it('NO declara caducado un token ilegible: de eso se encarga el 401 del servidor', () => {
    expect(tokenCaducado('mock.1.2026')).toBe(false)
    expect(tokenCaducado(armarToken({ id_usuario: 1 }))).toBe(false)
  })
})

describe('caducaEn', () => {
  it('devuelve la fecha de expiración, o null si el token no la declara', () => {
    const exp = enSegundos(3600)
    expect(caducaEn(armarToken({ exp }))).toEqual(new Date(exp * 1000))
    expect(caducaEn('mock.1.2026')).toBeNull()
  })
})

describe('normalizarPerfil (GET /me)', () => {
  it('une nombres y apellidos, que el backend devuelve por separado', () => {
    const perfil = normalizarPerfil({
      id_usuario: 1,
      id_rol: 1,
      correo: 'profesor.prueba@sicedu.test',
      id_docente: 1,
      nombres: 'Docente',
      apellidos: 'de Prueba',
      activo: true,
    })
    expect(perfil.nombre_completo).toBe('Docente de Prueba')
  })

  it('conserva id_docente en null para las cuentas no docentes', () => {
    const perfil = normalizarPerfil({
      id_usuario: 2,
      id_rol: 2,
      correo: 'jefa.prueba@sicedu.test',
      id_docente: null,
      nombres: 'Jefa',
      apellidos: 'de Prueba',
      activo: true,
    })
    expect(perfil.id_docente).toBeNull()
    expect(perfil.nombre_completo).toBe('Jefa de Prueba')
  })

  it('cae al correo si no llega ningún nombre, para no dejar la cabecera vacía', () => {
    expect(normalizarPerfil({ correo: 'x@y.z' }).nombre_completo).toBe('x@y.z')
  })

  it('devuelve null sin perfil', () => {
    expect(normalizarPerfil(null)).toBeNull()
  })
})
