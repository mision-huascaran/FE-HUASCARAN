// UUID de operaciones y dispositivos: el nativo si existe y, si no (HTTP o un
// navegador viejo), uno armado con crypto.getRandomValues, nunca con Math.random.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nuevoUuid } from '../uuid'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.restoreAllMocks()
})

describe('nuevoUuid', () => {
  it('usa crypto.randomUUID cuando existe', () => {
    const nativo = vi.spyOn(crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555')
    expect(nuevoUuid()).toBe('11111111-2222-4333-8444-555555555555')
    expect(nativo).toHaveBeenCalledTimes(1)
  })

  it('sin crypto.randomUUID arma un v4 con getRandomValues', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    const aleatorio = vi.spyOn(crypto, 'getRandomValues')
    const azar = vi.spyOn(Math, 'random')
    try {
      const ids = new Set(Array.from({ length: 50 }, () => nuevoUuid()))
      expect(ids.size).toBe(50)
      for (const id of ids) expect(id).toMatch(UUID_V4)
      expect(aleatorio).toHaveBeenCalled()
      expect(azar).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })

  it('fija los bits de versión y variante aunque el azar dé ceros o unos', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      vi.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => bytes.fill(0))
      expect(nuevoUuid()).toBe('00000000-0000-4000-8000-000000000000')
      vi.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => bytes.fill(255))
      expect(nuevoUuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})
