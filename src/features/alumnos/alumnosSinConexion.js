// Los alumnos que hay en este equipo para trabajar sin conexión (CU014, D61).
//
// La base es la precarga de IndexedDB. Pero la precarga se baja al entrar a
// Inicio o al iniciar la actividad, y una vieja (de antes de bajar también a
// los inactivos, por ejemplo) se queda corta: el Docente veía un alumno con
// conexión y, al cortarse la red sin recargar, la tabla quedaba en "Sin
// registros". Se le suma lo que esta sesión ya trajo del servidor en Alumnos:
// lo que se acaba de ver con conexión se sigue viendo sin ella.

const idDeAlumno = (alumno) => alumno?.id_alumno ?? alumno?.id

/** Una lista sin repetidos; ante el mismo alumno, gana el de `vistos`. */
export function unirAlumnosLocales(precargados = [], vistos = []) {
  const porId = new Map()
  ;[...precargados, ...vistos].forEach((alumno) => {
    const id = idDeAlumno(alumno)
    if (id != null) porId.set(String(id), alumno)
  })
  return [...porId.values()]
}

/** Las filas que las consultas de Alumnos CON CONEXIÓN dejaron en la caché. */
export const vistosEnLinea = (queryClient) =>
  queryClient
    .getQueriesData({ queryKey: ['alumnos', 'mantenimiento'] })
    // La clave es ['alumnos', 'mantenimiento', filtros, enLinea, hayPrecarga].
    .filter(([clave, datos]) => clave[3] === true && Array.isArray(datos))
    .flatMap(([, datos]) => datos)

/** Todos los alumnos disponibles sin conexión. */
export const alumnosSinConexion = (queryClient, precarga) =>
  unirAlumnosLocales(precarga?.alumnos ?? [], vistosEnLinea(queryClient))

/** Un alumno de la copia local, para abrir su detalle sin conexión. */
export const buscarAlumnoLocal = (queryClient, precarga, id) =>
  alumnosSinConexion(queryClient, precarga).find((alumno) => String(idDeAlumno(alumno)) === String(id)) ?? null
