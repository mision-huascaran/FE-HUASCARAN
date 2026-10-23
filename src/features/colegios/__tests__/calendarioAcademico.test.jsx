// CU027 — el calendario académico, visto desde Colegios.
//
// De estas fechas dependen el periodo de cada colegio, qué día es lectivo,
// cuándo una asignación es retroactiva y qué periodos admiten un permiso
// excepcional. Por eso la tabla tiene que ser explícita en una cosa: son OCHO
// periodos SIEMPRE, y lo que falta se ve como un hueco por rellenar.
import { describe, expect, it } from 'vitest'
import { nombreDePeriodo, ochoPeriodos } from '../../../api/resources/calendarios'

describe('Los ocho periodos del año', () => {
  it('se arman siempre, aunque el servidor devuelva menos', () => {
    /**
     * La tabla se monta desde la lista fija y no desde la respuesta: un
     * calendario a medias tiene que verse como huecos por rellenar, no como
     * una tabla más corta a la que no se le nota lo que falta.
     */
    const filas = ochoPeriodos([{ tipo: 'PA', numero: 1, fecha_inicio: '2026-03-02', fecha_fin: '2026-05-15' }])

    expect(filas).toHaveLength(8)
    expect(filas.map(nombreDePeriodo)).toEqual(['PA1', 'PR1', 'PA2', 'PR2', 'PA3', 'PR3', 'PA4', 'PR4'])
  })

  it('cada fecha cae en SU periodo, no en el orden en que llegó', () => {
    const filas = ochoPeriodos([
      { tipo: 'PR', numero: 3, fecha_inicio: '2026-11-01', fecha_fin: '2026-11-08' },
      { tipo: 'PA', numero: 1, fecha_inicio: '2026-03-02', fecha_fin: '2026-05-15' },
    ])

    expect(filas[0]).toMatchObject({ tipo: 'PA', numero: 1, fecha_inicio: '2026-03-02' })
    expect(filas[5]).toMatchObject({ tipo: 'PR', numero: 3, fecha_inicio: '2026-11-01' })
  })

  it('un periodo sin fechas llega vacío, no como undefined', () => {
    // Van directos a un <input type="date">: un `undefined` lo volvería no
    // controlado y React se queja en cuanto alguien escribe en él.
    const filas = ochoPeriodos([])
    expect(filas.every((p) => p.fecha_inicio === '' && p.fecha_fin === '')).toBe(true)
  })

  it('sin lista tampoco revienta', () => {
    expect(ochoPeriodos()).toHaveLength(8)
    expect(ochoPeriodos(null)).toHaveLength(8)
  })
})
