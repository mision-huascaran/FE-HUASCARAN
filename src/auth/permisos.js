// Matriz de permisos del sprint de cierre (04/10/2026).
//
// El documento la declara **fuente única**: el backend la implementa como
// guardias y el frontend la usa para menú, botones y rutas. Si una regla de
// permisos no sale de aquí, está mal puesta.
//
// Ocultar un botón NO es seguridad (RNF-004): cada endpoint revalida rol y
// alcance en el servidor. Esto solo evita ofrecer acciones que acabarían en 403.
import { ROLES } from './roles'

/** Acciones de la plantilla de mantenimiento. */
export const ACCION = {
  NUEVO: 'N',
  EDITAR: 'E',
  VER: 'V',
  INACTIVAR: 'I',
  AUDITORIA: 'A',
}

/** Conectividad de cada sección (estrategia offline del documento). */
export const CONECTIVIDAD = {
  ESCRITURA_OFFLINE: 'escritura-offline',
  LECTURA_CACHE: 'lectura-cache',
  SOLO_ONLINE: 'solo-online',
}

const { DOCENTE, SUPERVISOR, DIRECTIVO } = ROLES
const { NUEVO, EDITAR, VER, INACTIVAR, AUDITORIA } = ACCION
const TODO = [NUEVO, EDITAR, VER, INACTIVAR, AUDITORIA]

/**
 * Qué puede hacer cada rol en cada sección, y con qué alcance.
 *
 * `alcance`:
 *   'asignado' — solo sus colegios y secciones (el servidor lo filtra)
 *   'todos'    — sin restricción
 *   'propio'   — solo sus propios registros
 */
