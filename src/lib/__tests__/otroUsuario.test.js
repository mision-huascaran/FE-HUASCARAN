// D51 — Lo que deja una cuenta no lo hereda la siguiente (CU007, RN-007).
//
// El cierre de sesión ya limpia el navegador, pero solo cuando se pulsa
// "Cerrar sesión". Si la pestaña se cierra, el token caduca o alguien lo borra
// a mano, esa limpieza nunca corre: el resumen del Inicio, los filtros y las
// consultas guardadas se quedan, y la siguiente persona los ve como suyos.
//
// El probador lo encontró entrando con otra cuenta del MISMO ROL y viendo el
// resumen de la anterior. Por eso se compara la cuenta y no el rol: dos
// Supervisores comparten rol y no comparten datos.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const borrarPrecarga = vi.fn(async () => {})
const borrarCacheConsultas = vi.fn(async () => {})

vi.mock('../precarga', () => ({ borrarPrecarga: (...a) => borrarPrecarga(...a) }))
vi.mock('../cacheConsultas', () => ({ borrarCacheConsultas: (...a) => borrarCacheConsultas(...a) }))

const { limpiarSiEsOtroUsuario } = await import('../datosLocales')

beforeEach(() => {
  localStorage.clear()
  borrarPrecarga.mockClear()
  borrarCacheConsultas.mockClear()
})

describe('Entrar con otra cuenta', () => {
  it('la primera vez no borra nada: no hay motivo para suponer que es de otro', async () => {
    localStorage.setItem('sicedu.resumen.supervisor.4', '{"datos":1}')

    expect(await limpiarSiEsOtroUsuario(4)).toBe(false)
    expect(localStorage.getItem('sicedu.resumen.supervisor.4')).not.toBeNull()
    expect(borrarPrecarga).not.toHaveBeenCalled()
  })

  it('la MISMA cuenta conserva lo suyo', async () => {
    await limpiarSiEsOtroUsuario(4)
    localStorage.setItem('sicedu.filtros.alumnos', '{"colegio":1}')

    expect(await limpiarSiEsOtroUsuario(4)).toBe(false)
    expect(localStorage.getItem('sicedu.filtros.alumnos')).toBe('{"colegio":1}')
  })

  it('otra cuenta borra localStorage, la precarga y las consultas guardadas', async () => {
    await limpiarSiEsOtroUsuario(4)
    localStorage.setItem('sicedu.resumen.supervisor.4', '{"colegios":9}')
    localStorage.setItem('sicedu.filtros.alumnos', '{"colegio":1}')

    expect(await limpiarSiEsOtroUsuario(7)).toBe(true)

    expect(localStorage.getItem('sicedu.resumen.supervisor.4')).toBeNull()
    expect(localStorage.getItem('sicedu.filtros.alumnos')).toBeNull()
    // Los datos de menores de IndexedDB también: es lo que exige RN-007.
    expect(borrarPrecarga).toHaveBeenCalled()
    expect(borrarCacheConsultas).toHaveBeenCalled()
  })

  it('el desfase del reloj SOBREVIVE al cambio de cuenta', async () => {
    /**
     * No es un dato del usuario: no dice nada de él y es la defensa que CU009
     * y CU022 exigen contra un reloj de dispositivo manipulado. Borrarlo
     * dejaría la primera sesión sin conexión de la cuenta nueva fiándose de la
     * hora local, que es justo lo que los casos de uso prohíben.
     */
    await limpiarSiEsOtroUsuario(4)
    localStorage.setItem('sicedu.reloj.desfase', '-1200')

    await limpiarSiEsOtroUsuario(7)
    expect(localStorage.getItem('sicedu.reloj.desfase')).toBe('-1200')
  })

  it('deja anotada la cuenta nueva para la comparación siguiente', async () => {
    await limpiarSiEsOtroUsuario(4)
    await limpiarSiEsOtroUsuario(7)

    // Entrar otra vez con 7 ya no borra: es la misma persona.
    localStorage.setItem('sicedu.filtros.alumnos', '{"colegio":2}')
    expect(await limpiarSiEsOtroUsuario(7)).toBe(false)
    expect(localStorage.getItem('sicedu.filtros.alumnos')).toBe('{"colegio":2}')
  })

  it('sin cuenta no hace nada: no se borra por un perfil que no llegó', async () => {
    await limpiarSiEsOtroUsuario(4)
    localStorage.setItem('sicedu.filtros.alumnos', '{"colegio":1}')

    expect(await limpiarSiEsOtroUsuario(undefined)).toBe(false)
    expect(localStorage.getItem('sicedu.filtros.alumnos')).toBe('{"colegio":1}')
  })
})
