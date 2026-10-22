// Identificador de ESTE dispositivo (CU017–CU021, T5).
//
// El aviso de pendientes lo lleva, y no es un adorno: el mismo docente puede
// trabajar sin señal en la tablet del aula y en su teléfono, y lo que al
// Supervisor le interesa no es "hay 40 cosas sin subir" sino de dónde salen.
// Sin esto, dos dispositivos con trabajo atascado se ven como uno.
//
// Vive en `localStorage` a propósito, no en IndexedDB: tiene que sobrevivir a
// `limpiarDatosLocalesDeSesion()` —que borra los datos de menores al salir— y
// seguir siendo el MISMO después de un cierre de sesión. No identifica a la
// persona, solo al navegador, así que no es un dato personal que haya que
// borrar; si se borrara, el siguiente aviso parecería venir de otro equipo.
const CLAVE = 'sicedu.dispositivo'

/** Un UUID, con respaldo para navegadores viejos y para jsdom. */
function nuevoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * El id de este dispositivo, creándolo la primera vez.
 *
 * Si `localStorage` no está disponible —modo privado de algunos navegadores,
 * o jsdom sin DOM— devuelve uno de usar y tirar en vez de reventar: el aviso
 * perdería precisión, pero mandarlo sigue siendo mejor que no mandarlo.
 */
export function idDeDispositivo() {
  try {
    const guardado = localStorage.getItem(CLAVE)
    if (guardado) return guardado
    const nuevo = nuevoId()
    localStorage.setItem(CLAVE, nuevo)
    return nuevo
  } catch {
    return nuevoId()
  }
}
