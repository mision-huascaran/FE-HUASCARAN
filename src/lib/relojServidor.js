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

/** La lectura del contador al ENVIAR una petición, para medir cuánto tardó (D99). */
export const instanteMonotonico = monotonico

/**
 * La cabecera `Date` trunca a SEGUNDOS: la hora real del servidor al
 * responder está en [Date, Date + 1 s). Se toma el extremo de arriba.
 */
const TRUNCADO_MS = 1000

/**
 * Por debajo de esto, un ancla nueva que dé una hora MÁS TEMPRANA es ruido
 * (otro truncado, otra latencia) y no corrige nada: se queda la anterior.
 * Por encima es un salto de verdad —el reloj del servidor cambió— y manda.
 */
const RUIDO_MS = 5000

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
/**
 * D99 — EL ANCLA NO PUEDE IR ATRASADA.
 *
 * Antes se anclaba a la cabecera `Date` tal cual: truncada al segundo y
 * emitida antes de viajar por la red, así que `ahora()` iba 1 a 2 s por
 * detrás del servidor. El backend valida cada operación a su `realizado_en`,
 * y con ese atraso un cambio hecho justo después de revocar un permiso o de
 * finalizar la actividad se aceptaba. Ir un poco ADELANTADO no tiene ese
 * riesgo: el servidor tolera 2 minutos.
 *
 * Por eso se suma el segundo del truncado y la mitad del viaje (`enviadoEn`,
 * la lectura de `instanteMonotonico()` al mandar la petición).
 */
export function sincronizarReloj(fechaServidor, { enviadoEn = null } = {}) {
  const declarado = Date.parse(fechaServidor ?? '')
  if (!Number.isFinite(declarado)) return
  const recibido = monotonico()
  const viaje = Number.isFinite(enviadoEn) ? Math.max(0, recibido - enviadoEn) : 0
  const instante = declarado + TRUNCADO_MS + viaje / 2

  // Entre respuestas seguidas se queda la estimación más tardía: todas
  // aproximan la misma hora y la diferencia es ruido de truncado y de red.
  if (ancla) {
    const actual = ancla.servidorMs + (recibido - ancla.monotonicoMs)
    if (instante < actual && actual - instante < RUIDO_MS) return
  }
  ancla = { servidorMs: instante, monotonicoMs: recibido }
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
