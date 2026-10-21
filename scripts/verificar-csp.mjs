/**
 * Verificación independiente de la Content-Security-Policy del frontend
 * desplegado. La corre el stage 'Security Headers - CSP' del Jenkinsfile (qa).
 *
 *   npm run verificar:csp
 *   node scripts/verificar-csp.mjs [baseURL] [archivoJSON]
 *
 * Por defecto: CSP_TARGET_URL (o qa) y zap-reports/csp-validation.json. Revisa
 * la raíz y una ruta de la SPA, y sale con 1 si alguna validación no se cumple
 * o si hay un error de red. Sin dependencias: Node 24 y su fetch.
 *
 * La política de referencia es la de deploy/cabeceras-seguridad.conf: si se
 * cambia allí, hay que cambiar POLITICA_MINIMA aquí (y sus pruebas).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const URL_QA = 'https://qa-huascaran.ingsoftware.lat'
export const RUTAS = ['/', '/login']
const ESPERA_MS = 15_000

/** Directivas mínimas y el valor exacto que deben tener. */
export const POLITICA_MINIMA = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'connect-src': ["'self'"],
}

const PALABRAS_INSEGURAS = new Set(["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'"])
const ESQUEMAS_SUELTOS = new Set(['http:', 'https:'])
/** En estas, data: y blob: permitirían ejecutar código que no sale del build. */
const SIN_DATA_NI_BLOB = new Set(['script-src', 'default-src'])
/** `*` solo, `*.dominio` o con esquema delante (`https://*.dominio`). */
function esComodin(fuente) {
  const inicioHost = fuente.indexOf('://')
  return (inicioHost === -1 ? fuente : fuente.slice(inicioHost + 3)).startsWith('*')
}

/**
 * Una cabecera repetida llega unida por comas, y la coma también separa
 * políticas dentro de una misma cabecera: cada trozo es una política aparte
 * que el navegador aplica además de las otras.
 */
export function separarPoliticas(valor) {
  return (valor ?? '')
    .split(',')
    .map((politica) => politica.trim())
    .filter(Boolean)
}

/** Directivas de una política. Si una se repite, vale la primera, como en el navegador. */
export function leerDirectivas(politica) {
  const directivas = new Map()
  for (const parte of politica.split(';')) {
    const [nombre, ...fuentes] = parte.trim().toLowerCase().split(/\s+/)
    if (nombre && !directivas.has(nombre)) directivas.set(nombre, fuentes)
  }
  return directivas
}

const validacion = (nombre, cumple, detalle) => ({ nombre, cumple, detalle })

/** `directiva: fuente` de cada fuente de cualquier política que cumpla `condicion`. */
function buscarFuentes(politicas, condicion) {
  const hallazgos = []
  for (const directivas of politicas) {
    for (const [directiva, fuentes] of directivas) {
      for (const fuente of fuentes) {
        if (condicion(fuente, directiva)) hallazgos.push(`${directiva}: ${fuente}`)
      }
    }
  }
  return hallazgos
}

const sinHallazgos = (nombre, hallazgos) =>
  validacion(nombre, hallazgos.length === 0, hallazgos.length ? hallazgos.join(' · ') : 'ninguna')

/**
 * Validaciones de la CSP recibida (función pura). `csp` es el valor de
 * Content-Security-Policy tal como lo devuelve `Headers.get` (null si no
 * vino) y `cspReportOnly`, el de Content-Security-Policy-Report-Only.
 */
