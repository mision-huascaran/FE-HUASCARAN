// Administración: colegios (CU013), alumnos (CU014) y usuarios (CU016).
//
// Contrato: `api_sicedu_frontend.md` (backend, 08/10/2026). Lo que cambió
// respecto de la versión anterior de este archivo, y por qué importa:
//
//   · `/profesores` DESAPARECIÓ. Un docente se crea con `POST /usuarios`
//     pasando `id_rol`, y en el mismo cuerpo van año escolar, colegio y grados:
//     el backend crea usuario, docente y asignaciones en una transacción.
//   · `zona` pasó a `provincia`, y `departamento` y `distrito` son obligatorios.
//   · Las SECCIONES no son una entidad: la sección es un atributo del colegio
//     (`colegio.seccion`, "Única" por defecto) y el alumno la hereda. Por eso
//     ya no hay `listarSecciones`.
//   · El CICLO del alumno lo calcula el backend a partir de subprograma y
//     grado. No se envía.
//   · Todo lista de 10 en 10 con `page` y responde con el esquema `Paginado`.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { alumnos, colegios, usuarios, auth } = ENDPOINTS

/** Nombre a mostrar a partir de `nombres` + `apellidos`, que es como viajan. */
const conNombre = (persona) => ({
  ...persona,
  nombre: persona.nombre ?? [persona.nombres, persona.apellidos].filter(Boolean).join(' ').trim(),
})

/**
 * Envoltura `Paginado` del backend, tolerante con el mock.
 *
 * El mock todavía responde arrays sueltos. Sin esto, cada pantalla tendría que
 * preguntarse de dónde vino la respuesta antes de pintar una tabla.
 */
export function normalizarPaginado(datos, porPagina = 10) {
  if (Array.isArray(datos)) {
    return { items: datos, total: datos.length, pagina: 1, paginas: 1, por_pagina: datos.length || porPagina }
  }
  const items = datos?.items ?? []
  const total = datos?.total ?? items.length
  return {
    items,
    total,
    pagina: datos?.pagina ?? datos?.page ?? 1,
    paginas: datos?.paginas ?? Math.max(1, Math.ceil(total / (datos?.por_pagina ?? porPagina))),
    por_pagina: datos?.por_pagina ?? porPagina,
  }
}

/**
 * Filtra por estado en el cliente SOLO para el mock.
 *
 * El backend ya acepta `?activo=`, así que contra la API real esto no se usa.
 * La regla transversal es que toda grilla abre mostrando los activos.
 */
const porEstado = (filas, estado = 'activo') => {
  if (estado === 'todos') return filas
  const quiero = estado !== 'inactivo'
  return filas.filter((f) => (f.activo ?? true) === quiero)
}

/** `?activo=` tal y como lo espera el backend, u `undefined` para "todos". */
const activoDe = (estado) => (estado === 'todos' ? undefined : estado !== 'inactivo')

// ── Catálogos para los formularios de administración ────────────────────────
//
// Van aparte de `resources/catalogos.js` por una razón concreta: al dar de alta
// hay que enviar ids del backend REAL. Si el desplegable ofreciera los del mock,
// el alta llegaría con un id inexistente y el servidor respondería 404.

export const listarGradosAdmin = () =>
  resolver({
    mock: () => handlers.catalogos.grados(),
    real: () => api.get(ENDPOINTS.catalogos.grados),
    forzarReal: adminContraApiReal,
  })

export const listarProgramasAdmin = () =>
  resolver({
    mock: () => handlers.catalogos.programas(),
    real: () => api.get(ENDPOINTS.catalogos.programas),
    forzarReal: adminContraApiReal,
  })

// ── Colegios (CU013) ────────────────────────────────────────────────────────

