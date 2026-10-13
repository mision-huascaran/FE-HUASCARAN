// Antes de cualquier prueba: las variables necesarias existen y la aplicación
// desplegada responde. Los tests corren justo después del deploy, así que el
// contenedor puede tardar en levantar: se espera hasta ~2 minutos.
import { VARIABLES_REQUERIDAS } from './support/cuentas.js'

const ESPERA_MAXIMA_MS = 120_000
const INTERVALO_MS = 5_000

async function responde(url) {
  try {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    return respuesta.ok
  } catch {
    return false
  }
}

async function esperar(url, nombre) {
  const limite = Date.now() + ESPERA_MAXIMA_MS
  for (let intento = 1; Date.now() < limite; intento += 1) {
    if (await responde(url)) {
      console.log(`[e2e] ${nombre} responde (${url}).`)
      return
    }
    console.log(`[e2e] Esperando a ${nombre}… intento ${intento}`)
    await new Promise((resolver) => setTimeout(resolver, INTERVALO_MS))
  }
  throw new Error(`[e2e] ${nombre} no respondió en ${ESPERA_MAXIMA_MS / 1000} s: ${url}`)
}

export default async function globalSetup() {
  // Solo los NOMBRES de las que faltan: nunca un valor.
  const faltantes = ['BASE_URL', ...VARIABLES_REQUERIDAS].filter((nombre) => !process.env[nombre]?.trim())
  if (faltantes.length) {
    throw new Error(`[e2e] Faltan variables de entorno: ${faltantes.join(', ')}. Ver e2e/README.md.`)
  }

  const base = process.env.BASE_URL.replace(/\/$/, '')
  await esperar(`${base}/`, 'el frontend')
  // El frontend reenvía /api al backend del mismo entorno: sin él no hay login.
  await esperar(`${base}/api/`, 'el backend (a través de /api)')
}
