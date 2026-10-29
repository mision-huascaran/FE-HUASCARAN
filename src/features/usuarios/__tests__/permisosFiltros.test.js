// D77 — Permisos de corrección (CU028): lo que faltaba de la ronda 6.
//
//   · Una superposición dice CON QUÉ permiso choca (sus fechas).
//   · Si lo otorgado no coincide con los filtros, se avisa: si no, el
//     Supervisor no lo ve en la lista y cree que no se creó.
import { describe, expect, it } from 'vitest'
import { combinacionesRechazadas } from '../../../api/resources/permisos'
import { coincideConFiltros } from '../PermisosDeCorreccion'
import { formatearFechaHora } from '../../../lib/format'

describe('Permiso superpuesto (D77)', () => {
  it('añade las fechas del permiso existente al rechazo de su combinación', () => {
    const existente = { id: 12, inicio: '2026-10-01T13:00:00Z', fin: '2026-10-31T13:00:00Z' }
    const error = {
      response: {
        status: 409,
        data: {
          motivo: 'permiso_superpuesto',
          combinaciones_rechazadas: [
            {
              indice: 1,
              motivo: 'permiso_superpuesto',
              detail: 'Ya existe un permiso para este mismo alcance con una vigencia que coincide total o parcialmente con la propuesta.',
              permiso_existente: existente,
            },
          ],
        },
      },
    }

    const texto = combinacionesRechazadas(error)[1]
    expect(texto).toContain('Ya existe un permiso para este mismo alcance')
    expect(texto).toContain(
      `Permiso existente: del ${formatearFechaHora(existente.inicio)} al ${formatearFechaHora(existente.fin)}.`,
    )
  })
})

describe('Lo otorgado y los filtros de la lista (D77)', () => {
  const otorgado = { id_anio_escolar: '2', id_colegio: '1', id_periodo_academico: '6', modulos: ['lectura'] }

  it('sin filtros, o con los mismos, coincide', () => {
    expect(coincideConFiltros(otorgado, { id_anio_escolar: '', id_colegio: '', modulo: '' })).toBe(true)
    expect(coincideConFiltros(otorgado, { id_anio_escolar: '2', id_colegio: '1', modulo: 'lectura' })).toBe(true)
  })

  it('otro colegio u otro módulo no coincide', () => {
    expect(coincideConFiltros(otorgado, { id_colegio: '4' })).toBe(false)
    expect(coincideConFiltros(otorgado, { modulo: 'rubrica' })).toBe(false)
  })
})
