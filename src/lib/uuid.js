// UUID v4 para identificar operaciones y dispositivos.
//
// `crypto.randomUUID` solo existe en contextos seguros (HTTPS) y en navegadores
// recientes. El respaldo usa `crypto.getRandomValues`, que está en todos y,
// a diferencia de `Math.random`, es un generador criptográficamente seguro.

/** Un UUID v4 nuevo (RFC 4122). */
export function nuevoUuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
