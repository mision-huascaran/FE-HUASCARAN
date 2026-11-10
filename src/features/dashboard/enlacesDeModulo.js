// A qué módulo lleva cada tarjeta del Dashboard, y con qué filtros puestos.
//
// EL TÍTULO Y LA RUTA SALEN DE LA MATRIZ DE PERMISOS, no de constantes
// escritas aquí. Así la tarjeta se llama igual que la entrada del menú —que es
// lo que el usuario acaba de leer para llegar— y si mañana el módulo cambia de
// nombre o de ruta, cambia en un solo sitio. `puedeEntrar` decide además si la
// tarjeta ofrece el enlace: el Directivo no tiene estos cuatro módulos
// (`[DIRECTIVO]: null` en la matriz), y mandarlo a una ruta que su guarda le va
// a negar sería ofrecerle una puerta tapiada.
import { MATRIZ, puedeEntrar } from '../../auth/permisos'

/** Las cuatro secciones de la matriz que el Dashboard resume, en su orden. */
export const MODULOS = ['asistencia', 'lectura', 'rubrica', 'vuelo']

/** Cómo se llama el módulo en el menú. Es también el título de su tarjeta. */
export const tituloDeModulo = (seccion) => MATRIZ[seccion]?.etiqueta ?? seccion

/**
 * Los filtros del dashboard traducidos a los parámetros que leen los módulos
 * (`useFiltrosDeGrupo`: `colegio`, `grado`, `seccion`, `subprograma`, `mes`).
 *
 * EL COLEGIO SOLO VIAJA SI ES UNO. Los módulos del aula trabajan sobre UN
 * grupo; con "Todos los colegios" o con varios elegidos, cualquier colegio que
 * pusiéramos aquí sería uno que la persona no eligió. En ese caso se va sin
 * parámetro y el módulo abre con lo último que esa persona consultó, que es su
 * comportamiento normal (D105).
 *
 * El año escolar y el periodo académico NO se mandan a propósito: los módulos
 * no los reciben por URL, los resuelven ellos con el calendario de su grupo.
 */
export function parametrosDeModulo(filtros = {}, extra = {}) {
  const params = new URLSearchParams()
  const { idColegios = [], todosLosColegios } = filtros
  if (!todosLosColegios && idColegios.length === 1) params.set('colegio', String(idColegios[0]))

  Object.entries(extra).forEach(([clave, valor]) => {
    if (valor != null && valor !== '') params.set(clave, String(valor))
  })

  const texto = params.toString()
  return texto ? `?${texto}` : ''
}

/**
 * El enlace de una tarjeta, o `null` si este rol no entra a ese módulo.
 *
 * @param extra filtros adicionales del punto que se pulsó en la gráfica
 *   (`{ mes: 5 }`, `{ subprograma: 2 }`), para que el módulo abra justo ahí.
 */
export function enlaceDeModulo(seccion, { idRol, filtros, extra } = {}) {
  if (!puedeEntrar(seccion, idRol)) return null
  const ruta = MATRIZ[seccion]?.ruta
  if (!ruta) return null
  return {
    a: `${ruta}${parametrosDeModulo(filtros, extra)}`,
    texto: `Ver en ${tituloDeModulo(seccion)}`,
  }
}
