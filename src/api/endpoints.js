// Todas las rutas del backend en un solo lugar (§3). Ningún componente escribe
// una URL a mano: si Swagger cambia una ruta, se corrige aquí y nada más.
//
// ESTADO DEL CONTRATO — contrastado con APIS_BACKEND.md y verificado contra el
// servidor en ejecución con `npm run verificar:backend`.
//
//   IMPLEMENTADO   `GET /`, `POST /login`, `GET /me`, `POST /logout`.
//                  La autenticación es JWT Bearer y el token dura 8 horas.
//   NO EXISTE AÚN  todos los endpoints de negocio. Las tablas ya están en la
//                  base de datos, pero ningún endpoint las expone.
//
// Por eso el negocio sigue resolviéndose contra el mock. Las rutas marcadas
// como pendientes son el contrato provisional de §3 del prompt y hay que
// verificarlas contra {API_BASE_URL}/docs conforme el backend las publique.
export const ENDPOINTS = {
  // IMPLEMENTADO ─────────────────────────────────────────────────────────────
  servicio: {
    raiz: '/', // → { status: "ok" }
  },

  // IMPLEMENTADO — JWT Bearer, token válido 8 horas ──────────────────────────
  auth: {
    login: '/login', // body { correo, password } → { access_token, token_type }
    logout: '/logout', // simbólico: el JWT no se revoca en el servidor
    me: '/me', // requiere Authorization: Bearer <token>
    passwordCodigo: '/me/password/codigo',
    passwordVerificarCodigo: '/me/password/verificar-codigo',
    passwordCambiar: '/me/password',
  },

  // NO EXISTE AÚN ────────────────────────────────────────────────────────────
  catalogos: {
    colegios: '/colegios',
    grados: '/grados',
    programas: '/programas',
    nivelesRazkids: '/niveles/razkids',
    nivelesRubrica: '/niveles/rubrica', // ?programa=
    nivelGeneral: '/niveles/general',
    esperadoPorGrado: '/niveles/esperado-por-grado',
    periodos: '/periodos-evaluacion',
    semanas: '/semanas',
  },

  // NO EXISTE AÚN ────────────────────────────────────────────────────────────
  alumnos: {
    listar: '/alumnos', // ?colegio=&grado=&programa=&q=
    detalle: (id) => `/alumnos/${id}`,
    historial: (id) => `/alumnos/${id}/historial`,
  },

  // El panel del docente (P3) necesita sus asignaciones del periodo vigente y el
  // avance de la semana. §3 no lista ninguna ruta para eso; estas dos son la
  // propuesta del frontend y hay que contrastarlas con el equipo de backend.
  docentes: {
    asignaciones: (id) => `/docentes/${id}/asignaciones`, // ?periodo=
    resumen: (id) => `/docentes/${id}/resumen`, // ?periodo=&semana=
  },

  reporteSemanal: {
    listar: '/reporte-semanal', // ?semana=&colegio=&grado=
    crear: '/reporte-semanal',
    actualizar: (id) => `/reporte-semanal/${id}`,
    agregarLibro: (id) => `/reporte-semanal/${id}/libros`,
    eliminarLibro: (idLibro) => `/reporte-semanal/libros/${idLibro}`,
  },

  rubricaSemanal: {
    listar: '/rubrica-semanal', // ?semana=&colegio=&grado=
    crear: '/rubrica-semanal',
  },

  evaluacionDiagnostica: {
    listar: '/evaluacion-diagnostica', // ?periodo=&colegio=&grado=
    crear: '/evaluacion-diagnostica',
    actualizar: (id) => `/evaluacion-diagnostica/${id}`,
  },

  nivelFinalMensual: {
    listar: '/nivel-final-mensual', // ?mes=&colegio=&grado=
    ajustar: (id) => `/nivel-final-mensual/${id}/ajuste`,
  },

  dashboard: {
    indicadores: '/dashboard/indicadores',
    distribucion: '/dashboard/distribucion',
    rankingColegios: '/dashboard/ranking-colegios', // ?programa=&periodo=
    rankingAulas: '/dashboard/ranking-aulas', // ?colegio=&periodo=
    // PROPUESTA DEL FRONTEND: todo el dashboard (P12) en una sola respuesta.
    // RF-006 pide una sola vista con siete bloques que reaccionan a los mismos
    // filtros; con la conexión del 70 % de RN-017, una petición es mejor que siete.
    resumen: '/dashboard/resumen',
    // PROPUESTA DEL FRONTEND: indicadores del panel ejecutivo (P17).
    ejecutivo: '/dashboard/ejecutivo',
  },

  // PROPUESTA DEL FRONTEND: §3 no define el detalle de un colegio (P13).
  colegios: {
    detalle: (id) => `/colegios/${id}/resumen`, // ?periodo=&programa=
  },

  consolidados: {
    nivel: '/consolidados/nivel', // ?colegio=&periodo=
    libros: '/consolidados/libros', // ?colegio=&mes=&anio=
  },

  alertas: {
    inconsistencias: '/alertas/inconsistencias',
    // PROPUESTA DEL FRONTEND: marcar una alerta como revisada (P15).
    revisar: (id) => `/alertas/inconsistencias/${id}`,
  },

  // PROPUESTA DEL FRONTEND: §3 no lista la administración (P16).
  administracion: {
    docentes: '/docentes',
    asignaciones: '/asignaciones',
    asignacion: (id) => `/asignaciones/${id}`,
  },
}

export default ENDPOINTS