export function validarCsp(csp, cspReportOnly = null) {
  const politicas = separarPoliticas(csp).map(leerDirectivas)
  const principal = politicas[0] ?? new Map()

  let detallePresente = 'Llega la cabecera que el navegador aplica'
  if (!politicas.length) {
    detallePresente = cspReportOnly
      ? 'Solo llega Content-Security-Policy-Report-Only: el navegador avisa pero no bloquea'
      : 'La respuesta no trae Content-Security-Policy'
  }

  let detalleUnica = politicas.length ? 'Una sola política' : 'Sin política'
  if (politicas.length > 1) {
    const distintas = new Set(separarPoliticas(csp)).size > 1
    detalleUnica = `${politicas.length} políticas ${distintas ? 'distintas' : 'iguales'} (¿la pone también el proxy?)`
  }

  const directivasMinimas = Object.entries(POLITICA_MINIMA).map(([directiva, esperado]) => {
    const recibido = principal.get(directiva)
    const nombre = `Directiva ${directiva} ${esperado.join(' ')}`
    if (!recibido) return validacion(nombre, false, 'No está en la política')
    const igual = recibido.length === esperado.length && esperado.every((fuente) => recibido.includes(fuente))
    return validacion(nombre, igual, `Recibido: ${directiva} ${recibido.join(' ')}`)
  })

  return [
    validacion('Content-Security-Policy presente', politicas.length > 0, detallePresente),
    validacion('Cabecera no duplicada', politicas.length <= 1, detalleUnica),
    ...directivasMinimas,
    sinHallazgos(
      "Sin 'unsafe-inline', 'unsafe-eval' ni 'unsafe-hashes'",
      buscarFuentes(politicas, (fuente) => PALABRAS_INSEGURAS.has(fuente)),
    ),
    sinHallazgos('Sin comodines (*)', buscarFuentes(politicas, esComodin)),
    sinHallazgos(
      'Sin esquemas sueltos http: ni https:',
      buscarFuentes(politicas, (fuente) => ESQUEMAS_SUELTOS.has(fuente)),
    ),
    sinHallazgos(
      'Sin data: ni blob: en script-src ni default-src',
      buscarFuentes(
        politicas,
        (fuente, directiva) => SIN_DATA_NI_BLOB.has(directiva) && (fuente === 'data:' || fuente === 'blob:'),
      ),
    ),
  ]
}

/** Resultado de una URL: la respuesta HTTP más las validaciones de su CSP. */
export function validarRespuesta(url, respuesta) {
  const tipo = respuesta.headers.get('content-type') ?? ''
  const csp = respuesta.headers.get('content-security-policy')
  const cspReportOnly = respuesta.headers.get('content-security-policy-report-only')
  const validaciones = [
    validacion('Respuesta HTTP 2xx', respuesta.status >= 200 && respuesta.status < 300, `HTTP ${respuesta.status}`),
    validacion('Content-Type text/html', /^text\/html\b/i.test(tipo), tipo || 'sin Content-Type'),
    ...validarCsp(csp, cspReportOnly),
  ]
  return {
    url,
    http: respuesta.status,
    contentType: tipo || null,
    csp,
    cspReportOnly,
    estado: validaciones.every((v) => v.cumple) ? 'PASS' : 'FAIL',
    validaciones,
  }
}

/** Pide cada ruta y valida su respuesta. Un error de red deja esa URL en FAIL con `error`. */
export async function verificarSitio(base, { rutas = RUTAS, fetch = globalThis.fetch, ahora = new Date() } = {}) {
  const resultados = []
  for (const ruta of rutas) {
    const url = new URL(ruta, base).href
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) })
      resultados.push(validarRespuesta(url, respuesta))
    } catch (error) {
      resultados.push({ url, estado: 'FAIL', error: error.message, validaciones: [] })
    }
  }
  const errores = resultados.filter((r) => r.error).map((r) => `${r.url}: ${r.error}`)
  return {
    urls: resultados.map((r) => r.url),
    fecha: ahora.toISOString(),
    estado: resultados.every((r) => r.estado === 'PASS') ? 'PASS' : 'FAIL',
    politicaMinima: POLITICA_MINIMA,
    resultados,
    ...(errores.length ? { error: errores.join(' | ') } : {}),
  }
}

function imprimir(resultado, salida) {
  for (const r of resultado.resultados) {
    console.log(`\n${r.estado}  ${r.url}`)
    if (r.error) console.log(`  ✗ error: ${r.error}`)
    for (const v of r.validaciones) console.log(`  ${v.cumple ? '✓' : '✗'} ${v.nombre} — ${v.detalle}`)
  }
  console.log(`\nCSP: ${resultado.estado} · resultado en ${salida}`)
}

/** Verifica, escribe el JSON y lo resume en la consola. Devuelve el resultado. */
export async function ejecutar(base, salida, opciones = {}) {
  let resultado
  try {
    resultado = await verificarSitio(base, opciones)
  } catch (error) {
    // Un fallo inesperado también deja el JSON, en FAIL y con el error.
    resultado = { urls: [], fecha: new Date().toISOString(), estado: 'FAIL', resultados: [], error: error.message }
  }
  fs.mkdirSync(path.dirname(salida), { recursive: true })
  fs.writeFileSync(salida, `${JSON.stringify(resultado, null, 2)}\n`)
  imprimir(resultado, salida)
  return resultado
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (esPrincipal) {
  const base = process.argv[2] ?? process.env.CSP_TARGET_URL ?? URL_QA
  const salida = process.argv[3] ?? 'zap-reports/csp-validation.json'
  const resultado = await ejecutar(base, salida)
  if (resultado.estado !== 'PASS') process.exitCode = 1
}
