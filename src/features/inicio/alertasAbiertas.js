// Si el bloque de Alertas de Inicio quedó abierto o cerrado.
//
// Solo se guarda ese booleano ('true' / 'false'), nada del usuario ni de las
// alertas. Por eso sobrevive al cierre de sesión, igual que el tema
// (`CLAVES_QUE_NO_SON_DEL_USUARIO` en lib/datosLocales.js).
export const CLAVE_ALERTAS_ABIERTAS = 'sicedu.inicio.alertasAbiertas'

/** Cerrado por defecto, y también si el almacenamiento no está disponible. */
export function leerAlertasAbiertas() {
  try {
    return localStorage.getItem(CLAVE_ALERTAS_ABIERTAS) === 'true'
  } catch {
    return false
  }
}

export function guardarAlertasAbiertas(abiertas) {
  try {
    localStorage.setItem(CLAVE_ALERTAS_ABIERTAS, String(Boolean(abiertas)))
  } catch {
    // Que no se pueda recordar no impide abrirlas.
  }
}
