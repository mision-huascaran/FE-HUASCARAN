// Validaciones de formulario compartidas por las pantallas y por el mock de la API.

/**
 * ¿El valor tiene forma de correo? Recorta los espacios de los extremos antes de mirar.
 *
 * Se comprueba partiendo la cadena en vez de con un patrón completo, y la razón
 * es concreta: cualquier expresión del tipo `a+@a+\.a+` deja que los tramos
 * compitan por los mismos caracteres, porque la clase que acepta el dominio
 * acepta también el punto. Con un texto largo y sin punto el motor prueba todos
 * los cortes y el tiempo crece con el cuadrado de la longitud — es lo que
 * SonarQube marca como ReDoS (S5852), y lo seguía marcando con
 * `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, más estricta pero con el mismo solape.
 *
 * `split` recorre la cadena una sola vez, así que el coste es lineal y no hay
 * retroceso posible. La única expresión que queda no lleva cuantificador.
 */
export const esCorreoValido = (valor) => {
  const correo = String(valor ?? '').trim()
  // Un correo no lleva espacios: esto descarta de paso "juan perez@colegio.pe",
  // que una expresión sin anclar daba por bueno.
  if (!correo || /\s/.test(correo)) return false

  const partes = correo.split('@')
  if (partes.length !== 2) return false

  const [local, dominio] = partes
  if (!local) return false

  // El dominio necesita al menos un punto, y ninguna etiqueta puede ir vacía:
  // así caen "sin@punto", "a@.pe" y "a@pe.".
  const etiquetas = dominio.split('.')
  return etiquetas.length >= 2 && etiquetas.every((etiqueta) => etiqueta.length > 0)
}

export default esCorreoValido

// ── Política de contraseña (CU006) ──────────────────────────────────────────
//
// Antes bastaba con 8 caracteres de letras y números. CU006 exige además
// mayúscula, minúscula, número y carácter especial, y el formulario debe decir
// QUÉ requisitos faltan, no solo que la contraseña no vale.

/** Un carácter especial es cualquiera que no sea letra ni número, en cualquier idioma. */
const ESPECIAL = /[^\p{L}\p{N}]/u

export const REQUISITOS_PASSWORD = [
  { id: 'longitud', texto: 'Al menos 8 caracteres', cumple: (v) => v.length >= 8 },
  { id: 'mayuscula', texto: 'Una letra mayúscula', cumple: (v) => v !== v.toLowerCase() },
  { id: 'minuscula', texto: 'Una letra minúscula', cumple: (v) => v !== v.toUpperCase() },
  { id: 'numero', texto: 'Un número', cumple: (v) => /\d/.test(v) },
  { id: 'especial', texto: 'Un carácter especial', cumple: (v) => ESPECIAL.test(v) },
]

/**
 * Los requisitos que la contraseña NO cumple todavía.
 *
 * Se compara con `toLowerCase`/`toUpperCase` en vez de con `[A-Z]` para que
 * "Ñ" o "Á" cuenten como mayúscula: hay apellidos y palabras del quechua que
 * las llevan, y rechazarlas sería arbitrario.
 */
export const requisitosIncumplidos = (valor) => {
  const password = String(valor ?? '')
  return REQUISITOS_PASSWORD.filter((requisito) => !requisito.cumple(password))
}

export const esPasswordValida = (valor) => requisitosIncumplidos(valor).length === 0

/** CU005: el PIN son exactamente 6 dígitos numéricos. */
export const esPinValido = (valor) => /^\d{6}$/.test(String(valor ?? ''))
