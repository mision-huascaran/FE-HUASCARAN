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
import { borrarHabilitaciones } from '../api/resources/habilitaciones'
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
  // D51 — Y las habilitaciones: se quedaban en IndexedDB y el siguiente
  // usuario del mismo navegador heredaba con qué escribir sin conexión.
  await Promise.all([borrarPrecarga(), borrarCacheConsultas(), borrarHabilitaciones()])
}

/**
 * La cuenta que usó este navegador la última vez.
 *
 * Es el único dato con el que el siguiente inicio de sesión puede decidir si
 * lo guardado le pertenece. El cierre de sesión lo borra con todo lo demás, y
 * está bien: después de un cierre limpio no queda nada que proteger.
 */
const CLAVE_ULTIMO_USUARIO = 'sicedu.ultimo.usuario'


/**
 * EL PERFIL, para poder recargar SIN CONEXIÓN (D82).
 *
 * El perfil vive en memoria y una recarga lo pierde. Al volver, el
 * arranque pide `GET /me`; sin señal eso falla y la aplicación se quedaba
 * en "No se pudo contactar con el servidor", con el Docente sin poder
 * seguir trabajando —justo lo que el modo sin conexión promete—.
 *
 * Se guarda una copia y se usa **solo cuando el servidor no contesta**. Un
 * 401 o un 403 siguen cerrando la sesión: ahí el token no sirve, y esto no
 * puede servir para seguir dentro con una sesión que el servidor rechazó.
 *
 * No añade riesgo: es el mismo `localStorage` donde ya vive el token, y el
 * cierre de sesión lo borra con todo lo demás.
 */
const CLAVE_PERFIL = 'sicedu.perfil'

export function guardarPerfilLocal(perfil) {
  try {
    if (perfil) localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil))
  } catch {
    // Sin localStorage se trabaja solo en línea; no es un fallo que contar.
  }
}

/** El perfil guardado, si es del MISMO usuario que dice el token. */
export function perfilLocalDe(idUsuario) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_PERFIL) ?? 'null')
    if (!guardado) return null
    // Si el token es de otra cuenta, la copia no le pertenece.
    if (idUsuario != null && String(guardado.id_usuario) !== String(idUsuario)) return null
    return guardado
  } catch {
    return null
  }
}
/**
 * Deja el navegador limpio si entra una cuenta DISTINTA de la anterior (D51).
 *
 * El cierre de sesión ya limpia todo, pero solo cuando se pulsa "Cerrar
 * sesión". Si la pestaña se cierra, el token caduca o alguien lo borra a mano,
 * esa limpieza nunca corre: el resumen del Inicio, los filtros y las consultas
 * guardadas se quedan, y la siguiente persona los ve como suyos. El probador
 * lo encontró entrando con otra cuenta del mismo rol y viendo el resumen de la
 * anterior.
 *
 * No basta con mirar el rol: dos Supervisores comparten rol y no comparten
 * datos. Se compara la CUENTA.
 *
 * @returns `true` si se borró algo, es decir si el usuario cambió.
 */
export async function limpiarSiEsOtroUsuario(idUsuario) {
  if (idUsuario == null) return false

  let anterior = null
  try {
    anterior = localStorage.getItem(CLAVE_ULTIMO_USUARIO)
  } catch {
    // Sin almacenamiento no hay nada que comparar ni que limpiar.
    return false
  }

  const mismo = anterior != null && String(anterior) === String(idUsuario)
  // La primera vez (`anterior === null`) no se borra nada: no hay motivo para
  // suponer que lo guardado es de otro, y el usuario acaba de entrar.
  if (!mismo && anterior != null) await limpiarDatosLocalesDeSesion()

  try {
    localStorage.setItem(CLAVE_ULTIMO_USUARIO, String(idUsuario))
  } catch {
    // Que no se pueda recordar no impide trabajar.
  }
  return !mismo && anterior != null
}
