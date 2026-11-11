// F5 — Indicadores del Directivo (CU012, RN-033, RN-034).
//
// El Directivo ve sus indicadores y ningún dato personal de alumnos: ni el
// nombre del alumno que registró F3, ni la sección Alumnos en su menú, ni
// campos personales en las respuestas de la API.
//
// S36 (docs/decisiones-externas-y-pendientes-de-backend.md): el Directivo ya
// no tiene Inicio. Sus tres tarjetas institucionales (beneficiarios activos,
// colegios operando y salud del sistema) se retiraron porque "el Dashboard ya
// las da", y ese Dashboard es una tarjeta por módulo. Antes esta prueba
// contaba las 3 tarjetas en /inicio; ahora verifica las 4 del Dashboard, que
// es lo que S36 le da en su lugar. Las tres cifras de antes no aparecen con
// ese nombre en ninguna pantalla.
import { expect, test } from '@playwright/test'
import { MODULOS_DEL_DASHBOARD, esperarDashboardDelDirectivo, tarjetaDeModulo } from './support/dashboard.js'
import { leerEstado } from './support/estado.js'
import { evidencia } from './support/evidencia.js'
import { iniciarSesion, menu } from './support/sesion.js'
import { vigilarDatosDeAlumnos } from './support/sinAlumnos.js'

test('F5 · Indicadores del Directivo: su Dashboard por módulo y ningún dato de alumnos (CU012, S36, RN-033/034)', async ({ page }) => {
  const revisarApi = vigilarDatosDeAlumnos(page)
  await iniciarSesion(page, 'directivo')

  await test.step('Sus indicadores, en el Dashboard: una tarjeta por módulo (S36)', async () => {
    await esperarDashboardDelDirectivo(page)
    for (const modulo of MODULOS_DEL_DASHBOARD) {
      // S36: los cuatro módulos son `[DIRECTIVO]: null`, así que la tarjeta
      // informa pero no ofrece entrar ("Ver en …"): sería una puerta tapiada.
      await expect(tarjetaDeModulo(page, modulo).getByRole('link'), `enlace en «${modulo}»`).toHaveCount(0)
    }
    await evidencia(page, 'directivo-dashboard')
  })

  await test.step('Sin datos personales de alumnos, ni en pantalla ni en la API (RN-033, RN-034)', async () => {
    await expect(menu(page).getByRole('link', { name: 'Alumnos', exact: true })).toHaveCount(0)

    const { alumno } = leerEstado()
    if (alumno) {
      await expect(page.getByText(alumno)).toHaveCount(0)
    } else {
      test.info().annotations.push({
        type: 'aviso',
        description: 'F3 no dejó alumno (¿se saltó?): no se pudo buscar su nombre en el Dashboard del Directivo.',
      })
    }
    const { hallazgos, respuestas } = await revisarApi(alumno)
    expect(respuestas, 'respuestas de la API revisadas').toBeGreaterThan(0)
    expect(hallazgos, 'datos de alumnos en las respuestas de la API').toEqual([])
    await evidencia(page, 'directivo-sin-alumnos')
  })
})
