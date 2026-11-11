// `GET /dashboard/resultados-aprendizaje` reparte por MÓDULO de origen.
//
// El endpoint devuelve tres resultados por subprograma y cada uno viene de un
// módulo distinto:
//
//   · `global`      → el nivel colocado del REGISTRO DE VUELO;
//   · `fluidez`     → la RÚBRICA;
//   · `comprension` → la RÚBRICA.
//
// Se reparte por `resultado` (la `clave` tras el adaptador) y NO por el campo
// `fuente`, aunque el simulador lo mande: `resultado` es parte del contrato y
// tiene literales fijos en `NOMBRE_DE_RESULTADO`, mientras que `fuente` puede
// no venir del servidor real. Si un día llega un `resultado` nuevo, no se
// reparte solo a ninguna tarjeta: queda fuera hasta que se decida de quién es.

/** Las claves de cada módulo. Es el único sitio donde vive este reparto. */
export const CLAVES_RUBRICA = ['fluidez', 'comprension']
export const CLAVE_VUELO = 'global'

/** Las dimensiones de esas claves, de todos los subprogramas, en una lista. */
export function dimensionesDe(datos, claves) {
  const buscadas = new Set([claves].flat())
  return (datos?.programas ?? []).flatMap((p) =>
    (p.dimensiones ?? [])
      .filter((d) => buscadas.has(d.clave))
      .map((d) => ({ ...d, programa: p.nombre, id_programa: p.id_programa })),
  )
}

/**
 * Cuánto de lo que había que evaluar está evaluado.
 *
 * SE SUMAN RECUENTOS, NO PORCENTAJES. El porcentaje de un conjunto no es el
 * promedio de los porcentajes de sus partes, y los CU lo dicen en negrita: se
 * suman los evaluados y los esperados, y la división se hace una sola vez al
 * final. Sin esperados no hay porcentaje —`null`, no 0—: "0 de 0" no es un
 * dato, es ausencia de dato.
 */
export function completitud(dimensiones = []) {
  const evaluados = dimensiones.reduce((suma, d) => suma + (d.evaluados ?? 0), 0)
  const pendientes = dimensiones.reduce((suma, d) => suma + (d.pendientes ?? 0), 0)
  const esperadas = evaluados + pendientes
  return {
    evaluados,
    pendientes,
    esperadas,
    porcentaje: esperadas ? (evaluados / esperadas) * 100 : null,
  }
}

/**
 * Los alumnos por nivel, sumando los subprogramas, para la gráfica.
 *
 * Se agrupa POR NOMBRE DE NIVEL, que es lo que la gráfica rotula. Si dos
 * subprogramas usaran escalas distintas no se mezclan en un mismo nivel: cada
 * nombre mantiene su barra, que es lo correcto, en vez de sumar dos cosas que
 * no son la misma por caer en la misma posición de la lista.
 */
export function nivelesSumados(dimensiones = []) {
  const porNombre = new Map()
  dimensiones.forEach((d) =>
    (d.niveles ?? []).forEach(({ nombre, cantidad }) => {
      if (cantidad == null) return
      porNombre.set(nombre, (porNombre.get(nombre) ?? 0) + cantidad)
    }),
  )
  return [...porNombre].map(([nombre, cantidad]) => ({ nombre, cantidad }))
}

/** Una barra por dimensión con su porcentaje evaluado, para la Rúbrica. */
export function avancePorDimension(dimensiones = []) {
  const porNombre = new Map()
  dimensiones.forEach((d) => {
    const previo = porNombre.get(d.nombre) ?? []
    porNombre.set(d.nombre, [...previo, d])
  })
  return [...porNombre].map(([nombre, suyas]) => ({ nombre, porcentaje: completitud(suyas).porcentaje }))
}
