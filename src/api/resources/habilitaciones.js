// El paquete con el que el frontend decide SIN CONEXIÓN si puede escribir.
//
// `GET /me/habilitaciones` devuelve, de una vez, las asignaciones del Docente,
// sus permisos excepcionales vigentes (CU028) y los calendarios de sus colegios
// (CU027). Se descarga al entrar y se guarda en IndexedDB, porque es
// exactamente lo que hace falta para resolver "¿puedo escribir en este grupo,
// en esta fecha?" cuando no hay red.
//
// Con red no se consulta para decidir: cada GET de módulo ya trae su propio
// bloque `escritura`, calculado por quien tiene los datos. Esto es el respaldo.
//
// Y el backend revalida todo al sincronizar, así que una copia desactualizada
// no abre ninguna puerta: como mucho deja escribir algo que luego se rechaza,
// y el registro se conserva para que la persona lo revise.
import { get, set } from 'idb-keyval'
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const CLAVE_IDB = 'sicedu.habilitaciones'

/** Lo descargado la última vez, o `null` si nunca se pudo. */
export async function habilitacionesGuardadas() {
  try {
    return (await get(CLAVE_IDB)) ?? null
  } catch {
    // IndexedDB bloqueado (navegación privada): se trabaja solo en línea.
    return null
  }
}

/**
 * `GET /me/habilitaciones` y copia a IndexedDB.
 *
 * Si la petición falla se devuelve lo guardado en vez de propagar el error: el
 * objetivo de este paquete es justamente tener algo cuando el servidor no
 * contesta. Quien lo consuma distingue los dos casos por `generado_en`.
 */
export const obtenerMisHabilitaciones = async () => {
  try {
    const datos = await resolver({
      mock: () => handlers.habilitaciones.mias(),
      real: () => api.get(ENDPOINTS.permisos.misHabilitaciones),
      forzarReal: adminContraApiReal,
    })
    try {
      await set(CLAVE_IDB, datos)
    } catch {
      // Sin IndexedDB se usa en memoria mientras dure la pestaña.
    }
    return datos
  } catch (error) {
    const guardadas = await habilitacionesGuardadas()
    if (guardadas) return guardadas
    throw error
  }
}

/**
 * `GET /calendarios/periodo` — qué PA o PR aplica a una fecha en un colegio.
 *
 * Es la versión autorizada de lo que `auth/habilitaciones.js` calcula en local:
 * con conexión se pregunta, sin conexión se deduce del calendario descargado.
 */
export const obtenerPeriodoDeFecha = ({ idColegio, fecha }) =>
  resolver({
    mock: () => handlers.habilitaciones.periodo({ idColegio, fecha }),
    real: () =>
      api.get(ENDPOINTS.calendarios.periodo, { params: { id_colegio: Number(idColegio), fecha } }),
    forzarReal: adminContraApiReal,
  })
