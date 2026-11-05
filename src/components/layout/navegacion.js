// Menú lateral y etiquetas de las migas de pan.
//
// El menú se DERIVA de la matriz de permisos (`auth/permisos.js`), que el
// documento del sprint declara fuente única. Antes había una lista por rol
// escrita a mano y se desincronizaba con las guardas; ahora, si un rol no tiene
// la sección en la matriz, no aparece el enlace y la ruta además lo rechaza.
import {
  Activity,
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  History,
  Home,
  Plane,
  School,
  Users,
} from 'lucide-react'
import { seccionesDeMenu } from '../../auth/permisos'

const ICONOS = {
  inicio: Home,
  dashboard: LayoutDashboard,
  alumnos: GraduationCap,
  usuarios: Users,
  colegios: School,
  asistencia: CalendarCheck,
  rubrica: ClipboardList,
  lectura: BookOpenCheck,
  vuelo: Plane,
  sesiones: History,
  // Tenía el ícono de casa de Inicio, por descarte (U21).
  seguimiento: Activity,
}

/**
 * Nombres cortos para la BARRA INFERIOR del móvil.
 *
 * Debajo de un icono de 20px no caben "Seguimiento de Lectura" ni "Registro de
 * Vuelo": o se parten en tres líneas o se cortan a la mitad. La etiqueta larga
 * se queda en el menú lateral y en las migas de pan, que es donde hay sitio;
 * aquí va la palabra que distingue a esa sección de las demás.
 */
const NOMBRES_CORTOS = {
  lectura: 'Lectura',
  vuelo: 'Vuelo',
  // El mismo nombre que en el menú y en el título (U21).
  asistencia: 'Asistencias',
}

export const navegacionDe = (idRol) =>
  seccionesDeMenu(idRol).map((s) => ({
    to: s.ruta,
    label: s.etiqueta,
    corta: NOMBRES_CORTOS[s.clave] ?? s.etiqueta,
    icon: ICONOS[s.clave] ?? Home,
  }))

/** Compatibilidad con las pruebas y pantallas que leían el mapa por rol. */
export const NAV_BY_ROLE = {
  1: navegacionDe(1),
  2: navegacionDe(2),
  3: navegacionDe(3),
}

/** Etiqueta de cada segmento de URL para las migas de pan (P2). */
export const ETIQUETAS_RUTA = {
  inicio: 'Inicio',
  dashboard: 'Dashboard',
  // CU034 cuelga de CU033: su miga de pan es Dashboard → Libros leídos.
  libros: 'Consolidado de libros leídos',
  alumnos: 'Alumnos',
  usuarios: 'Usuarios',
  colegios: 'Colegios',
  asistencia: 'Asistencias',
  rubrica: 'Rúbrica',
  'seguimiento-lectura': 'Seguimiento de Lectura',
  'registro-vuelo': 'Registro de Vuelo',
  sesiones: 'Sesiones',
  seguimiento: 'Seguimiento',
  estudiantes: 'Alumnos',
  403: 'Sin permisos',
}

export const etiquetaDeSegmento = (segmento) =>
  ETIQUETAS_RUTA[segmento] ?? (/^\d+$/.test(segmento) ? 'Detalle' : segmento)
