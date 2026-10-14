// Reloj de referencia del sistema (CU022, Restricciones).
//
// EL RELOJ DEL DISPOSITIVO NO VALE. CU022 es tajante: el backend es la única
// fuente de verdad para validar fechas, y para operar sin conexión el frontend
// calcula el tiempo con un DIFERENCIAL (offset) fijado en la última conexión
// correcta, "ignorando cualquier alteración manual en el reloj del dispositivo
// local".
//
// Sin esto bastaba con atrasar el reloj del portátil para que el selector de
// fecha dejara elegir un día que el backend habría rechazado, y las marcas se
// encolaban para morir al sincronizar.
//
// El desfase sobrevive al cierre del navegador: si se pierde, el primer día sin
// conexión se volvería a confiar en el reloj local, que es justo lo que se
// quiere evitar.
const CLAVE = 'sicedu.reloj.desfase'
const LIMA = 'America/Lima'

/** `YYYY-MM-DD` en hora de Lima, que es el día lectivo que ve el docente. */
const diaDe = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: LIMA }).format(fecha)

function leerDesfase() {
  try {
    const guardado = Number(localStorage.getItem(CLAVE))
    return Number.isFinite(guardado) ? guardado : 0
  } catch {
    // Almacenamiento bloqueado: se arranca sin desfase y se recalcula en
    // cuanto el servidor conteste.
    return 0
  }
}

let desfaseMs = leerDesfase()

/**
 * Ajusta el desfase con la hora que acaba de declarar el servidor.
 *
 * Se llama con la cabecera `Date` de cualquier respuesta, así que el reloj se
 * recalibra solo mientras se usa la aplicación: no hace falta un endpoint
 * dedicado ni pedir la hora aparte.
 */
export function sincronizarReloj(fechaServidor) {
  const instante = Date.parse(fechaServidor ?? '')
  if (!Number.isFinite(instante)) return
  desfaseMs = instante - Date.now()
  try {
    localStorage.setItem(CLAVE, String(desfaseMs))
  } catch {
    // Se conserva solo en memoria para esta pestaña.
  }
}

/** La hora de verdad: la del dispositivo corregida con el desfase. */
export const ahora = () => new Date(Date.now() + desfaseMs)

/** Hoy en Lima según el servidor. Es el tope del selector de fecha. */
export const hoy = () => diaDe(ahora())

/** Una fecha `YYYY-MM-DD` posterior a hoy. CU022 prohíbe registrarlas. */
export const esFutura = (fecha) => Boolean(fecha) && fecha > hoy()

/** Solo para las pruebas: devuelve el reloj a su estado inicial. */
export function _reiniciarReloj() {
  desfaseMs = 0
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Nada que limpiar.
  }
}