export const listarColegiosAdmin = async (filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.administracion.colegios(),
    real: () =>
      api.get(colegios.listar, {
        params: {
          departamento: filtros.departamento || undefined,
          distrito: filtros.distrito || undefined,
          activo: activoDe(filtros.estado),
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })

  const pagina = normalizarPaginado(datos)
  // El mock no filtra por estado; la API real sí lo hizo ya en el servidor.
  return Array.isArray(datos) ? { ...pagina, items: porEstado(pagina.items, filtros.estado) } : pagina
}

/** Valores existentes de departamento y distrito, para los desplegables de filtro. */
export const listarUbicaciones = () =>
  resolver({
    mock: () => handlers.administracion.ubicaciones(),
    real: () => api.get(colegios.ubicaciones),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /colegios`.
 *
 * `nombre`, `departamento` y `distrito` son obligatorios (422 si faltan). El
 * nombre es único ignorando mayúsculas, espacios y tildes: "Shilla" y "SHILLA "
 * chocan con 409.
 */
export const crearColegio = (colegio) =>
  resolver({
    mock: () => handlers.administracion.crearColegio(colegio),
    real: () => api.post(colegios.crear, colegio),
    forzarReal: adminContraApiReal,
  })

/** `PATCH /colegios/{id}` — parcial. Mandar `null` en un obligatorio da 422. */
export const actualizarColegio = (idColegio, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarColegio(idColegio, cambios),
    real: () => api.patch(colegios.actualizar(idColegio), cambios),
    forzarReal: adminContraApiReal,
  })

/**
 * Baja lógica del colegio. No toca alumnos ni registros: deja de contar como
 * operando y sale del alcance de sus docentes.
 */
export const cambiarEstadoColegio = (idColegio, activo) =>
  resolver({
    mock: () => handlers.administracion.cambiarEstadoColegio(idColegio, activo),
    // Ruta propia, verificada contra el servidor. NO es un PATCH con
    // `{activo}`: eso devolvía 200 sin cambiar nada.
    real: () => api.patch(activo ? colegios.activar(idColegio) : colegios.desactivar(idColegio)),
    forzarReal: adminContraApiReal,
  })

// ── Alumnos (CU014) ─────────────────────────────────────────────────────────

export const listarAlumnosAdmin = async (filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.administracion.alumnos(),
    real: () =>
      api.get(alumnos.listar, {
        params: {
          colegio: filtros.colegio || undefined,
          subprograma: filtros.subprograma ?? filtros.programa ?? undefined,
          ciclo: filtros.ciclo || undefined,
          grado: filtros.grado || undefined,
          activo: activoDe(filtros.estado),
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })

  const pagina = normalizarPaginado(datos)
  return {
    ...pagina,
    items: pagina.items.map((a) => {
      // Al Directivo el backend le responde 403 en Alumnos, pero si alguna
      // respuesta llegara sin nombre, la fila diría quién es por su id en vez
      // de salir en blanco y parecer un fallo de carga.
      const nombre = a.nombre || [a.apellidos, a.nombres].filter(Boolean).join(', ')
      return {
        ...a,
        anonimo: !nombre,
        nombre: nombre || `Estudiante n.º ${a.id_alumno}`,
        id_programa: a.id_programa ?? a.id_programa_actual,
      }
    }),
  }
}

/**
 * `POST /alumnos`.
 *
 * NO se manda el ciclo: lo calcula el backend (Alfabetización → III;
 * Comprensión Lectora → 2.º III, 3.º y 4.º IV, 5.º y 6.º V). Tampoco la
 * sección, que el alumno hereda del colegio. 1.º grado solo admite
 * Alfabetización, y el colegio debe ofrecer ese grado y ese subprograma.
 */
export const crearAlumno = ({ nombres, apellidos, id_colegio: idColegio, id_grado: idGrado, id_programa: idPrograma }) =>
  resolver({
    mock: () => handlers.administracion.crearAlumno({ nombres, apellidos, id_colegio: idColegio, id_grado: idGrado, id_programa: idPrograma }),
    real: () =>
      api.post(alumnos.crear, {
        nombres,
        apellidos,
        id_colegio: Number(idColegio),
        id_grado: Number(idGrado),
        id_programa_actual: Number(idPrograma),
      }),
    forzarReal: adminContraApiReal,
  })

export const actualizarAlumno = (idAlumno, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarAlumno(idAlumno, cambios),
    real: () => api.patch(alumnos.actualizar(idAlumno), cambios),
    forzarReal: adminContraApiReal,
  })

export const cambiarEstadoAlumno = (idAlumno, activo) =>
  resolver({
    mock: () => handlers.administracion.actualizarAlumno(idAlumno, { activo }),
    real: () => api.patch(activo ? alumnos.activar(idAlumno) : alumnos.desactivar(idAlumno)),
    forzarReal: adminContraApiReal,
  })

/**
 * Historial del alumno (CU015), construido a partir de la auditoría.
 *
 * Exige conexión: sin ella, la pestaña muestra su estado vacío. El backend
 * agrupa por evento, así que varias filas con la misma fecha y autor llegan
 * como una sola edición con el detalle de los campos cambiados.
 */
export const listarHistorialAlumno = (idAlumno) =>
  resolver({
    mock: () => handlers.administracion.auditoria('alumno', idAlumno),
    real: () => api.get(alumnos.historial(idAlumno)),
    forzarReal: adminContraApiReal,
  })

/**
 * Auditoría de un registro, para la pestaña de la plantilla de mantenimiento.
 *
 * El backend publica auditoría SOLO del alumno: es lo único que piden los CU.
 * Para colegios y usuarios devuelve lista vacía a propósito, y la pestaña
 * muestra su estado vacío en vez de inventarse un historial.
 */
export const listarAuditoria = (entidad, id) => {
  if (entidad === 'alumno') return listarHistorialAlumno(id)
  return resolver({
    mock: () => handlers.administracion.auditoria(entidad, id),
    real: () => Promise.resolve([]),
    forzarReal: adminContraApiReal,
  })
}

// ── Usuarios de los tres roles (CU016) ──────────────────────────────────────

/**
 * `GET /usuarios` — ordenado por rol (Docentes, Supervisores, Directivos) y
 * luego alfabéticamente.
 *
 * `colegios_asignados` llega como LISTA: nombres de colegios para los docentes
 * y `["Global"]` para Supervisor y Directivo.
 */
export const listarUsuariosAdmin = async (filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.administracion.usuarios(),
    real: () =>
      api.get(usuarios.listar, {
        params: {
          rol: filtros.rol || undefined,
          activo: activoDe(filtros.estado),
          q: filtros.q || undefined,
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })

  const pagina = normalizarPaginado(datos)
  return {
    ...pagina,
    items: pagina.items.map((u) => ({
      ...conNombre(u),
      colegios_asignados: Array.isArray(u.colegios_asignados) ? u.colegios_asignados : [],
      es_supervisor_original: Boolean(u.es_supervisor_original),
    })),
  }
}

/**
 * Solo los docentes, para los filtros que preguntan "¿de quién?".
 *
 * `GET /usuarios` devuelve USUARIOS (`id`), pero quien consume esta lista
 * necesita el `id_docente`, que es con lo que filtran las grillas y el
 * seguimiento. Sin esta traducción todas las opciones salían con el valor
 * vacío: React avisaba de claves duplicadas y, peor, elegir un docente en el
 * filtro no hacía nada.
 */
export const listarDocentes = async () => {
  const { items } = await listarUsuariosAdmin({ rol: 'Docente', estado: 'activo' })
  return items.map((u) => ({
    ...u,
    id_docente: u.id_docente ?? u.id ?? u.id_usuario,
  }))
}

/**
 * `POST /usuarios` — el ÚNICO alta, para los tres roles.
 *
 * Con `id_rol` de Docente hay que mandar además `anio_escolar`, `id_colegio` y
 * `grados`: por ahora un solo colegio por docente, atendiendo todos los grados
 * que ese colegio ofrece. Un aula (colegio + grado + periodo) solo admite un
 * docente, así que un choque responde 409.
 *
 * El backend genera la contraseña temporal y la envía por correo. Si el envío
 * falla, la respuesta trae `correo_enviado: false` y la `contraseña_temporal`
 * para mostrarla UNA sola vez.
 */
export const crearUsuario = (datos) =>
  resolver({
    mock: () => handlers.administracion.crearUsuario(datos),
    real: () => api.post(usuarios.crear, { ...datos, id_rol: Number(datos.id_rol) }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PATCH /usuarios/{id}`.
 *
 * Aquí se renueva (cambiando el año escolar) y se rota (cambiando el colegio e
 * indicando desde qué periodo aplica). En la cuenta del Supervisor original el
 * rol no se toca, pero correo, nombres y DNI sí se editan.
 */
export const actualizarUsuario = (id, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarUsuario(id, cambios),
    real: () => api.patch(usuarios.actualizar(id), cambios),
    forzarReal: adminContraApiReal,
  })

/**
 * Desactivar cierra las sesiones de esa persona y, si es docente, LIBERA SUS
 * AULAS desde el periodo vigente. Reactivar no las devuelve: hay que asignarle
 * colegio otra vez. Conviene decirlo en el modal de confirmación.
 */
export const desactivarUsuario = (idUsuario) =>
  resolver({
    mock: () => handlers.administracion.desactivarUsuario(idUsuario),
    real: () => api.patch(usuarios.desactivar(idUsuario)),
    forzarReal: adminContraApiReal,
  })

export const activarUsuario = (idUsuario) =>
  resolver({
    mock: () => handlers.administracion.activarUsuario(idUsuario),
    real: () => api.patch(usuarios.activar(idUsuario)),
    forzarReal: adminContraApiReal,
  })

// Alias por compatibilidad con las pantallas de docentes, que son usuarios.
export const desactivarDocente = desactivarUsuario
export const activarDocente = activarUsuario
export const actualizarDocente = actualizarUsuario
export const crearDocente = crearUsuario

// ── Asignaciones del usuario actual ─────────────────────────────────────────

/**
 * `GET /me/asignaciones` — las del usuario del TOKEN, nunca por id de docente.
 *
 * De esto depende todo lo que ve un Docente: sin asignación vigente no tiene
 * alumnos ni colegios, y eso es correcto, no un fallo de carga. Cada colegio
 * trae sus `grados`, y cada grado su `cantidad_alumnos`, `ciclos` y
 * `subprogramas`.
 */
export const listarMisAsignaciones = async () => {
  const datos = await resolver({
    mock: () => handlers.administracion.asignaciones(),
    real: () => api.get(auth.misAsignaciones),
    forzarReal: adminContraApiReal,
  })
  return Array.isArray(datos) ? datos : (datos?.asignaciones ?? [])
}

// El nombre antiguo sigue funcionando: lo usan la precarga y el control de
// actividad para saber si el docente tiene asignaciones.
export const listarAsignaciones = listarMisAsignaciones

export { usarMock as negocioEnMock } from '../client'
