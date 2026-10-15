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
