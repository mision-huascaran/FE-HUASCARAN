// Validación de la CSP del stage 'Security Headers - CSP' (scripts/verificar-csp.mjs).
// La política correcta es la de deploy/cabeceras-seguridad.conf.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  POLITICA_MINIMA,
  ejecutar,
  leerDirectivas,
  separarPoliticas,
  validarCsp,
  validarRespuesta,
  verificarSitio,
} from '../verificar-csp.mjs'

const CSP_PROYECTO =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; " +
  "connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; " +
  "form-action 'self'; object-src 'none'"

const SIN_UNSAFE = "Sin 'unsafe-inline', 'unsafe-eval' ni 'unsafe-hashes'"
const BASE = 'https://qa.ejemplo.com'

const fallidas = (validaciones) => validaciones.filter((v) => !v.cumple).map((v) => v.nombre)
const buscar = (validaciones, nombre) => validaciones.find((v) => v.nombre === nombre)
const pasa = (validaciones) => validaciones.every((v) => v.cumple)

/** La CSP del proyecto con `directiva` cambiada (o quitada si `valor` es null). */
function cambiar(directiva, valor) {
  const partes = CSP_PROYECTO.split('; ').filter((p) => !p.startsWith(`${directiva} `))
  return [...partes, ...(valor === null ? [] : [`${directiva} ${valor}`])].join('; ')
}

/** Lo que usa la validación de una respuesta de fetch: el estado y las cabeceras. */
function respuesta({ status = 200, tipo = 'text/html', csp = CSP_PROYECTO, reportOnly } = {}) {
  const headers = new Headers()
  if (tipo) headers.set('content-type', tipo)
  if (csp) headers.set('content-security-policy', csp)
  if (reportOnly) headers.set('content-security-policy-report-only', reportOnly)
  return { status, headers }
}

