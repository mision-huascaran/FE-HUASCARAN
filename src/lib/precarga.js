// T19 — Precarga al pulsar "Iniciar actividad".
//
// Sin esto el trabajo sin conexión no existe: el docente abriría la grilla y no
// habría ni alumnos ni catálogos que mostrar. Se baja todo de golpe al empezar,
// mientras todavía hay red, y se guarda en IndexedDB.
//
// Se precarga lo que el aula necesita y nada más: sus alumnos, los catálogos de
// niveles y las grillas de la semana y el periodo en curso. Los filtros van en
// localStorage, que es para preferencias, no para registros.
import { del, get, set } from 'idb-keyval'

const CLAVE = 'sicedu.precarga'

async function leerCruda() {
  try {
    return (await get(CLAVE)) ?? null
  } catch {
    return null
  }
}

/**
 * Descarga y guarda lo necesario para trabajar sin conexión.
 *
 * No lanza: si algo falla, la actividad se inicia igual y se trabaja en línea.
 * Bloquear el inicio por un fallo de precarga sería peor que no precargar.
 *
 * Si falla una parte, CU003 pide conservar la última versión válida y no darla
 * por actualizada. Por eso:
 *   · cada bloque que falla conserva lo que había guardado antes (antes se
 *     perdía: se sobrescribía la precarga entera con lo que sí llegó);
 *   · `guardadoEn` solo avanza cuando llegaron TODOS los bloques. Si no, se
 *     mantiene la fecha de la última precarga completa.
 *
 * @param {object} fuentes funciones que devuelven cada bloque de datos
 * @param {object} [opciones]
 * @param {number|string} [opciones.propietario] id del usuario dueño de los
 *   datos. Una precarga de otro usuario nunca se mezcla ni se lee.
 * @returns {Promise<{ok: boolean, guardadoEn: string|null}>}
 */
export async function precargarParaOffline(fuentes = {}, { propietario = null } = {}) {
  const bloques = Object.entries(fuentes)

  const resultados = await Promise.allSettled(bloques.map(([, cargar]) => cargar()))

  const nuevos = {}
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') nuevos[bloques[i][0]] = resultado.value
  })
  const completa = resultados.every((r) => r.status === 'fulfilled')

  // Si no se pudo traer nada, no se guarda una precarga vacía que luego
  // parecería "no hay alumnos" en vez de "no se pudo descargar".
  if (Object.keys(nuevos).length === 0) return { ok: false, guardadoEn: null }

  const anterior = await leerCruda()
  const mismaPersona = anterior && (anterior.propietario ?? null) === propietario
  const base = mismaPersona ? anterior : null

  const datos = completa ? nuevos : { ...(base?.datos ?? {}), ...nuevos }
  const guardadoEn = completa ? new Date().toISOString() : (base?.guardadoEn ?? null)

  try {
    await set(CLAVE, { datos, guardadoEn, propietario, completa: completa || Boolean(base?.completa) })
  } catch {
    return { ok: false, guardadoEn: null }
  }

  return { ok: completa, guardadoEn }
}

/**
 * Lo último que se precargó, para pintar las pantallas sin conexión.
 *
 * Con `propietario`, solo devuelve la precarga de ese usuario: si en el
 * navegador quedó la de otra persona, para esta no existe.
 */
export async function leerPrecarga(propietario) {
  const guardada = await leerCruda()
  if (!guardada) return null
  if (propietario !== undefined && (guardada.propietario ?? null) !== (propietario ?? null)) return null
  return guardada
}

/** Se borra al cerrar sesión: son datos de menores (RN-007, CU003). */
export async function borrarPrecarga() {
  try {
    await del(CLAVE)
  } catch {
    // Sin IndexedDB disponible no hay nada que borrar.
  }
}

/** Id del usuario dueño de una precarga, venga del simulador o del backend. */
export const propietarioDe = (usuario) => usuario?.id_usuario ?? usuario?.id ?? null
