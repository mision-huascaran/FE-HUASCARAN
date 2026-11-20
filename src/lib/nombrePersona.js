// Nombres de personas: qué se acepta y cómo se exporta sin riesgo.
//
// LA REGLA ESTÁ DOCUMENTADA EN EL BACKEND: BCK-HUASCARAN `app/core/nombre_persona.py`
// (`motivo_nombre_invalido` y `parece_formula`). Este archivo es la misma regla
// para el formulario de Alumnos; la importación de la nómina la aplica en el
// backend. Si cambias una, cambia la otra: las dos prueban la misma tabla de
// casos (`__tests__/nombrePersona.test.js` y `tests/test_nombre_persona.py`).
//
// El POST y el PATCH de /alumnos todavía solo exigen que nombres y apellidos no
// estén vacíos: en el formulario la regla la pone este archivo.

/** Largo máximo de nombres y de apellidos, por separado. */
export const LARGO_MAXIMO_NOMBRE = 60

/**
 * Letras de cualquier alfabeto (con tildes, ñ, ü…), números, espacios,
 * apóstrofo (' o ’) y guion. Ningún símbolo como < > = ; { } $ @ + , ( )
 */
const CARACTERES_DE_NOMBRE = /^[\p{L}\p{M}\p{Nd}' ’-]+$/u
const EMPIEZA_O_TERMINA_CON_SIGNO = /^['’-]|['’-]$/u

/**
 * Por qué `valor` no sirve como nombre o apellido, o `null` si sirve. Vacío
 * devuelve `null`: lo obligatorio lo decide el formulario.
 */
export function motivoNombreInvalido(valor) {
  const texto = String(valor ?? '')
  const limpio = texto.trim()
  if (texto.length > 0 && limpio.length === 0) return 'No puede tener solo espacios.'
  if (limpio.length === 0) return null
  if (limpio.length > LARGO_MAXIMO_NOMBRE) {
    return `Tiene ${limpio.length} caracteres; el máximo es ${LARGO_MAXIMO_NOMBRE}.`
  }
  if (!CARACTERES_DE_NOMBRE.test(limpio)) return 'Usa solo letras, números, espacios, apóstrofo y guion.'
  if (EMPIEZA_O_TERMINA_CON_SIGNO.test(limpio)) return 'No puede empezar ni terminar con un apóstrofo o un guion.'
  return null
}

/**
 * Lo que Excel (o LibreOffice) tomaría como fórmula al abrir el archivo: un texto
 * que empieza con =, +, - o @ (y tabulador, retorno o salto de línea, que algunos
 * programas descartan antes de mirar). Se le antepone un apóstrofo para que quede
 * como texto (OWASP, CSV/Formula Injection). Los números y lo demás pasan igual.
 * Son los mismos signos con los que la importación rechaza una celda
 * (`parece_formula` del backend).
 */
export function neutralizarCelda(valor) {
  if (typeof valor !== 'string') return valor
  return /^[=+\-@\t\r\n]/.test(valor) ? `'${valor}` : valor
}
