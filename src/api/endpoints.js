// Todas las rutas del backend en un solo lugar. Ningún componente escribe una
// URL a mano: si Swagger cambia una ruta, se corrige aquí y nada más.
//
// ESTADO DEL CONTRATO — VERIFICADO contra el `openapi.json` del servidor en
// ejecución (48 rutas), no solo contra la guía. Varias rutas que la guía daba
// por pendientes sí existen, y los cambios de estado tienen ruta propia en vez
// de ir por PATCH con `{activo}`.
//
//   PUBLICADO   auth, inicio por rol, actividades, colegios, alumnos, usuarios,
//               seguimiento y ASISTENCIAS. Los esquemas exactos, en {API}/docs.
//   NO EXISTE   las demás grillas (Rúbrica, Seguimiento de Lectura y Registro
//               de Vuelo) y la sincronización offline en lote. Siguen
//               resolviéndose contra el mock hasta que el backend las publique.
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
     * CU001 — Primer ingreso: cambiar la contraseña temporal por la definitiva.
     *
     * Toda cuenta nueva nace con una temporal de 48 horas y la marca de
     * "cambio obligatorio", así que `/login` le responde 403
     * `cambio_contrasena_requerido` hasta que pase por aquí.
     *
     * Cuerpo: { correo, contraseña_temporal, contraseña_nueva,
     *           confirmar_contraseña_nueva }
     * Respuesta: la MISMA que `/login`, token incluido.
     *
     * (Las Recovery Keys se retiraron: `/password/recuperar-con-llave` ya no
     * existe, responde 404. El Supervisor original recupera su cuenta por el
     * proceso estándar de PIN.)
     */
    passwordPrimerIngreso: '/password/primer-ingreso',
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
    /**
     * SEMANA 11 — Los registros que una actividad TOCÓ (CU021, T10).
     *
     * Sale de la AUDITORÍA de la actividad, no de la fecha: dos actividades
     * del mismo día tocaron cosas distintas, y filtrar por fecha mezclaría el
     * trabajo de una con el de la otra. `?modulo=` y paginado de 40.
     */
    registrosDe: (idDocente, idActividad) =>
      `/seguimiento/docentes/${idDocente}/actividades/${idActividad}/registros`,
  },

  // PUBLICADO — Colegios (CU013) ─────────────────────────────────────────────
  colegios: {
    listar: '/colegios', // ?departamento=&distrito=&activo=&page=
    crear: '/colegios',
    detalle: (id) => `/colegios/${id}`,
    actualizar: (id) => `/colegios/${id}`, // PATCH; null en obligatorio → 422
    // Valores existentes para llenar los desplegables de filtro.
    ubicaciones: '/colegios/ubicaciones',
    // En qué periodo está HOY cada colegio, para decidir si una asignación
    // nueva es retroactiva o empieza en el próximo PA (CU016, T4).
    estadoCalendario: '/colegios/estado-calendario',
    // La baja lógica tiene ruta propia: NO es un PATCH con `{activo}`.
    activar: (id) => `/colegios/${id}/activar`,
    desactivar: (id) => `/colegios/${id}/desactivar`,
  },

  // PUBLICADO — Asistencias (CU022) ─────────────────────────────────────────
  //
  // Una CLASE es fecha + colegio + grado + subprograma. La sección no entra:
  // es un atributo del colegio que el alumno hereda.
  asistencia: {
    // ?id_colegio=&id_grado=&id_programa=&fecha= (los cuatro obligatorios)
    listar: '/asistencias',
    // PUT con varios registros a la vez; `estado: null` NO se acepta.
    guardar: '/asistencias',
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
    detalle: (id) => `/usuarios/${id}`,
    activar: (id) => `/usuarios/${id}/activar`,
    desactivar: (id) => `/usuarios/${id}/desactivar`,
  },

  /**
   * SEMANA 11 — Calendario académico (CU027).
   *
   * Sustituye al "periodo vigente" único que asumía el frontend: cada colegio
   * puede tener fechas propias, así que el periodo aplicable es función de
   * (colegio, fecha) y lo resuelve el servidor.
   */
  calendarios: {
    listar: '/calendarios', // ?id_anio_escolar=&id_colegio= ; sin colegio, el general
    crear: '/calendarios', // el general de un año
    crearParticular: '/calendarios/particulares',
    // PUT, no PATCH: se manda el calendario completo con su `version`.
    actualizar: (id) => `/calendarios/${id}`,
    usarGeneral: (id) => `/calendarios/${id}/usar-general`,
    // ?id_colegio=&fecha= → qué PA/PR aplica y si el día es lectivo.
    periodo: '/calendarios/periodo',
  },

  /**
   * SEMANA 11 — Permisos excepcionales de corrección (CU028) y habilitaciones.
   *
   * `misHabilitaciones` es el paquete que el frontend guarda en IndexedDB para
   * poder decidir SIN CONEXIÓN si una escritura está autorizada. Con conexión
   * no se usa: cada GET de módulo ya trae su propio bloque `escritura`.
   */
  permisos: {
    deUsuario: (id) => `/usuarios/${id}/permisos`,
    detalle: (id, idPermiso) => `/usuarios/${id}/permisos/${idPermiso}`,
    otorgar: (id) => `/usuarios/${id}/permisos`,
    // POST, no PATCH: revocar es una acción, no una edición parcial.
    revocar: (id, idPermiso) => `/usuarios/${id}/permisos/${idPermiso}/revocar`,
    opciones: '/permisos/opciones', // ?id_colegio=&id_anio_escolar=
    mios: '/me/permisos', // los VIGENTES del docente autenticado
    misHabilitaciones: '/me/habilitaciones',
  },

  /**
   * SEMANA 11 — Clases y reprogramaciones (CU013, CU022, base de CU024).
   *
   * OJO: una clase es colegio × grado × SECCIÓN, sin subprograma —el
   * subprograma es del alumno—. Por eso no se filtra por `id_programa`.
   */
  clases: {
    deColegio: (id) => `/colegios/${id}/clases`, // ?id_grado=&id_seccion=&desde=&hasta=
    reprogramar: (id) => `/colegios/${id}/clases/reprogramaciones`,
    reprogramaciones: (idClase) => `/clases/${idClase}/reprogramaciones`,
  },

  // SEMANA 11 — Seguimiento de Lectura (CU023 a CU026).
  lectura: {
    tablas: '/lectura/tablas',
    crear: '/lectura/tablas',
    claseReferencia: (id) => `/lectura/tablas/${id}/clase-referencia`,
    filas: (id) => `/lectura/tablas/${id}/filas`,
    noRealizada: (id) => `/lectura/tablas/${id}/no-realizada`,
  },

  // SEMANA 11 — Rúbrica mensual (CU029, CU030).
  rubricas: {
    listar: '/rubricas',
    guardar: '/rubricas',
    // Los descriptores pedagógicos los sirve el backend (RN-011): nunca se
    // escriben en el código.
    criterios: '/rubricas/criterios', // ?id_programa=&id_ciclo=
  },

  // SEMANA 11 — Registro de Vuelo (CU031, CU032).
  registroVuelo: {
    listar: '/registro-vuelo',
    // La sugerencia, la entrada y el nivel del programa los calcula el
    // SERVIDOR y no se aceptan desde el cliente.
    guardar: '/registro-vuelo',
  },

  /**
   * SEMANA 11 — Sincronización (CU012, CU017 a CU021).
   *
   * `pendientes` es el aviso ligero que cierra el agujero de "el trabajo
   * offline que nadie ve": al reconectar se avisa de QUÉ operaciones existen
   * antes de mandarlas, así el Supervisor ve el riesgo sin esperar al envío
   * completo.
   */
  sincronizacion: {
    pendientes: '/sincronizacion/pendientes',
    operacion: (idOperacion) => `/sincronizacion/operaciones/${idOperacion}`,
    // P4 §1: una operación propia `rechazada` pasa a `descartada`.
    descartar: (idOperacion) => `/sincronizacion/operaciones/${idOperacion}/descartar`,
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
  },

  dashboard: {
    resumen: '/dashboard/resumen',
    ejecutivo: '/dashboard/ejecutivo',
    rankingAulas: '/dashboard/ranking-aulas',
  },
}

export default ENDPOINTS
