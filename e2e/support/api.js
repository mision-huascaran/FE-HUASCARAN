// Llamadas a la API hechas desde Node, fuera del navegador: no quedan en el
// trace ni en el video. Solo para limpieza de datos de prueba, nunca para
// verificar lo que una prueba tiene que comprobar en la interfaz.
import { cuentaDe } from './cuentas.js'

const api = (ruta) => `${process.env.BASE_URL.replace(/\/$/, '')}/api${ruta}`

/** Abre una sesión de la cuenta E2E del rol y devuelve su token. */
async function abrirSesion(rol) {
  const { usuario, password } = cuentaDe(rol)
  const respuesta = await fetch(api('/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: usuario, password }),
  })
  if (!respuesta.ok) throw new Error(`No se pudo abrir sesión como ${rol} para limpiar (HTTP ${respuesta.status})`)
  return (await respuesta.json()).access_token
}

/**
 * Inactiva una cuenta como Supervisora. Es idempotente en el backend: si ya
 * estaba inactiva responde igual y no deja auditoría.
 */
export async function inactivarUsuario(idUsuario) {
  const token = await abrirSesion('supervisor')
  const cabeceras = { Authorization: `Bearer ${token}` }
  try {
    const respuesta = await fetch(api(`/usuarios/${idUsuario}/desactivar`), { method: 'PATCH', headers: cabeceras })
    if (!respuesta.ok) throw new Error(`PATCH /usuarios/${idUsuario}/desactivar respondió ${respuesta.status}`)
  } finally {
    await fetch(api('/logout'), { method: 'POST', headers: cabeceras }).catch(() => null)
  }
}
