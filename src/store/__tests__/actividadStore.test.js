// Sesión de ACTIVIDADES (D4), que no es la de autenticación.
//
// Lo que se comprueba aquí es lo que hace que el aula funcione sin red: que la
// sesión se pueda abrir sin servidor, que sobreviva a una recarga y que muera
// con la sesión de autenticación.
import { beforeEach, describe, expect, it } from 'vitest'
import useActividadStore, { hayActividadesIniciadas } from '../actividadStore'
import useSessionStore from '../sessionStore'

beforeEach(() => {
  sessionStorage.clear()
  useActividadStore.setState({ sesion: null })
})

describe('sesión de actividades', () => {
  it('se abre sin servidor: el id lo genera el navegador', () => {
    expect(hayActividadesIniciadas()).toBe(false)

    const sesion = useActividadStore.getState().iniciar({ idDocente: 1 })

    // Sin un id propio no se podría empezar a trabajar sin conexión.
    expect(sesion.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(sesion.id_docente).toBe(1)
    expect(sesion.fin).toBeNull()
    expect(hayActividadesIniciadas()).toBe(true)
  })

  it('sobrevive a una recarga de la página', () => {
    const { id } = useActividadStore.getState().iniciar({ idDocente: 1 })
    expect(JSON.parse(sessionStorage.getItem('sicedu.actividad')).id).toBe(id)
  })

  it('al cerrarla devuelve la sesión con su fin, para poder encolarla', () => {
    useActividadStore.getState().iniciar({ idDocente: 1 })
    const cerrada = useActividadStore.getState().cerrar()

    expect(cerrada.fin).toBeTruthy()
    expect(hayActividadesIniciadas()).toBe(false)
  })

  it('cerrar la sesión de autenticación cierra también las actividades', () => {
    useActividadStore.getState().iniciar({ idDocente: 1 })
    expect(sessionStorage.getItem('sicedu.actividad')).toBeTruthy()

    useSessionStore.getState().cerrarSesion()

    // No se puede seguir editando las grillas del aula con un token muerto.
    expect(sessionStorage.getItem('sicedu.actividad')).toBeNull()
  })
})

/**
 * D114 — Una sola fuente para "hay actividad en curso", y la marca de cuándo
 * la conoce el servidor: mientras no la conozca, su `escritura` se calculó sin
 * ella.
 */
describe('la actividad iniciada sin conexión y el servidor (D114)', () => {
  it('nace sin confirmar y se confirma cuando su inicio llega al servidor', () => {
    const { id } = useActividadStore.getState().iniciar({ idDocente: 1 })
    expect(useActividadStore.getState().sesion.delServidor).toBeUndefined()

    useActividadStore.getState().confirmarEnServidor(id)

    expect(useActividadStore.getState().sesion.delServidor).toBe(true)
    // Y sobrevive a la recarga con la marca.
    expect(JSON.parse(sessionStorage.getItem('sicedu.actividad')).delServidor).toBe(true)
  })

  it('la confirmación de OTRA actividad no toca la abierta', () => {
    useActividadStore.getState().iniciar({ idDocente: 1 })
    useActividadStore.getState().confirmarEnServidor('otra')
    expect(useActividadStore.getState().sesion.delServidor).toBeUndefined()
  })
})
