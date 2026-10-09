// Todas las rutas del backend en un solo lugar. Ningún componente escribe una
// URL a mano: si Swagger cambia una ruta, se corrige aquí y nada más.
//
// ESTADO DEL CONTRATO — VERIFICADO contra el `openapi.json` del servidor en
// ejecución (48 rutas), no solo contra la guía. Varias rutas que la guía daba
// por pendientes sí existen, y los cambios de estado tienen ruta propia en vez
// de ir por PATCH con `{activo}`.
//
//   PUBLICADO   auth, inicio por rol, actividades, colegios, alumnos, usuarios
//               y seguimiento. Los esquemas exactos están en {API}/docs.
//   NO EXISTE   las grillas (Rúbrica, Lectura, Registro de Vuelo, Asistencia) y
//               la sincronización offline. Siguen resolviéndose contra el mock
//               hasta que el backend las publique.
//
// Lo que desapareció del contrato anterior y NO debe volver:
//   · `/profesores`  → todo pasa por `/usuarios` con `id_rol`.
//   · `/secciones`   → la sección es un atributo del colegio, no una entidad.
//   · `/sesiones`    → se llaman `/actividades`; "Sesiones" es solo el nombre
//                      de la pantalla, para no confundirlo con la sesión
//                      autenticada.
export const ENDPOINTS = {
  servicio: {
    raiz: '/', // → { status: "ok" }
  },

  // PUBLICADO — JWT Bearer, 8 horas, sin renovación ──────────────────────────
  auth: {
    login: '/login', // { correo, password } → { access_token, token_type }
    // Cierra la sesión DE VERDAD en el servidor y, si había actividad abierta,
    // la finaliza como "Forzado por cierre de sesión". El token muere al instante.
    logout: '/logout',
    me: '/me',
    // Las asignaciones del usuario actual salen del token, nunca por id.
    misAsignaciones: '/me/asignaciones',

    // Cambio de contraseña CON sesión: los tres exigen Authorization.
    passwordCodigo: '/me/password/codigo',
    passwordVerificarCodigo: '/me/password/verificar-codigo',
    passwordCambiar: '/me/password',

    // Recuperación SIN sesión, desde el login. Públicos: no llevan token.
    passwordRecuperar: '/password/recuperar', // { correo }
    passwordVerificarCodigoPublico: '/password/verificar-codigo', // { correo, codigo }
    passwordRestablecer: '/password/restablecer', // { correo, codigo, contraseña_nueva, confirmar_contraseña_nueva }
    /**
     * CU001 — Recuperación del Supervisor original con una Recovery Key.
     *
     * Son 10 llaves de un solo uso, entregadas aparte en un `.txt`. Existe
     * porque esa cuenta no se puede eliminar ni desactivar y es la única que
     * crea usuarios: si pierde el acceso y el correo falla, no hay otra vía.
     *
     * Cuerpo: { correo, llave, contraseña_nueva, confirmar_contraseña_nueva }
     * Respuesta: { mensaje, llaves_restantes }
     *
     * TARDA ~7 SEGUNDOS A PROPÓSITO, y el mismo tiempo acierte o falle: así
     * nadie deduce por la demora si una llave era válida.
     */
    passwordRecuperarConLlave: '/password/recuperar-con-llave',
  },

  // PUBLICADO — un endpoint por rol (CU010, CU011, CU012) ────────────────────
  inicio: {
    docente: '/inicio/docente',
    supervisor: '/inicio/supervisor',
    directivo: '/inicio/directivo',
  },

  /**
   * PUBLICADO — Actividades de trabajo del Docente (CU009, CU010, CU017–CU019).
   *
   * El id lo genera el CLIENTE (UUID) para poder reintentar sin duplicar: 201
   * si la crea, 200 si ese UUID ya era suyo.
   */
  actividades: {
    crear: '/actividades',
    finalizar: (id) => `/actividades/${id}/finalizar`,
    listar: '/actividades', // ?desde=&hasta=&estado=&sincronizacion=&tipo_cierre=&page=
    detalle: (id) => `/actividades/${id}`,
  },

  // PUBLICADO — Seguimiento del Supervisor (CU020, CU021) ────────────────────
  seguimiento: {
    docentes: '/seguimiento/docentes', // ?id_colegio=&desde=&hasta=&sincronizacion=&activo=&page=
    docente: (id) => `/seguimiento/docentes/${id}`,
    actividadesDe: (id) => `/seguimiento/docentes/${id}/actividades`,
  },

  // PUBLICADO — Colegios (CU013) ─────────────────────────────────────────────
  colegios: {
    listar: '/colegios', // ?departamento=&distrito=&activo=&page=
    crear: '/colegios',
    detalle: (id) => `/colegios/${id}`,
    actualizar: (id) => `/colegios/${id}`, // PATCH; null en obligatorio → 422
    // Valores existentes para llenar los desplegables de filtro.
    ubicaciones: '/colegios/ubicaciones',
    // La baja lógica tiene ruta propia: NO es un PATCH con `{activo}`.
    activar: (id) => `/colegios/${id}/activar`,
    desactivar: (id) => `/colegios/${id}/desactivar`,
  },

  // PUBLICADO — Alumnos y su detalle (CU014, CU015) ──────────────────────────
  alumnos: {
    listar: '/alumnos', // ?colegio=&subprograma=&ciclo=&grado=&activo=&page=
    crear: '/alumnos',
    detalle: (id) => `/alumnos/${id}`,
    actualizar: (id) => `/alumnos/${id}`,
    // Una pestaña del detalle por endpoint (CU015).
    resumen: (id) => `/alumnos/${id}/resumen`,
    registroVuelo: (id) => `/alumnos/${id}/registro-vuelo`,
    rubrica: (id) => `/alumnos/${id}/rubrica`,
    lectura: (id) => `/alumnos/${id}/lectura`,
    historial: (id) => `/alumnos/${id}/historial`, // exige conexión (CU015)
    activar: (id) => `/alumnos/${id}/activar`,
    desactivar: (id) => `/alumnos/${id}/desactivar`,
  },

  // PUBLICADO — Usuarios de los tres roles (CU016) ───────────────────────────
  usuarios: {
    listar: '/usuarios', // ?rol=&activo=&q=&page=
    // Un solo POST para los tres roles. Con id_rol de Docente, el mismo cuerpo
    // lleva año escolar, colegio y grados: el backend crea usuario, docente y
    // asignaciones en una transacción.
    crear: '/usuarios',
    actualizar: (id) => `/usuarios/${id}`,
    activar: (id) => `/usuarios/${id}/activar`,
    desactivar: (id) => `/usuarios/${id}/desactivar`,
  },

  // PUBLICADO — Catálogos. Se piden una vez al entrar y se guardan en IndexedDB.
  //
  // Los nombres están verificados contra el servidor: no hay `/ciclos` ni
  // `/roles`, el de periodos es `/periodos-academicos`, y los niveles van con
  // guion (`/niveles-rubrica`), no con barra.
  catalogos: {
    grados: '/grados',
    programas: '/programas',
    periodos: '/periodos-academicos',
    anios: '/anios-escolares',
    semanas: '/semanas',
    asignaciones: '/asignaciones',
    nivelesRazkids: '/niveles-razkids',
    nivelesRubrica: '/niveles-rubrica', // ?programa=
    nivelesGenerales: '/niveles-generales',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NO EXISTE AÚN (api_sicedu_frontend §12). Las pantallas que dependen de
  // esto siguen en mock; sus rutas son provisionales y habrá que contrastarlas
  // con /docs cuando el backend publique las grillas.
  // ─────────────────────────────────────────────────────────────────────────
  // De los niveles, solo este sigue sin existir.
  esperadoPorGrado: '/niveles/esperado-por-grado',

  reporteSemanal: {
    listar: '/reporte-semanal',
    crear: '/reporte-semanal',
    actualizar: (id) => `/reporte-semanal/${id}`,
    agregarLibro: (id) => `/reporte-semanal/${id}/libros`,
    eliminarLibro: (idLibro) => `/reporte-semanal/libros/${idLibro}`,
  },

  rubricaSemanal: {
    listar: '/rubrica-semanal',
    crear: '/rubrica-semanal',
  },

  evaluacionDiagnostica: {
    listar: '/evaluacion-diagnostica',
    crear: '/evaluacion-diagnostica',
    actualizar: (id) => `/evaluacion-diagnostica/${id}`,
  },

  nivelFinalMensual: {
    listar: '/nivel-final-mensual',
    ajustar: (id) => `/nivel-final-mensual/${id}/ajuste`,
  },

  dashboard: {
    resumen: '/dashboard/resumen',
    ejecutivo: '/dashboard/ejecutivo',
    rankingAulas: '/dashboard/ranking-aulas',
  },

  consolidados: {
    nivel: '/consolidados/nivel',
    libros: '/consolidados/libros',
  },

  alertas: {
    inconsistencias: '/alertas/inconsistencias',
    revisar: (id) => `/alertas/inconsistencias/${id}`,
  },
}

export default ENDPOINTS
