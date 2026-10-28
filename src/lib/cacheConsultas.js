// La última respuesta de cada pantalla de registro, guardada para abrirla sin
// conexión (RNF-001): Lectura, Rúbrica y Registro de Vuelo, y lo que necesitan
// sus filtros (años, asignaciones, colegio, semanas y niveles Raz-Kids).
//
// No es una caché HTTP: es la caché de TanStack Query copiada a IndexedDB. Al
// entrar se vuelca de vuelta, así que la pantalla pinta lo último que vio el
// docente; sin conexión las consultas quedan en pausa (no fallan) y con
// conexión se refrescan solas. Incluye lo que el docente cambió y espera en la
// cola, porque eso también se escribe en la caché.
//
// Son datos de menores: van con el id del usuario y se borran al cerrar sesión.
import { del, get, set } from 'idb-keyval'

const CLAVE = 'sicedu.cache-consultas'
// `calendario` y `clases` entran por CU027 y CU013: los dos casos de uso
// piden expresamente poder CONSULTAR sin conexión la última versión guardada,
// con su fecha y marcada como tal. Escribir sigue exigiendo conexión.
const RAICES = new Set([
  'anios-escolares',
  'me',
  'colegio',
  'colegios',
  'semanas',
  'lectura',
  'rubricas',
  'registro-vuelo',
  'catalogo',
  'calendario',
  'clases',
])
const ESPERA_MS = 300

const seGuarda = (clave) => Array.isArray(clave) && RAICES.has(clave[0])

/**
 * Sin IndexedDB (navegación privada, jsdom) `idb-keyval` lanza al llamarlo, no
 * en la promesa: se envuelve para que la pantalla siga funcionando en línea.
 */
async function leer() {
  try {
    return await get(CLAVE)
  } catch {
    return null
  }
}

async function guardar(valor) {
  try {
    await set(CLAVE, valor)
  } catch {
    // Sin IndexedDB no hay copia: se trabaja en línea.
  }
}

/**
 * Vuelca lo guardado del usuario en la caché y empieza a copiar lo nuevo.
 * Devuelve la función que deja de copiar.
 */
export function conectarCacheConsultas(cliente, propietario) {
  if (propietario == null) return () => {}
  let entradas = {}
  let temporizador = null
  let activa = true

  const escribir = () => {
    clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      guardar({ propietario, entradas }).catch(() => null) // `guardar` ya maneja sus errores.
    }, ESPERA_MS)
  }

  leer().then((guardada) => {
    if (!activa || !guardada || guardada.propietario !== propietario) return
    entradas = { ...guardada.entradas, ...entradas }
    Object.values(guardada.entradas ?? {}).forEach(({ clave, datos, en }) => {
      // Lo que ya está en memoria es más reciente que lo guardado.
      if (cliente.getQueryData(clave) === undefined) cliente.setQueryData(clave, datos, { updatedAt: en })
    })
  }).catch(() => null) // Sin caché recuperable se sigue con la memoria: no es un error.

  const desuscribir = cliente.getQueryCache().subscribe((evento) => {
    const consulta = evento?.query
    if (!consulta || !seGuarda(consulta.queryKey) || consulta.state.data === undefined) return
    if (evento.type !== 'updated') return
    entradas[consulta.queryHash] = { clave: consulta.queryKey, datos: consulta.state.data, en: consulta.state.dataUpdatedAt }
    escribir()
  })

  return () => {
    activa = false
    clearTimeout(temporizador)
    desuscribir()
  }
}

export async function borrarCacheConsultas() {
  try {
    await del(CLAVE)
  } catch {
    // Sin IndexedDB disponible no hay nada que borrar.
  }
}