describe('validarCsp', () => {
  it('la CSP del proyecto cumple todas las validaciones', () => {
    const validaciones = validarCsp(CSP_PROYECTO)
    expect(fallidas(validaciones)).toEqual([])
    expect(validaciones.every((v) => typeof v.detalle === 'string' && v.detalle)).toBe(true)
  })

  it('sin cabecera: falla la presencia y todas las directivas mínimas', () => {
    const validaciones = validarCsp(null)
    expect(pasa(validaciones)).toBe(false)
    expect(buscar(validaciones, 'Content-Security-Policy presente')).toMatchObject({
      cumple: false,
      detalle: 'La respuesta no trae Content-Security-Policy',
    })
    expect(fallidas(validaciones)).toHaveLength(1 + Object.keys(POLITICA_MINIMA).length)
  })

  it('solo Report-Only no cuenta como CSP aplicada', () => {
    const presente = buscar(validarCsp(null, CSP_PROYECTO), 'Content-Security-Policy presente')
    expect(presente.cumple).toBe(false)
    expect(presente.detalle).toMatch(/Report-Only/)
  })

  it.each(Object.entries(POLITICA_MINIMA))('falla si falta %s', (directiva, esperado) => {
    const validaciones = validarCsp(cambiar(directiva, null))
    expect(fallidas(validaciones)).toEqual([`Directiva ${directiva} ${esperado.join(' ')}`])
    expect(buscar(validaciones, `Directiva ${directiva} ${esperado.join(' ')}`).detalle).toBe('No está en la política')
  })

  it('falla si una directiva mínima trae otra fuente además de la esperada', () => {
    const validaciones = validarCsp(cambiar('connect-src', "'self' https://api.ejemplo.com"))
    expect(fallidas(validaciones)).toEqual(["Directiva connect-src 'self'"])
  })

  it("con 'unsafe-inline' falla y dice dónde está", () => {
    const validaciones = validarCsp(cambiar('style-src', "'self' 'unsafe-inline'"))
    expect(buscar(validaciones, SIN_UNSAFE)).toMatchObject({
      cumple: false,
      detalle: "style-src: 'unsafe-inline'",
    })
  })

  it("con 'unsafe-eval' falla", () => {
    const validaciones = validarCsp(cambiar('script-src', "'self' 'unsafe-eval'"))
    expect(fallidas(validaciones)).toEqual([
      "Directiva script-src 'self'",
      SIN_UNSAFE,
    ])
  })

  it("con 'unsafe-hashes' falla aunque esté en una directiva no mínima", () => {
    expect(fallidas(validarCsp(cambiar('img-src', "'self' 'unsafe-hashes'")))).toEqual([
      SIN_UNSAFE,
    ])
  })

  it.each(['*', '*.ejemplo.com', 'https://*.ejemplo.com'])('con el comodín %s falla', (comodin) => {
    const validaciones = validarCsp(cambiar('img-src', `'self' ${comodin}`))
    expect(buscar(validaciones, 'Sin comodines (*)')).toMatchObject({ cumple: false, detalle: `img-src: ${comodin}` })
  })

  it.each(['https:', 'http:'])('con el esquema suelto %s falla', (esquema) => {
    const validaciones = validarCsp(cambiar('font-src', `'self' ${esquema}`))
    expect(fallidas(validaciones)).toEqual(['Sin esquemas sueltos http: ni https:'])
  })

  it('un host concreto con https:// no es un esquema suelto', () => {
    const validaciones = validarCsp(cambiar('img-src', "'self' https://img.ejemplo.com"))
    expect(pasa(validaciones)).toBe(true)
  })

  it.each([
    ['script-src', 'data:'],
    ['script-src', 'blob:'],
    ['default-src', 'data:'],
  ])('con %s %s falla', (directiva, esquema) => {
    const validaciones = validarCsp(cambiar(directiva, `'self' ${esquema}`))
    expect(buscar(validaciones, 'Sin data: ni blob: en script-src ni default-src')).toMatchObject({
      cumple: false,
      detalle: `${directiva}: ${esquema}`,
    })
  })

  it('data: en img-src sí está permitido (exportar un gráfico a PNG)', () => {
    expect(pasa(validarCsp(CSP_PROYECTO))).toBe(true)
    expect(CSP_PROYECTO).toContain("img-src 'self' data:")
  })

  it('con la cabecera duplicada (dos políticas distintas) falla', () => {
    const validaciones = validarCsp(`${CSP_PROYECTO}, default-src 'self' https:`)
    expect(buscar(validaciones, 'Cabecera no duplicada')).toMatchObject({
      cumple: false,
      detalle: '2 políticas distintas (¿la pone también el proxy?)',
    })
    expect(fallidas(validaciones)).toContain('Sin esquemas sueltos http: ni https:')
  })

  it('con la misma política dos veces también falla, e indica que son iguales', () => {
    const duplicada = buscar(validarCsp(`${CSP_PROYECTO}, ${CSP_PROYECTO}`), 'Cabecera no duplicada')
    expect(duplicada).toMatchObject({ cumple: false, detalle: '2 políticas iguales (¿la pone también el proxy?)' })
  })

  it('no distingue mayúsculas en directivas ni fuentes', () => {
    expect(pasa(validarCsp(CSP_PROYECTO.toUpperCase()))).toBe(true)
  })
})

describe('separarPoliticas y leerDirectivas', () => {
  it('separa por comas e ignora trozos vacíos', () => {
    expect(separarPoliticas(" a 'self' , , b 'none' ")).toEqual(["a 'self'", "b 'none'"])
    expect(separarPoliticas(null)).toEqual([])
  })

  it('si una directiva se repite, vale la primera (como en el navegador)', () => {
    const directivas = leerDirectivas("script-src 'self'; script-src 'unsafe-inline';;  ")
    expect([...directivas]).toEqual([['script-src', ["'self'"]]])
  })
})

