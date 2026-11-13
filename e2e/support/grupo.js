// Los filtros de grupo de Lectura, Rúbrica y Registro de Vuelo (colegio,
// grado, sección y subprograma). El año y el mes se quedan en el actual.
import { expect } from '@playwright/test'
import { SEED } from './cuentas.js'
import { SUBPROGRAMA } from './asistencia.js'

export async function elegirGrupo(page, { grado }) {
  const colegio = page.getByLabel('Colegio', { exact: true })
  await expect(colegio.getByRole('option', { name: SEED.colegio, exact: true }), 'el colegio E2E en el filtro Colegio').toBeAttached()
  await colegio.selectOption({ label: SEED.colegio })
  await page.getByLabel('Grado', { exact: true }).selectOption({ label: grado })
  await page.getByLabel('Sección', { exact: true }).selectOption({ label: 'Única' })
  await page.getByLabel('Subprograma', { exact: true }).selectOption({ label: SUBPROGRAMA })
}
