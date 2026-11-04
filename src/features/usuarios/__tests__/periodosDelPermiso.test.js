// Los periodos que ofrece "Otorgar permiso" (CU028).
//
// El desplegable "Periodo académico" solo mostraba PA1 y PA2: el simulador
// cortaba por `numero < 3`, un número fijo. En noviembre, con el PA3 cerrado el
// 31 de octubre, el Supervisor no podía otorgar un permiso para regularizarlo
// —que es justo para lo que existe CU028—.
//
// La regla no es el número del periodo, es su FECHA: aparecen los que ya no
// admiten regularización ordinaria.
import { describe, expect, it } from 'vitest'
import handlers from '../../../api/mock/handlers'

describe('periodos que admiten un permiso de corrección', () => {
  it('ofrece todos los PA cuyo plazo ordinario ya terminó, no solo los dos primeros', async () => {
    const { periodos } = await handlers.permisos.opciones({ idColegio: 1, idAnioEscolar: 2 })
    const nombres = periodos.map((p) => p.nombre)

    // Hoy (noviembre de 2026) el PA3 terminó el 31 de octubre.
    expect(nombres).toContain('PA1')
    expect(nombres).toContain('PA2')
    expect(nombres).toContain('PA3')
  })

  it('no ofrece el periodo en curso ni los que no han empezado', async () => {
    const { periodos } = await handlers.permisos.opciones({ idColegio: 1, idAnioEscolar: 2 })

    // El PA4 va del 9 al 30 de noviembre: todavía se regulariza por la vía
    // ordinaria, así que no necesita permiso.
    expect(periodos.map((p) => p.nombre)).not.toContain('PA4')
  })

  it('cada periodo viaja con el id que espera el backend', async () => {
    const { periodos } = await handlers.permisos.opciones({ idColegio: 1, idAnioEscolar: 2 })

    periodos.forEach((p) => {
      expect(typeof p.id).toBe('number')
      expect(p.nombre).toMatch(/^PA[1-4]$/)
    })
  })
})
