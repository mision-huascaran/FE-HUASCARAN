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

/** Ruta de aterrizaje tras el login, por rol (P1). */
export const INICIO_POR_ROL = {
  [ROLES.PROFESOR]: '/inicio',
  [ROLES.DOCENTE]: '/inicio',
  [ROLES.JEFA]: '/dashboard',
  [ROLES.SUPERVISOR]: '/dashboard',
  [ROLES.DIRECTIVOS]: '/panel-ejecutivo',
  [ROLES.DIRECTIVO]: '/panel-ejecutivo',
}

export function rutaInicioDe(idRol) {
  return INICIO_POR_ROL[idRol] ?? '/login'
}

/** Los Directivos no capturan datos: solo lectura y vistas ejecutivas (§5). */
export function esSoloLectura(idRol) {
  return idRol === ROLES.DIRECTIVOS || idRol === ROLES.DIRECTIVO
}