export const MATRIZ = {
  inicio: {
    ruta: '/inicio',
    etiqueta: 'Inicio',
    conectividad: CONECTIVIDAD.LECTURA_CACHE,
    [DOCENTE]: { acciones: [VER], alcance: 'asignado' },
    [SUPERVISOR]: { acciones: [VER], alcance: 'todos' },
    [DIRECTIVO]: { acciones: [VER], alcance: 'todos' },
  },
  alumnos: {
    ruta: '/alumnos',
    etiqueta: 'Alumnos',
    // D8: crear y editar alumnos exige conexión, para no generar ids en conflicto.
    conectividad: CONECTIVIDAD.LECTURA_CACHE,
    [DOCENTE]: { acciones: TODO, alcance: 'asignado' },
    // CU014 y RF-046 le dan al Supervisor la sección Alumnos con entrada propia
    // en el menú (antes solo se llegaba por Usuarios → pestaña Alumnos, D09).
    [SUPERVISOR]: { acciones: TODO, alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  usuarios: {
    ruta: '/usuarios',
    etiqueta: 'Usuarios',
    conectividad: CONECTIVIDAD.SOLO_ONLINE,
    [DOCENTE]: null,
    // D2: el Supervisor crea a TODOS los roles. El Directivo ya no gestiona cuentas.
    [SUPERVISOR]: { acciones: TODO, alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  colegios: {
    ruta: '/colegios',
    etiqueta: 'Colegios',
    conectividad: CONECTIVIDAD.SOLO_ONLINE,
    [DOCENTE]: null,
    [SUPERVISOR]: { acciones: TODO, alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  /**
   * LOS CUATRO MÓDULOS OPERATIVOS ESTÁN EN EL MENÚ DE LOS DOS ROLES.
   *
   * El Docente ya los tenía: CU022 dice "El Docente accede a la sección de
   * Asistencias DESDE EL SIDEBAR".
   *
   * El Supervisor NO, y eso era D49. Se había decidido que entrara solo por
   * los atajos de Seguimiento (CU021), leyendo CU022 como que su acceso era
   * "derivado desde el CU021". Pero la matriz de permisos del backend
   * (API.md) y los casos de uso actualizados coinciden en que el Supervisor
   * CONSULTA los cuatro módulos académicos en solo lectura, y un acceso que
   * existe pero no está en el menú es un acceso que nadie encuentra.
   *
   * Sigue sin poder escribir: sus acciones son VER y AUDITORIA, y el servidor
   * le responde 403 en cualquier escritura.
   */
  asistencia: {
    ruta: '/asistencia',
    etiqueta: 'Asistencias',
    conectividad: CONECTIVIDAD.ESCRITURA_OFFLINE,
    [DOCENTE]: { acciones: [EDITAR, VER, AUDITORIA], alcance: 'asignado', creaGrilla: true },
    // T22: el Supervisor ve la asistencia de todos los docentes, sin editarla.
    [SUPERVISOR]: { acciones: [VER, AUDITORIA], alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  rubrica: {
    ruta: '/rubrica',
    etiqueta: 'Rúbrica',
    conectividad: CONECTIVIDAD.ESCRITURA_OFFLINE,
    [DOCENTE]: { acciones: [EDITAR, VER, AUDITORIA], alcance: 'asignado', creaGrilla: true },
    // D3: el Supervisor mira, no edita ni crea grillas. Llega desde los atajos
    // de solo lectura de Seguimiento (CU021); RF-046 no le da entrada en el
    // menú (D09).
    [SUPERVISOR]: { acciones: [VER, AUDITORIA], alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  lectura: {
    ruta: '/seguimiento-lectura',
    etiqueta: 'Seguimiento de Lectura',
    conectividad: CONECTIVIDAD.ESCRITURA_OFFLINE,
    [DOCENTE]: { acciones: [EDITAR, VER, AUDITORIA], alcance: 'asignado', creaGrilla: true },
    [SUPERVISOR]: { acciones: [VER, AUDITORIA], alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  vuelo: {
    ruta: '/registro-vuelo',
    etiqueta: 'Registro de Vuelo',
    conectividad: CONECTIVIDAD.ESCRITURA_OFFLINE,
    [DOCENTE]: { acciones: [EDITAR, VER, AUDITORIA], alcance: 'asignado', creaGrilla: true },
    [SUPERVISOR]: { acciones: [VER, AUDITORIA], alcance: 'todos' },
    [DIRECTIVO]: null,
  },
  /**
   * CU017 a CU019 — SOLO del Docente, y solo sus propias actividades.
   *
   * El Supervisor ya no entra aquí: para vigilar a su equipo tiene Seguimiento
   * (CU020, CU021), que es otra pantalla con otros datos. Antes compartían
   * módulo y el Supervisor veía el listado con un filtro por docente.
   *
   * Es estrictamente EN LÍNEA: los CU prohíben responder desde la memoria
   * local, para que nadie confunda un histórico viejo con el estado real.
   */
  sesiones: {
    ruta: '/sesiones',
    etiqueta: 'Sesiones',
    conectividad: CONECTIVIDAD.SOLO_ONLINE,
    [DOCENTE]: { acciones: [VER], alcance: 'propio' },
    [SUPERVISOR]: null,
    [DIRECTIVO]: null,
  },
  /**
   * CU020 y CU021 — Seguimiento del equipo, exclusivo del Supervisor.
   *
   * Solo lectura y solo en línea: el historial de auditoría no se descarga al
   * dispositivo, para no llenar la memoria del navegador con datos masivos.
   */
  seguimiento: {
    ruta: '/seguimiento',
    etiqueta: 'Seguimiento',
    conectividad: CONECTIVIDAD.SOLO_ONLINE,
    [DOCENTE]: null,
    [SUPERVISOR]: { acciones: [VER], alcance: 'todos' },
    [DIRECTIVO]: null,
  },
}

/** Lo que un rol puede hacer en una sección, o `null` si no entra. */
export const permisoDe = (seccion, idRol) => MATRIZ[seccion]?.[Number(idRol)] ?? null

export const puedeEntrar = (seccion, idRol) => Boolean(permisoDe(seccion, idRol))

export const puede = (seccion, idRol, accion) =>
  Boolean(permisoDe(seccion, idRol)?.acciones?.includes(accion))

/** Secciones a las que entra un rol, en el orden de la matriz. */
export const seccionesDe = (idRol) =>
  Object.entries(MATRIZ)
    .filter(([, s]) => Boolean(s[Number(idRol)]))
    .map(([clave, s]) => ({ clave, ...s, permiso: s[Number(idRol)] }))

/** Las que además llevan enlace propio en el menú lateral. */
export const seccionesDeMenu = (idRol) => seccionesDe(idRol).filter((s) => !s.permiso.ocultoEnMenu)

/** Alcance del rol en la sección: 'asignado' | 'todos' | 'propio'. */
export const alcanceDe = (seccion, idRol) => permisoDe(seccion, idRol)?.alcance ?? null
