// Los grados que ofrece un colegio, con su día de clase y sus secciones (CU013).
//
// Vive aquí y no en la pantalla porque lo necesitan los dos lados: el
// formulario, para saber a qué grado le falta el día, y el recurso, para armar
// el cuerpo que espera el backend.
//
// EL CONTRATO CAMBIÓ DOS VECES DE FORMA:
//
//   · `grados` era `[3, 4]` y pasó a `[{id_grado: 3, dia_clase: 2}, …]`, con
//     `dia_clase` obligatorio (1 = lunes a 5 = viernes). Mandar la lista de
//     números responde 422. Se aceptan las dos formas al LEER porque los
//     colegios antiguos todavía traen la vieja, pero al ESCRIBIR sale la nueva.
//   · Y con T3 cada grado tiene SECCIONES propias. Antes la sección era un
//     atributo del colegio —"Única"— que el alumno heredaba; `colegio.seccion`
//     desapareció del contrato.

/** Lunes a viernes, tal como los numera el backend. */
export const DIAS_DE_CLASE = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
]

export const nombreDelDia = (dia) => DIAS_DE_CLASE.find((d) => d.value === String(dia))?.label ?? null

/**
 * Dos secciones son la misma si solo se diferencian en mayúsculas o espacios.
 *
 * Es la regla del backend —"A", "a" y " a " son la misma— y conviene aplicarla
 * también aquí: si no, el formulario deja añadir "a" junto a "A" y el servidor
 * devuelve una sola, con la sensación de que se perdió algo.
 */
export const claveDeSeccion = (nombre) => String(nombre ?? '').trim().toLocaleLowerCase('es')

/** Las secciones de un grado, normalizadas a `[{id, nombre}]`. */
export function comoSecciones(valor) {
  if (!Array.isArray(valor)) return []
  const vistas = new Set()
  const salida = []
  for (const s of valor) {
    const nombre = (typeof s === 'object' && s !== null ? s.nombre : s) ?? ''
    const limpio = String(nombre).trim()
    const clave = claveDeSeccion(limpio)
    if (!limpio || vistas.has(clave)) continue
    vistas.add(clave)
    salida.push({ id: typeof s === 'object' && s !== null ? (s.id ?? s.id_seccion ?? null) : null, nombre: limpio })
  }
  return salida
}

/** La lista normalizada a `[{id_grado, nombre, dia_clase, secciones}]`, venga como venga. */
export function comoGradosConDia(valor) {
  if (!Array.isArray(valor)) return []
  return valor.map((g) =>
    g != null && typeof g === 'object'
      ? {
          id_grado: Number(g.id_grado ?? g.id),
          nombre: g.nombre,
          dia_clase: g.dia_clase ?? null,
          secciones: comoSecciones(g.secciones),
        }
      : { id_grado: Number(g), dia_clase: null, secciones: [] },
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
