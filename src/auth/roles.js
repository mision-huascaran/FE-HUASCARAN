// Catálogo `rol` de la base de datos (§5). Los ids son los del backend.
export const ROLES = {
  PROFESOR: 1,
  DOCENTE: 1,
  JEFA: 2,
  SUPERVISOR: 2,
  DIRECTIVOS: 3,
  DIRECTIVO: 3,
}

export const NOMBRE_ROL = {
  [ROLES.PROFESOR]: 'Docente',
  [ROLES.DOCENTE]: 'Docente',
  [ROLES.JEFA]: 'Supervisor',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.DIRECTIVOS]: 'Directivo',
  [ROLES.DIRECTIVO]: 'Directivo',
}

/**
 * Ruta de aterrizaje tras el login.
 *
 * El Docente y el Supervisor aterrizan en `/inicio`, con un contenido distinto
 * cada uno (al Docente sus asignaciones, al Supervisor métricas por docente).
 *
 * EL DIRECTIVO ATERRIZA EN `/dashboard` y ya no tiene Inicio. Su Inicio eran
 * tres indicadores institucionales que el Dashboard cubre mejor y con filtros;
 * tenerlos en dos pantallas obligaba a mantener dos veces el mismo número y a
 * explicar por qué no siempre coincidían. La sección `inicio` es
 * `[DIRECTIVO]: null` en la matriz de permisos, así que tampoco le aparece en
 * el menú ni le deja entrar a mano.
 */
export const INICIO_POR_ROL = {
  [ROLES.PROFESOR]: '/inicio',
  [ROLES.DOCENTE]: '/inicio',
  [ROLES.JEFA]: '/inicio',
  [ROLES.SUPERVISOR]: '/inicio',
  [ROLES.DIRECTIVOS]: '/dashboard',
  [ROLES.DIRECTIVO]: '/dashboard',
}

export function rutaInicioDe(idRol) {
  return INICIO_POR_ROL[idRol] ?? '/login'
}

/** Los Directivos no capturan datos: solo lectura y vistas ejecutivas (§5). */
export function esSoloLectura(idRol) {
  return idRol === ROLES.DIRECTIVOS || idRol === ROLES.DIRECTIVO
}
