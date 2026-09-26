// Validaciones de formulario compartidas por las pantallas y por el mock de la API.

// Correo: sin espacios, un solo @ y al menos un punto después del @.
//
// Las clases niegan @ y espacio a propósito, y el patrón va anclado: así cada tramo
// tiene un único corte posible y el motor no retrocede. La versión corta que había
// antes repetida, /\S+@\S+\.\S+/, parece equivalente, pero al no excluir el @ el motor
// prueba todos los cortes posibles: con un texto largo sin @ el tiempo crece con el
// cuadrado de la longitud, y SonarQube lo marca como security hotspot (S5852, ReDoS).
//
// De paso valida mejor: la anterior, al no estar anclada, daba por bueno "juan
// perez@colegio.pe" porque le bastaba con encontrar una parte válida dentro del texto.
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** ¿El valor tiene forma de correo? Recorta los espacios de los extremos antes de mirar. */
export const esCorreoValido = (valor) => CORREO.test(String(valor ?? '').trim())
