// D76 — Otorgar un permiso de corrección con la vigencia CON ZONA (CU028).
//
// Era el defecto bloqueante de la ronda 4: no se podía otorgar ningún permiso
// desde la pantalla. El `<input type="datetime-local">` devuelve
// "2026-10-27T12:39" —hora local, sin offset—, el front lo mandaba tal cual y
// el servidor no podía comparar una fecha sin zona con una con zona.
//
// El backend ya lo tolera, pero el front sigue mandándolo con zona: así el
// instante no depende de cómo decida interpretarlo el servidor.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn(async () => ({ data: {} }))

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { post: (...a) => post(...a) },
  // Sin esto el recurso resuelve contra el simulador y nunca llega al `post`.
  resolver: ({ real }) => real(),
  adminContraApiReal: true,
}))

const { otorgarPermiso } = await import('../resources/permisos')

const BASE = {
  id_anio_escolar: '2',
  id_colegio: '1',
  id_grado: '2',
  id_periodo_academico: '6',
  modulo: 'asistencias',
  motivo: 'Faltó registrar marzo',
}

const cuerpo = () => post.mock.calls[0][1]

beforeEach(() => post.mockClear())

describe('La vigencia de un permiso', () => {
  it('manda inicio y fin con zona, no como los escribe el control', async () => {
    await otorgarPermiso(4, { ...BASE, desde_ahora: false, inicio: '2026-10-27T10:00', fin: '2026-10-28T10:00' })

    // `toISOString()` siempre termina en Z: es el instante exacto, sin
    // ambigüedad. Lo que NO puede salir es el texto del input tal cual.
    expect(cuerpo().inicio).toMatch(/Z$/)
    expect(cuerpo().fin).toMatch(/Z$/)
    expect(cuerpo().inicio).not.toBe('2026-10-27T10:00')
  })

  it('conserva el instante: lo que se escribió es lo que se manda', async () => {
    await otorgarPermiso(4, { ...BASE, desde_ahora: false, inicio: '2026-10-27T10:00', fin: '2026-10-28T10:00' })

    // Se compara contra el mismo cálculo del navegador en vez de contra una
    // hora fija: el test no puede dar por supuesto que la máquina está en Lima.
    expect(cuerpo().inicio).toBe(new Date('2026-10-27T10:00').toISOString())
    expect(cuerpo().fin).toBe(new Date('2026-10-28T10:00').toISOString())
  })

  it('con "Desde ahora" no manda inicio: la hora la pone el servidor', async () => {
    /**
     * Es la razón de ser de la opción. Si el Supervisor escribe la hora a mano
     * y tarda un minuto en guardar, el inicio queda en el pasado y el servidor
     * lo rechaza con "Selecciona una fecha y hora futura…".
     */
    await otorgarPermiso(4, { ...BASE, desde_ahora: true, inicio: '', fin: '2026-10-28T10:00' })

    expect(cuerpo().desde_ahora).toBe(true)
    expect('inicio' in cuerpo()).toBe(false)
    expect(cuerpo().fin).toMatch(/Z$/)
  })

  it('`desde_ahora` viaja también en false', async () => {
    // Es el campo con el que el servidor decide quién pone la hora de inicio.
    await otorgarPermiso(4, { ...BASE, desde_ahora: false, inicio: '2026-10-27T10:00', fin: '2026-10-28T10:00' })
    expect(cuerpo().desde_ahora).toBe(false)
  })

  it('un valor que no es una fecha se manda tal cual, sin inventar una', async () => {
    // Que lo rechace el servidor con su mensaje. Convertirlo a `Invalid Date`
    // mandaría null y el error hablaría de un campo vacío que sí se llenó.
    await otorgarPermiso(4, { ...BASE, desde_ahora: false, inicio: 'no es una fecha', fin: '2026-10-28T10:00' })
    expect(cuerpo().inicio).toBe('no es una fecha')
  })
})
