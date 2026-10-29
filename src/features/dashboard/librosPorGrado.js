// Los libros de UN grado del detalle de un colegio (CU034, paso 6).
//
// El backend manda los meses del colegio y, por grado, solo sus alumnos con
// sus meses (`GradoLibros` no trae meses propios). Al filtrar por grado, la
// serie mensual se suma aquí desde los alumnos, con la misma regla que el
// resto del bloque: SIN INFORMACIÓN NO ES CERO. Un mes en el que a algún alumno
// le falta el dato no puede salir como un total confirmado.

const mismoMes = (a, b) => a.mes === b.mes && a.anio === b.anio

/**
 * El estado de un mes del grado a partir de los de sus alumnos:
 *   · futuro, si el mes todavía no llegó;
 *   · sin_informacion (total null), si ningún alumno tiene dato;
 *   · incompleto, si a alguno le falta o ya venía incompleto;
 *   · completo, si todos lo tienen confirmado.
 */
function sumarMes(mes, delMes) {
  const base = { ...mes, en_curso: delMes.some((m) => m.en_curso) || Boolean(mes.en_curso) }
  if (mes.estado === 'futuro') return { ...base, estado: 'futuro', total: null, cantidad: null }
  const conDato = delMes.filter((m) => m.total != null)
  if (!conDato.length) return { ...base, estado: 'sin_informacion', total: null, cantidad: null }
  const total = conDato.reduce((suma, m) => suma + m.total, 0)
  const incompleto = conDato.length < delMes.length || delMes.some((m) => m.estado === 'incompleto')
  return { ...base, estado: incompleto ? 'incompleto' : 'completo', total, cantidad: total }
}

/**
 * Los meses de un grado, con la misma forma que los del colegio (ya
 * adaptados: `nombre`, `cantidad`, `estado`). `meses` son los del colegio y
 * dan el calendario; los valores salen de los alumnos del grado.
 */
export function mesesDeGrado(grado, meses = []) {
  const alumnos = grado?.alumnos ?? []
  if (!alumnos.length) {
    return meses.map((mes) =>
      mes.estado === 'futuro' ? { ...mes } : { ...mes, estado: 'sin_informacion', total: null, cantidad: null },
    )
  }
  return meses.map((mes) => {
    const delMes = alumnos.map(
      (alumno) => (alumno.meses ?? []).find((m) => mismoMes(m, mes)) ?? { estado: 'sin_informacion', total: null },
    )
    return sumarMes(mes, delMes)
  })
}

/** El resumen de la tarjeta para un grado: sus propios totales del backend. */
export const resumenDeGrado = (grado) =>
  grado && {
    total: grado.total,
    estado: grado.estado,
    provisional: grado.provisional,
    alumnos: grado.alumnos_incluidos,
    alumnos_incluidos: grado.alumnos_incluidos,
    promedio: grado.promedio,
  }
