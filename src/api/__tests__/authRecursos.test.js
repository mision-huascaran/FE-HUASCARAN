// Recursos de autenticación (src/api/resources/auth.js).
//
// Son la capa que decide, por cada llamada, si va al mock o a la API real. En
// pruebas `VITE_AUTH_REAL` no está puesta, así que resuelven contra los
// handlers del mock: lo que se comprueba aquí es que cada función arme bien su
// petición y propague el error del servidor tal cual, que es de lo que dependen
// los mensajes del modal de recuperar contraseña.
import { describe, expect, it } from 'vitest'
import {
  cambiarPasswordConCodigo,
  cerrarSesionEnServidor,
  normalizarPerfil,
  recuperarPassword,
  restablecerPassword,
  solicitarCodigoRecuperacion,
  verificarCodigoRecuperacion,
} from '../resources/auth'

// El mock acepta un único código, igual para todos los correos.
const CODIGO = 'AB12CD'
const CORREO = 'jefa.prueba@sicedu.test'

/** Estado HTTP de un error del cliente (tiene la forma de un error de axios). */
const estadoDe = (error) => error?.response?.status

describe('normalizarPerfil', () => {
  it('arma el nombre para mostrar a partir de nombres y apellidos', () => {
    const perfil = normalizarPerfil({ correo: CORREO, nombres: 'Sara', apellidos: 'Supervisora' })
    expect(perfil.nombre_completo).toBe('Sara Supervisora')
    // Las cuentas administrativas no tienen ficha de docente.
    expect(perfil.id_docente).toBeNull()
    expect(perfil.activo).toBe(true)
  })

  it('cae al correo cuando la cuenta no tiene nombres', () => {
    expect(normalizarPerfil({ correo: CORREO }).nombre_completo).toBe(CORREO)
  })

  it('sin perfil devuelve null en vez de reventar', () => {
    expect(normalizarPerfil(null)).toBeNull()
  })
})

describe('cerrar sesión', () => {
  it('no falla nunca: el cierre real es borrar el token en el cliente', async () => {
    await expect(cerrarSesionEnServidor()).resolves.toEqual({ ok: true })
  })
})

describe('cambio de contraseña con sesión iniciada', () => {
  it('verifica un código de seis caracteres', async () => {
    await expect(verificarCodigoRecuperacion({ codigo: CODIGO })).resolves.toEqual({
      detail: 'Código correcto',
    })
  })

  it('un código de otro largo se rechaza con 400', async () => {
    await expect(verificarCodigoRecuperacion({ codigo: '123' })).rejects.toSatisfy(
      (e) => estadoDe(e) === 400,
    )
  })

  it('cambia la contraseña cuando el código y la confirmación cuadran', async () => {
    await expect(
      cambiarPasswordConCodigo({
        codigo: CODIGO,
        'contraseña_nueva': 'ClaveNueva123',
        'confirmar_contraseña_nueva': 'ClaveNueva123',
      }),
    ).resolves.toEqual({ detail: 'Contraseña actualizada' })
  })

  it('rechaza una contraseña corta y una confirmación distinta', async () => {
    await expect(
      cambiarPasswordConCodigo({
        codigo: CODIGO,
        'contraseña_nueva': 'corta1',
        'confirmar_contraseña_nueva': 'corta1',
      }),
    ).rejects.toSatisfy((e) => estadoDe(e) === 422)

    await expect(
      cambiarPasswordConCodigo({
        codigo: CODIGO,
        'contraseña_nueva': 'ClaveNueva123',
        'confirmar_contraseña_nueva': 'OtraClave456',
      }),
    ).rejects.toSatisfy((e) => estadoDe(e) === 422)
  })

  it('pedir el código sin correo lo rechaza el mock con 422', async () => {
    // OJO: contra la API real este endpoint identifica al usuario por el token y
    // no lleva cuerpo, pero el handler del mock exige un correo que la función no
    // envía. Queda documentado aquí para que no se descubra recién en dev.
    await expect(solicitarCodigoRecuperacion()).rejects.toSatisfy((e) => estadoDe(e) === 422)
  })
})

describe('recuperar contraseña sin sesión (desde el login)', () => {
  it('responde igual exista o no el correo, para no filtrar quién tiene cuenta', async () => {
    const conocido = await recuperarPassword({ correo: CORREO })
    const desconocido = await recuperarPassword({ correo: 'nadie@sicedu.test' })

    expect(conocido).toEqual(desconocido)
    expect(conocido.detail).toMatch(/Si el correo está registrado/)
  })

  it('un correo mal escrito sí se rechaza, y eso es validación de formato', async () => {
    await expect(recuperarPassword({ correo: 'sin-arroba' })).rejects.toSatisfy(
      (e) => estadoDe(e) === 422,
    )
  })

  it('restablece la contraseña con el código recibido', async () => {
    await expect(
      restablecerPassword({
        correo: CORREO,
        codigo: CODIGO,
        passwordNueva: 'ClaveNueva123',
        confirmacion: 'ClaveNueva123',
      }),
    ).resolves.toEqual({ detail: 'Contraseña actualizada' })
  })

  it('un código equivocado o caducado devuelve 400 sin decir cuál de los dos es', async () => {
    await expect(
      restablecerPassword({
        correo: CORREO,
        codigo: 'ZZ99ZZ',
        passwordNueva: 'ClaveNueva123',
        confirmacion: 'ClaveNueva123',
      }),
    ).rejects.toSatisfy((e) => estadoDe(e) === 400)
  })
})
