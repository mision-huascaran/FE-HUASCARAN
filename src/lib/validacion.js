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
