// El Service Worker y el aviso de versión nueva (D43).
//
// POR QUÉ `prompt` Y NO `autoUpdate`. Un despliegue nuevo no puede cambiar la
// aplicación bajo los pies de un docente a mitad de jornada: recargar en medio
// de una lista de asistencia es, en el mejor caso, volver a buscar la fila. La
// versión nueva se instala en segundo plano y espera; quien decide cuándo
// aplicarla es la persona.
//
// LO QUE EL SERVICE WORKER SÍ HACE es que la aplicación ABRA sin conexión:
// precachea el HTML, el JS y el CSS, y responde cualquier ruta de navegación
// con `index.html`. Hasta ahora, recargar sin señal daba el error del
// navegador y toda la capacidad offline dependía de que la pestaña no se
// cerrara nunca.
//
// LO QUE NO HACE es cachear datos. De `/api/` se encargan IndexedDB y la cola
// de envíos, que saben qué está pendiente y qué no; una caché de red por
// encima solo serviría para enseñar datos viejos creyendo que son nuevos.

/** Lo que hay que llamar para aplicar la versión nueva, o `null`. */
let aplicar = null

/** A quién avisar cuando haya una versión esperando. */
const suscriptores = new Set()

const avisar = () => suscriptores.forEach((fn) => fn(Boolean(aplicar)))

/**
 * Registra el Service Worker.
 *
 * Se llama una sola vez al arrancar. En desarrollo no hay ninguno —estorba
 * más que ayuda: deja JS viejo pegado entre recargas— y en las pruebas el
 * import dinámico simplemente no resuelve, así que falla en silencio.
 */
export async function registrarServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const { registerSW } = await import('virtual:pwa-register')
    aplicar = registerSW({
      onNeedRefresh() {
        avisar()
      },
    })
  } catch {
    // Sin plugin (desarrollo o pruebas) no hay nada que registrar.
  }
}

/** Avisa cuando hay una versión nueva esperando. Devuelve cómo desuscribirse. */
export function alHaberVersionNueva(fn) {
  suscriptores.add(fn)
  return () => suscriptores.delete(fn)
}

/**
 * Aplica la versión nueva y recarga.
 *
 * Solo se llama desde el aviso, nunca sola: lo que se pierde al recargar es el
 * formulario que la persona tuviera abierto, y eso lo decide ella.
 */
export function aplicarVersionNueva() {
  aplicar?.(true)
}
