// Captura adjunta al reporte en cada verificación clave. El video y el trace
// los graba Playwright solo (`use` en playwright.config.js).
import { test } from '@playwright/test'

export async function evidencia(page, nombre) {
  await test.info().attach(nombre, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}
