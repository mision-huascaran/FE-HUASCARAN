// Limpieza de los datos locales al cerrar sesión (CU007, CU008, RN-007).
//
// Qué se borra y qué no, según el contrato (§3.3 y §11):
//
//   · BORRA la precarga de IndexedDB (alumnos, colegios, catálogos): es una
//     copia descargada, se vuelve a bajar en el siguiente inicio de sesión, y
//     si se queda, la siguiente persona que use el navegador —por ejemplo un
//     Directivo— tiene en su IndexedDB los nombres de los alumnos del Docente
//     anterior.
//   · BORRA de localStorage los filtros y el último resumen de Inicio
//     (`sicedu.*`).
//   · NO TOCA la cola de envíos pendientes: eso es trabajo del docente que
//     todavía no llegó al servidor, y se envía tras el siguiente login.
import { borrarPrecarga } from './precarga'

const PREFIJO = 'sicedu.'

export function limpiarLocalStorageDeSesion() {
  try {
    const claves = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const clave = localStorage.key(i)
      if (clave?.startsWith(PREFIJO)) claves.push(clave)
    }
    claves.forEach((clave) => localStorage.removeItem(clave))
  } catch {
    // Almacenamiento bloqueado: no hay nada que limpiar.
  }
}

export async function limpiarDatosLocalesDeSesion() {
  limpiarLocalStorageDeSesion()
  await borrarPrecarga()
}
