// Datos que un flujo deja para otros en la MISMA ejecución: F3 crea el alumno y
// la actividad que luego buscan F5 y F7. Playwright vacía test-results/ al
// empezar, así que nunca se lee un estado de una corrida anterior.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'

const ARCHIVO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../test-results/e2e-state.json')

export function leerEstado() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'))
  } catch {
    return {}
  }
}

export function guardarEstado(cambios) {
  fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true })
  fs.writeFileSync(ARCHIVO, JSON.stringify({ ...leerEstado(), ...cambios }, null, 2))
}

/** Lo que dejó un flujo anterior (`flujo`: 'F3', 'F8'…), o salta la prueba diciendo por qué. */
export function exigirEstadoDe(flujo, ...claves) {
  const estado = leerEstado()
  const faltan = claves.filter((clave) => !estado[clave])
  // Se salta a propósito: esta prueba verifica datos que crea otro flujo; si ese flujo se saltó (fuera de periodo) o falló, no hay qué verificar.
  test.skip(faltan.length > 0, `${flujo} no dejó ${faltan.join(', ')} en test-results/e2e-state.json (¿se saltó o falló?)`)
  return estado
}

/** Lo que dejó F3, o salta la prueba diciendo por qué. */
export const exigirEstadoDeF3 = (...claves) => exigirEstadoDe('F3', ...claves)
