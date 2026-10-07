// Menú lateral y etiquetas de las migas de pan.
//
// El menú se DERIVA de la matriz de permisos (`auth/permisos.js`), que el
// documento del sprint declara fuente única. Antes había una lista por rol
// escrita a mano y se desincronizaba con las guardas; ahora, si un rol no tiene
// la sección en la matriz, no aparece el enlace y la ruta además lo rechaza.
import {
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  Plane,
  School,
  Users,
} from 'lucide-react'
import { seccionesDeMenu } from '../../auth/permisos'

const ICONOS = {
  inicio: Home,
  alumnos: GraduationCap,
  usuarios: Users,
  colegios: School,
  asistencia: CalendarCheck,
  rubrica: ClipboardList,
  lectura: BookOpenCheck,
  vuelo: Plane,
  sesiones: History,
  dashboard: LayoutDashboard,
}

export const navegacionDe = (idRol) =>
  seccionesDeMenu(idRol).map((s) => ({ to: s.ruta, label: s.etiqueta, icon: ICONOS[s.clave] ?? Home }))

/** Compatibilidad con las pruebas y pantallas que leían el mapa por rol. */
export const NAV_BY_ROLE = {
  1: navegacionDe(1),
  2: navegacionDe(2),
  3: navegacionDe(3),
}

/** Etiqueta de cada segmento de URL para las migas de pan (P2). */
export const ETIQUETAS_RUTA = {
  inicio: 'Inicio',
  alumnos: 'Alumnos',
  usuarios: 'Usuarios',
  colegios: 'Colegios',
  asistencia: 'Asistencia',
  rubrica: 'Rúbrica',
  'seguimiento-lectura': 'Seguimiento de Lectura',
  'registro-vuelo': 'Registro de Vuelo',
  nuevo: 'Nueva evaluación',
  sesiones: 'Sesiones',
  dashboard: 'Dashboard',
  estudiantes: 'Alumnos',
  'nivel-final': 'Nivel final mensual',
  'consulta-colegios': 'Consulta de colegios',
  consolidados: 'Consolidados',
  alertas: 'Alertas',
  ranking: 'Ranking de colegios',
  reportes: 'Reportes',
  403: 'Sin permisos',
}

export const etiquetaDeSegmento = (segmento) =>
  ETIQUETAS_RUTA[segmento] ?? (/^\d+$/.test(segmento) ? 'Detalle' : segmento)
