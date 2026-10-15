// Dominio de autenticación. Es lo ÚNICO que el backend tiene publicado hoy
// (APIS_BACKEND.md), así que va contra la API real aunque el negocio siga
// resolviéndose en mock: de eso se encarga `forzarReal`.
import { api, authContraApiReal, resolver } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'
import { obtenerToken } from '../../store/sessionStore'

/**
 * Perfil normalizado del usuario.
 *
 * El backend devuelve `nombres` y `apellidos` por separado, y `id_docente` en
 * `null` para las cuentas no docentes (Jefa_Profesores, Directivos). La interfaz
 * necesita un nombre para mostrar y no debe recomponerlo en cada pantalla, así
 * que se resuelve una sola vez aquí.
 */
export function normalizarPerfil(perfil) {
  if (!perfil) return null
  const nombres = perfil.nombres ?? ''
  const apellidos = perfil.apellidos ?? ''
  return {
    ...perfil,
    nombres,
    apellidos,
    nombre_completo: [nombres, apellidos].filter(Boolean).join(' ').trim() || perfil.correo,
    // Puede ser null: comprobarlo antes de usarlo o se rompe la vista al entrar
    // con una cuenta administrativa.
    id_docente: perfil.id_docente ?? null,
    activo: perfil.activo ?? true,
  }
}

/** POST /login → { access_token, token_type }. Un 401 significa credenciales inválidas. */
export function iniciarSesion({ correo, password }) {
  return resolver({
    forzarReal: authContraApiReal,
    mock: () => handlers.auth.login({ correo, password }),
    real: () => api.post(ENDPOINTS.auth.login, { correo, password }),
  })
}

/** GET /me → perfil del usuario autenticado, ya normalizado. */
export async function obtenerPerfil() {
  const perfil = await resolver({
    forzarReal: authContraApiReal,
    mock: () => handlers.auth.me(obtenerToken()),
    real: () => api.get(ENDPOINTS.auth.me),
  })
  return normalizarPerfil(perfil)
}

/**
 * POST /logout. Cierra la sesión DE VERDAD en el servidor (el token muere al
 * instante) y, si había una actividad abierta, la finaliza como "Forzado por
 * cierre de sesión".
 *
 * Nunca lanza. Devuelve `{ ok: false, sinRespuesta: true }` cuando la petición
 * no llegó al servidor (sin conexión): en ese caso NADA se cerró allí, y quien
 * llama tiene que dejar el cierre de la actividad pendiente de sincronizar.
 */
export function cerrarSesionEnServidor() {
  return resolver({
    forzarReal: authContraApiReal,
    mock: () => handlers.auth.logout(),
    real: () => api.post(ENDPOINTS.auth.logout),
  })
    .then((respuesta) => ({ ...respuesta, ok: true }))
    .catch((error) => ({ ok: false, sinRespuesta: !error?.response }))
}

export function solicitarCodigoRecuperacion() {
  return resolver({
    forzarReal: authContraApiReal,
    mock: () => handlers.auth.passwordCodigo(),
    real: () => api.post(ENDPOINTS.auth.passwordCodigo),
  })
}

export function verificarCodigoRecuperacion({ codigo }) {
  return resolver({
    forzarReal: authContraApiReal,
    mock: () => handlers.auth.verificarCodigo({ codigo }),
    real: () => api.post(ENDPOINTS.auth.passwordVerificarCodigo, { codigo }),
  })
}

export function cambiarPasswordConCodigo({ codigo, contraseña_nueva, confirmar_contraseña_nueva }) {
  return resolver({
    forzarReal: authContraApiReal,
    mock: () => handlers.auth.cambiarPassword({ codigo, contraseña_nueva, confirmar_contraseña_nueva }),
    real: () => api.post(ENDPOINTS.auth.passwordCambiar, { codigo, contraseña_nueva, confirmar_contraseña_nueva }),
  })
}

// ── Recuperar contraseña SIN sesión (desde el login) ────────────────────────
//
// Son públicos: no llevan token. Van siempre contra la API real, porque su
// única razón de existir es que el usuario no puede entrar.

/**
 * `POST /password/recuperar` → envía un código de 6 caracteres al correo.
 *
 * Responde 200 SIEMPRE, exista el correo o no. Es deliberado: si distinguiera,
 * cualquiera podría probar direcciones para averiguar quién tiene cuenta. La
 * interfaz no debe afirmar que el correo existe.
 */
export const recuperarPassword = ({ correo }) =>
  resolver({
    mock: () => handlers.auth.recuperarPassword({ correo }),
    real: () => api.post(ENDPOINTS.auth.passwordRecuperar, { correo }),
    forzarReal: authContraApiReal,
  })

/**
 * `POST /password/restablecer` → cambia la contraseña con el código recibido.
 *
 * El código es de un solo uso y vale 10 minutos. Un 400 puede significar código
 * incorrecto, caducado, ya usado o correo inexistente: el backend no los
 * distingue a propósito, así que se muestra su mensaje tal cual.
 */
export const restablecerPassword = ({ correo, codigo, passwordNueva, confirmacion }) =>
  resolver({
    mock: () => handlers.auth.restablecerPassword({ correo, codigo }),
    real: () =>
      api.post(ENDPOINTS.auth.passwordRestablecer, {
        correo,
        codigo,
        'contraseña_nueva': passwordNueva,
        'confirmar_contraseña_nueva': confirmacion,
      }),
    forzarReal: authContraApiReal,
  })

/**
 * `POST /password/verificar-codigo` — comprueba el PIN SIN gastarlo.
 *
 * CU006 exige un proceso estricto de DOS PASOS: primero se valida el PIN y,
 * solo si es correcto, aparece un formulario nuevo para la contraseña. Antes se
 * pedían las dos cosas a la vez, así que un PIN equivocado se descubría después
 * de escribir y repetir la contraseña entera.
 *
 * Importante: este endpoint NO consume el PIN. El que lo gasta es
 * `/password/restablecer`.
 */
export const verificarCodigoPublico = ({ correo, codigo }) =>
  resolver({
    mock: () => handlers.auth.verificarCodigoPublico({ correo, codigo }),
    real: () => api.post(ENDPOINTS.auth.passwordVerificarCodigoPublico, { correo, codigo }),
    forzarReal: authContraApiReal,
  })

/**
 * `POST /password/primer-ingreso` — establece la contraseña definitiva.
 *
 * CU001: toda cuenta nueva nace con una contraseña temporal de 48 horas y la
 * marca de "cambio obligatorio". Con ella, `/login` responde 403
 * `cambio_contrasena_requerido` y no deja entrar a nada.
 *
 * LA RESPUESTA ES LA MISMA QUE LA DE `/login`, token incluido: al terminar, el
 * usuario queda dentro con su sesión de 8 horas. No hay que volver a pedirle
 * las credenciales.
 */
export const establecerPasswordPrimerIngreso = ({ correo, temporal, passwordNueva, confirmacion }) =>
  resolver({
    mock: () => handlers.auth.primerIngreso({ correo, temporal, passwordNueva }),
    real: () =>
      api.post(ENDPOINTS.auth.passwordPrimerIngreso, {
        correo,
        'contraseña_temporal': temporal,
        'contraseña_nueva': passwordNueva,
        'confirmar_contraseña_nueva': confirmacion,
      }),
    forzarReal: authContraApiReal,
  })
