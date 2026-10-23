// Limpieza de los datos locales al cerrar sesión (CU007, CU008, RN-007).
//
// Qué se borra y qué no, según el contrato (§3.3 y §11):
//
//   · BORRA la precarga de IndexedDB (alumnos, colegios, catálogos) y la
//     copia de las pantallas de registro (`cacheConsultas`): es una
//     copia descargada, se vuelve a bajar en el siguiente inicio de sesión, y
//     si se queda, la siguiente persona que use el navegador —por ejemplo un
//     Directivo— tiene en su IndexedDB los nombres de los alumnos del Docente
//     anterior.
//   · VACÍA localStorage ENTERO. CU007 lo pide así de literal: "limpiar
//     íntegramente el LocalStorage del navegador, eliminando resúmenes
//     operativos en caché, filtros de grillas de todos los módulos y cualquier
//     otro estado local temporal guardado por el usuario saliente". Antes solo
//     se borraban las claves `sicedu.*`, lo que dejaba fuera cualquier cosa que
//     un módulo guardara con otro nombre, hoy o mañana.
//   · NO TOCA la cola de envíos pendientes: eso es trabajo del docente que
//     todavía no llegó al servidor, y se envía tras el siguiente login. CU008
//     lo prohíbe expresamente ("prohibido vaciar IndexedDB durante el cierre si
//     existen registros pendientes").
import { borrarPrecarga } from './precarga'
import { borrarCacheConsultas } from './cacheConsultas'
import useRechazosStore from '../store/rechazosStore'

/**
 * Lo único que SOBREVIVE al cierre de sesión.
 *
 * El desfase con el reloj del servidor no es estado del usuario: no dice nada
 * de él, no es personal, y es la defensa que CU022 y CU009 exigen contra un
 * reloj de dispositivo manipulado. Borrarlo haría que la primera sesión sin
 * conexión del siguiente usuario volviera a fiarse de la hora local, que es
 * exactamente lo que el caso de uso prohíbe.
 *
 * Se vuelve a calibrar solo en cuanto el servidor contesta, pero el hueco entre
 * el login y esa primera respuesta es justo donde no conviene estar ciego.
 */
const CLAVES_QUE_NO_SON_DEL_USUARIO = ['sicedu.reloj.desfase']

export function limpiarLocalStorageDeSesion() {
  try {
    const conservar = CLAVES_QUE_NO_SON_DEL_USUARIO.map((clave) => [clave, localStorage.getItem(clave)])
    // `clear()` y no un barrido por prefijo: lo que se busca es que no quede
    // NADA del usuario que sale en un equipo que se comparte con otros.
    localStorage.clear()
    conservar.forEach(([clave, valor]) => {
      if (valor != null) localStorage.setItem(clave, valor)
    })
  } catch {
    // Almacenamiento bloqueado: no hay nada que limpiar.
  }
}

export async function limpiarDatosLocalesDeSesion() {
  limpiarLocalStorageDeSesion()
  useRechazosStore.getState().limpiar()
  await Promise.all([borrarPrecarga(), borrarCacheConsultas()])
}
