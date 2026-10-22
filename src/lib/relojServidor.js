// Reloj de referencia del sistema (CU010 y CU022, Restricciones).
//
// EL RELOJ DEL DISPOSITIVO NO VALE. El backend es la única fuente de verdad
// para validar fechas, y para operar sin conexión el frontend tiene que
// estimar la hora "ignorando cualquier alteración manual en el reloj del
// dispositivo local".
//
// POR QUÉ NO BASTA UN DESFASE. Durante mucho tiempo esto guardaba un `offset`
// contra la hora del servidor y calculaba `ahora()` como `Date.now() + offset`.
// CU010 dice expresamente que eso no alcanza: pide estimar la hora "mediante un
// contador monotónico (tiempo transcurrido independiente de los cambios
// manuales del reloj), sin consultar el reloj local como fuente de verdad ni
// limitarse a sumarle el offset". Y tiene razón: si alguien adelanta el reloj
// DESPUÉS de sincronizar, `Date.now() + offset` se adelanta con él. El offset
// corrige el error que había en el momento del anclaje, no los posteriores.
//
// CÓMO SE RESUELVE. Se guarda un ANCLA: la hora que declaró el servidor junto
// con la lectura de `performance.now()` en ese mismo instante. `performance.now()`
// cuenta milisegundos desde que se abrió la página y NO se ve afectado por
// cambios del reloj del sistema. La hora actual es entonces
//
//     hora del servidor + (performance.now() de ahora − performance.now() del ancla)
//
// que es inmune a que toquen el reloj en mitad de la jornada.
//
// LA CONTINUIDAD SE PIERDE AL RECARGAR. `performance.now()` vuelve a cero en
// cada carga de la página, así que un ancla de la sesión anterior no sirve de
// nada. CU010 lo contempla y dice qué hacer:
//
//   "Si una recarga, reinicio o interrupción impide conservar o verificar la
//    continuidad de la referencia temporal, el sistema requiere conexión para
//    restablecerla antes de habilitar nuevas operaciones de escritura, sin
//    eliminar los registros pendientes."
//
// De ahí la distinción entre LEER y ESCRIBIR. Tras recargar sin conexión se
// sigue pudiendo consultar: para eso se conserva el desfase antiguo en
// `localStorage`, que da una hora aproximada y es mejor que nada. Pero
// `hayContinuidad()` devuelve false y las pantallas deben bloquear la escritura
// hasta que el servidor vuelva a contestar —cosa que ocurre sola, porque el
// interceptor de `api/client.js` reancla el reloj en CADA respuesta—.
//
// Lo que NO se hace: borrar la cola de pendientes. Esos registros se generaron
// cuando la referencia sí era válida y el backend revalida sus fechas al
// sincronizar.
const CLAVE = 'sicedu.reloj.desfase'
const LIMA = 'America/Lima'

/** `YYYY-MM-DD` en hora de Lima, que es el día lectivo que ve el docente. */
const diaDe = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: LIMA }).format(fecha)

/**
 * El contador monotónico.
 *
 * `performance.now()` existe en todo navegador moderno. El respaldo a
 * `Date.now()` es para entornos donde no esté: ahí se pierde la inmunidad a los
 * cambios de reloj, pero sigue siendo preferible a no tener hora.
 */
const monotonico = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

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

/**
 * El ancla de esta carga de la página: `{servidorMs, monotonicoMs}`.
 *
 * `null` mientras el servidor no haya contestado ni una vez. Nunca se
 * restaura de `localStorage`, porque su parte monotónica pertenece a una
 * sesión del navegador que ya no existe.
 */
let ancla = null

/** Respaldo de SOLO LECTURA para cuando todavía no hay ancla. */
let desfaseMs = leerDesfase()

/**
 * Ajusta la referencia con la hora que acaba de declarar el servidor.
 *
 * Se llama con la cabecera `Date` de cualquier respuesta, así que el reloj se
 * reancla solo mientras se usa la aplicación: no hace falta un endpoint
 * dedicado ni pedir la hora aparte. Y como reanclar restablece la continuidad,
 * la primera respuesta tras recuperar la conexión vuelve a habilitar la
 * escritura sin que nadie tenga que hacer nada.
 */
export function sincronizarReloj(fechaServidor) {
  const instante = Date.parse(fechaServidor ?? '')
  if (!Number.isFinite(instante)) return
  ancla = { servidorMs: instante, monotonicoMs: monotonico() }
  desfaseMs = instante - Date.now()
  try {
    localStorage.setItem(CLAVE, String(desfaseMs))
  } catch {
    // Se conserva solo en memoria para esta pestaña.
  }
}

/**
 * ¿La referencia temporal es verificable ahora mismo?
 *
 * Solo lo es con un ancla de ESTA carga de la página. Es la condición que
 * CU010 exige para permitir nuevas escrituras.
 */
export const hayContinuidad = () => ancla !== null

/**
 * La hora de verdad.
 *
 * Con ancla, se calcula con el contador monotónico. Sin ella —primera carga, o
 * una recarga sin conexión— se cae al desfase guardado, que da una hora
 * aproximada suficiente para CONSULTAR. Quien vaya a escribir debe comprobar
 * antes `hayContinuidad()`.
 */
export const ahora = () =>
  ancla ? new Date(ancla.servidorMs + (monotonico() - ancla.monotonicoMs)) : new Date(Date.now() + desfaseMs)

/** Hoy en Lima según el servidor. Es el tope del selector de fecha. */
export const hoy = () => diaDe(ahora())

/** Una fecha `YYYY-MM-DD` posterior a hoy. CU022 prohíbe registrarlas. */
export const esFutura = (fecha) => Boolean(fecha) && fecha > hoy()

/**
 * El literal de CU024 para cuando no se puede verificar la continuidad.
 *
 * Los demás módulos lo reutilizan: el caso de uso da este texto para la
 * creación de la tabla de lectura, y no hay motivo para decir una cosa
 * distinta en cada pantalla cuando el impedimento es el mismo.
 */
export const SIN_REFERENCIA_TEMPORAL =
  'No se puede verificar la fecha sin conexión. Conéctate a Internet para actualizar los datos y continuar.'

/** Solo para las pruebas: devuelve el reloj a su estado inicial. */
export function _reiniciarReloj() {
  ancla = null
  desfaseMs = 0
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Nada que limpiar.
  }
}