describe('validarRespuesta', () => {
  it('PASS con 200, text/html y la CSP del proyecto', () => {
    const resultado = validarRespuesta('https://qa/', respuesta({ tipo: 'text/html; charset=utf-8' }))
    expect(resultado).toMatchObject({ url: 'https://qa/', http: 200, csp: CSP_PROYECTO, estado: 'PASS' })
  })

  it('FAIL si no es 2xx o no es HTML', () => {
    expect(fallidas(validarRespuesta('u', respuesta({ status: 404 })).validaciones)).toEqual(['Respuesta HTTP 2xx'])
    const sinTipo = validarRespuesta('u', respuesta({ tipo: null }))
    expect(sinTipo.estado).toBe('FAIL')
    expect(buscar(sinTipo.validaciones, 'Content-Type text/html').detalle).toBe('sin Content-Type')
  })

  it('guarda la Report-Only recibida', () => {
    const resultado = validarRespuesta('u', respuesta({ csp: null, reportOnly: CSP_PROYECTO }))
    expect(resultado).toMatchObject({ estado: 'FAIL', csp: null, cspReportOnly: CSP_PROYECTO })
  })
})

describe('verificarSitio', () => {
  const ahora = new Date('2026-10-21T12:00:00Z')

  it('pide la raíz y /login y da PASS si las dos cumplen', async () => {
    const fetch = vi.fn(async () => respuesta())
    const resultado = await verificarSitio(BASE, { fetch, ahora })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['https://qa.ejemplo.com/', 'https://qa.ejemplo.com/login'])
    expect(resultado).toMatchObject({
      urls: ['https://qa.ejemplo.com/', 'https://qa.ejemplo.com/login'],
      fecha: '2026-10-21T12:00:00.000Z',
      estado: 'PASS',
    })
    expect(resultado).not.toHaveProperty('error')
  })

  it('un error de red deja la URL y el resultado en FAIL, con el error', async () => {
    const fetch = vi.fn(async (url) => {
      if (url.endsWith('/login')) throw new Error('fetch failed')
      return respuesta()
    })
    const resultado = await verificarSitio(BASE, { fetch, ahora })
    expect(resultado.estado).toBe('FAIL')
    expect(resultado.error).toBe('https://qa.ejemplo.com/login: fetch failed')
    expect(resultado.resultados[1]).toMatchObject({ estado: 'FAIL', validaciones: [] })
  })

  it('basta una URL sin CSP para que el resultado sea FAIL', async () => {
    const fetch = vi.fn(async (url) => respuesta({ csp: url.endsWith('/login') ? null : CSP_PROYECTO }))
    const resultado = await verificarSitio(BASE, { fetch, ahora })
    expect(resultado.resultados.map((r) => r.estado)).toEqual(['PASS', 'FAIL'])
    expect(resultado.estado).toBe('FAIL')
  })
})

describe('ejecutar', () => {
  let carpeta
  afterEach(() => {
    vi.restoreAllMocks()
    if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true })
  })

  it('escribe el JSON (creando la carpeta) y lo resume en la consola', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'))
    const salida = path.join(carpeta, 'zap-reports', 'csp-validation.json')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    const resultado = await ejecutar(BASE, salida, { fetch: async () => respuesta() })

    expect(resultado.estado).toBe('PASS')
    expect(JSON.parse(fs.readFileSync(salida, 'utf8'))).toEqual(resultado)
    expect(log.mock.calls.at(-1)[0]).toBe(`\nCSP: PASS · resultado en ${salida}`)
  })

  it('una URL base inválida también deja el JSON, en FAIL y con el error', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'))
    const salida = path.join(carpeta, 'csp-validation.json')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const resultado = await ejecutar('no es una url', salida, { fetch: async () => respuesta() })

    expect(resultado).toMatchObject({ estado: 'FAIL', resultados: [] })
    expect(resultado.error).toMatch(/invalid/i)
    expect(JSON.parse(fs.readFileSync(salida, 'utf8')).estado).toBe('FAIL')
  })

  it('imprime los errores de red de cada URL', async () => {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'csp-'))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await ejecutar(BASE, path.join(carpeta, 'r.json'), {
      fetch: async () => {
        throw new Error('getaddrinfo ENOTFOUND')
      },
    })
    expect(log.mock.calls.map(([texto]) => texto)).toContain('  ✗ error: getaddrinfo ENOTFOUND')
  })
})
