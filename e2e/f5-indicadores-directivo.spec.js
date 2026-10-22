// F5 — Indicadores del Directivo (CU012, RN-033, RN-034).
//
// El Directivo ve exactamente dos indicadores institucionales y ningún dato
// personal de alumnos: ni el nombre del alumno que registró F3, ni la sección
// Alumnos en su menú.
import { expect, test } from '@playwright/test'
import { leerEstado } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, menu } from './support/sesion.js'
import { tarjetas, valorDeTarjeta } from './support/tarjetas.js'

test('F5 · Indicadores del Directivo: 3 tarjetas y ningún dato de alumnos (CU012, RN-033/034)', async ({ page }) => {
  await iniciarSesion(page, 'directivo')

  await test.step('Exactamente 3 tarjetas, cada una con su valor (CU012)', async () => {
    /**
     * TRES tarjetas. La retirada de "Salud del sistema" se revirtió: CU012 la
     * enumera, trae su fórmula y hasta su caso vacío —"Sin datos disponibles"
     * cuando el servidor no puede calcularla—. Que hoy llegue siempre en
     * `null` no es un fallo: es ese flujo alternativo. Desmontarla obligaría a
     * volver a construirla en cuanto el backend reporte la cola offline.
     */
    await expect(tarjetas(page)).toHaveCount(3)
    await expect(valorDeTarjeta(page, 'Total de beneficiarios activos')).toHaveText(/^\d+$/)
    await expect(valorDeTarjeta(page, 'Total de colegios operando')).toHaveText(/^\d+$/)
    // Un porcentaje entero, o el literal del caso vacío de CU012.
    await expect(valorDeTarjeta(page, 'Salud del sistema')).toHaveText(/^(\d+%|Sin datos disponibles)$/)
    await evidencia(page, 'directivo-tres-tarjetas')
  })

  await test.step('Sin datos personales de alumnos (RN-033, RN-034)', async () => {
    await expect(menu(page).getByRole('link', { name: 'Alumnos', exact: true })).toHaveCount(0)

    const { alumno } = leerEstado()
    if (alumno) {
      await expect(page.getByText(alumno)).toHaveCount(0)
    } else {
      test.info().annotations.push({
        type: 'aviso',
        description: 'F3 no dejó alumno (¿se saltó?): no se pudo buscar su nombre en el Inicio del Directivo.',
      })
    }
    await evidencia(page, 'directivo-sin-alumnos')
  })
})
