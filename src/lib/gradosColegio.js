// Los grados que ofrece un colegio, con su día de clase (CU013).
//
// Vive aquí y no en la pantalla porque lo necesitan los dos lados: el
// formulario, para saber a qué grado le falta el día, y el recurso, para armar
// el cuerpo que espera el backend.
//
// EL CONTRATO CAMBIÓ DE FORMA: `grados` era `[3, 4]` y ahora es
// `[{id_grado: 3, dia_clase: 2}, …]`, con `dia_clase` obligatorio (1 = lunes a
// 5 = viernes). Mandar la lista de números responde 422. Se aceptan las dos
// formas al LEER porque los colegios antiguos todavía traen la vieja, pero al
// ESCRIBIR siempre sale la nueva.

/** Lunes a viernes, tal como los numera el backend. */
export const DIAS_DE_CLASE = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
]

export const nombreDelDia = (dia) => DIAS_DE_CLASE.find((d) => d.value === String(dia))?.label ?? null

/** La lista normalizada a `[{id_grado, dia_clase}]`, venga como venga. */
export function comoGradosConDia(valor) {
  if (!Array.isArray(valor)) return []
  return valor.map((g) =>
    g != null && typeof g === 'object'
      ? { id_grado: Number(g.id_grado ?? g.id), dia_clase: g.dia_clase ?? null }
      : { id_grado: Number(g), dia_clase: null },
  )
}

/**
 * Los grados a los que todavía les falta el día.
 *
 * Les pasa a los colegios creados antes de que existiera el campo: llegan con
 * `dia_clase: null`. No se les pone un lunes por defecto —sería inventarse el
 * horario de un colegio real—, se exige decidirlo al editarlos.
 */
export const sinDiaDeClase = (valor) => comoGradosConDia(valor).filter((g) => !g.dia_clase)
