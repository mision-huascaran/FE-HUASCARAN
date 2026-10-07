// T19 — Precarga al pulsar "Iniciar actividad".
//
// Sin esto el trabajo sin conexión no existe: el docente abriría la grilla y no
// habría ni alumnos ni catálogos que mostrar. Se baja todo de golpe al empezar,
// mientras todavía hay red, y se guarda en IndexedDB.
//
// Se precarga lo que el aula necesita y nada más: sus alumnos, los catálogos de
// niveles y las grillas de la semana y el periodo en curso. Los filtros van en
// localStorage, que es para preferencias, no para registros.
import { get, set } from 'idb-keyval'

const CLAVE = 'sicedu.precarga'

/**
 * Descarga y guarda lo necesario para trabajar sin conexión.
 *
 * No lanza: si algo falla, la actividad se inicia igual y se trabaja en línea.
 * Bloquear el inicio por un fallo de precarga sería peor que no precargar.
 *
 * @param {object} fuentes funciones que devuelven cada bloque de datos
 * @returns {Promise<{ok: boolean, guardadoEn: string|null}>}
 */
export async function precargarParaOffline(fuentes = {}) {
  const bloques = Object.entries(fuentes)

  const resultados = await Promise.allSettled(bloques.map(([, cargar]) => cargar()))

  const datos = {}
  resultados.forEach((resultado, i) => {
    if (resultado.status === 'fulfilled') datos[bloques[i][0]] = resultado.value
  })

  // Si no se pudo traer nada, no se guarda una precarga vacía que luego
  // parecería "no hay alumnos" en vez de "no se pudo descargar".
  if (Object.keys(datos).length === 0) return { ok: false, guardadoEn: null }

  const guardadoEn = new Date().toISOString()
  try {
    await set(CLAVE, { datos, guardadoEn })
  } catch {
    return { ok: false, guardadoEn: null }
  }

  return { ok: resultados.every((r) => r.status === 'fulfilled'), guardadoEn }
}

/** Lo último que se precargó, para pintar las pantallas sin conexión. */
export async function leerPrecarga() {
  try {
    return (await get(CLAVE)) ?? null
  } catch {
    return null
  }
}
