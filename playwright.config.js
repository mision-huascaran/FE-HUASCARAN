// Pruebas E2E con Playwright contra la aplicación DESPLEGADA (rama qa, después
// del deploy). Ver e2e/README.md para correrlas y para las variables.
//
// Evidencias obligatorias del curso: video, trace y captura de TODAS las
// ejecuciones, pasen o fallen. Jenkins archiva playwright-report/ y
// test-results/ como artifacts.
import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// En local las credenciales viven en `.env.e2e` (ignorado por git). En Jenkins
// llegan como variables de entorno y el archivo no existe. `loadEnvFile` no
// pisa una variable que ya venga del entorno.
if (fs.existsSync('.env.e2e')) process.loadEnvFile('.env.e2e')

const enCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  outputDir: 'test-results/',
  globalSetup: './e2e/global-setup.js',

  // Los flujos comparten datos reales (el alumno y la actividad de F3 los
  // leen F5 y F7) y el Docente E2E no puede tener dos actividades abiertas:
  // se corre en serie y en orden de archivo.
  fullyParallel: false,
  workers: 1,
  retries: enCI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: process.env.BASE_URL,
    video: 'on',
    trace: 'on',
    screenshot: 'on',
    timezoneId: 'America/Lima',
    locale: 'es-PE',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
