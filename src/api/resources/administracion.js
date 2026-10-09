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

/** Id de un campo que llega como número suelto o como objeto `{id, nombre}`. */
const idDe = (valor) => (valor != null && typeof valor === 'object' ? (valor.id ?? null) : (valor ?? null))

/**
 * Todas las páginas de un listado, no solo la primera.
 *
 * El backend pagina de 10 en 10 y las pantallas pintan la lista entera (la
 * tabla pagina en el cliente). Pedir solo `page=1` dejaba Usuarios, Alumnos y
 * Colegios cortados en 10 filas sin ningún aviso, y la precarga offline con
 * solo los 10 primeros alumnos.
 *
 * Si quien llama pide una página concreta (`filtros.pagina`), se respeta.
 */
async function todasLasPaginas(pedir, pagina) {
  const primera = await pedir(pagina)
  if (Array.isArray(primera) || pagina) return primera

  const { paginas } = normalizarPaginado(primera)
  if (paginas <= 1) return primera

  const resto = await Promise.all(Array.from({ length: paginas - 1 }, (_, i) => pedir(i + 2)))
  const items = [primera, ...resto].flatMap((datos) => normalizarPaginado(datos).items)
  return { ...primera, items, total: primera?.total ?? items.length, pagina: 1, paginas: 1, por_pagina: items.length }
}

// ── Catálogos para los formularios de administración ────────────────────────
//
// Van aparte de `resources/catalogos.js` por una razón concreta: al dar de alta
// hay que enviar ids del backend REAL. Si el desplegable ofreciera los del mock,
// el alta llegaría con un id inexistente y el servidor respondería 404.

export const listarGradosAdmin = async () => {
  const grados = await resolver({
    mock: () => handlers.catalogos.grados(),
    real: () => api.get(ENDPOINTS.catalogos.grados),
    forzarReal: adminContraApiReal,
  })
  return (grados ?? []).map((g) => ({ ...g, id_grado: g.id_grado ?? g.id }))
}

export const listarProgramasAdmin = async () => {
  const programas = await resolver({
    mock: () => handlers.catalogos.programas(),
    real: () => api.get(ENDPOINTS.catalogos.programas),
    forzarReal: adminContraApiReal,
  })
  return (programas ?? []).map((p) => ({ ...p, id_programa: p.id_programa ?? p.id }))
}

// ── Colegios (CU013) ────────────────────────────────────────────────────────

export const listarColegiosAdmin = async (filtros = {}) => {
  const datos = await todasLasPaginas(
    (page) =>
      resolver({
        mock: () => handlers.administracion.colegios(),
        real: () =>
          api.get(colegios.listar, {
            params: {
              departamento: filtros.departamento || undefined,
              distrito: filtros.distrito || undefined,
              activo: activoDe(filtros.estado),
              page: page || undefined,
            },
          }),
        forzarReal: adminContraApiReal,
      }),
    filtros.pagina,
  )

  const pagina = normalizarPaginado(datos)
  const items = pagina.items.map((c) => ({ ...c, id_colegio: c.id_colegio ?? c.id }))
  // El mock no filtra por estado; la API real sí lo hizo ya en el servidor.
  return { ...pagina, items: Array.isArray(datos) ? porEstado(items, filtros.estado) : items }
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

const CICLO_POR_ID = { 1: 'III', 2: 'IV', 3: 'V' }

const etiquetaDeCampo = (valor) => (valor != null && typeof valor === 'object' ? (valor.nombre ?? '') : valor)

/**
 * Fila de alumno con los ids que usan los formularios y las acciones.
 *
 * El backend identifica al alumno con `id` y manda colegio, grado y
 * subprograma como objetos `{id, nombre}`; el simulador usa `id_alumno` y ids
 * sueltos. Sin esta traducción "Inactivar" enviaba `PATCH /alumnos/undefined`
 * (422) y "Editar" abría el formulario sin colegio, grado ni subprograma.
 */
export function normalizarAlumno(a) {
  // Al Directivo el backend le responde 403 en Alumnos, pero si alguna
  // respuesta llegara sin nombre, la fila diría quién es por su id en vez
  // de salir en blanco y parecer un fallo de carga.
  const idAlumno = a.id_alumno ?? a.id
  const nombre = a.nombre || [a.apellidos, a.nombres].filter(Boolean).join(', ')
  return {
    ...a,
    id_alumno: idAlumno,
    id_colegio: a.id_colegio ?? idDe(a.colegio),
    id_grado: a.id_grado ?? idDe(a.grado),
    id_programa: a.id_programa ?? a.id_programa_actual ?? idDe(a.programa ?? a.subprograma),
    // Solo lectura en el formulario: se muestran como texto, no como objeto.
    seccion: etiquetaDeCampo(a.seccion),
    ciclo: etiquetaDeCampo(a.ciclo),
    anonimo: !nombre,
    nombre: nombre || `Estudiante n.º ${idAlumno}`,
  }
}

/**
 * Filtros de Alumnos aplicados en el cliente.
 *
 * Se usan con el simulador (que devuelve la lista entera), con la copia de
 * IndexedDB cuando no hay conexión, y para la búsqueda por nombre, que el
 * backend no ofrece como parámetro.
 */
export function filtrarAlumnos(filas, filtros = {}) {
  const texto = String(filtros.q ?? '').trim().toLowerCase()
  const igual = (a, b) => b == null || b === '' || String(a) === String(b)
  const cicloDe = (a) => {
    const etiqueta = typeof a.ciclo === 'object' ? a.ciclo?.nombre : a.ciclo
    return a.id_ciclo ?? a.id_ciclo_nominal ?? Object.keys(CICLO_POR_ID).find((k) => CICLO_POR_ID[k] === etiqueta)
  }
  return porEstado(filas, filtros.estado ?? 'todos').filter(
    (a) =>
      igual(a.id_colegio, filtros.id_colegio ?? filtros.colegio) &&
      igual(a.id_grado, filtros.id_grado ?? filtros.grado) &&
      igual(a.id_programa, filtros.id_programa ?? filtros.subprograma) &&
      igual(cicloDe(a), filtros.id_ciclo ?? filtros.ciclo) &&
      (!texto || `${a.nombre ?? ''} ${a.codigo ?? ''}`.toLowerCase().includes(texto)),
  )
}

export const listarAlumnosAdmin = async (filtros = {}) => {
  const datos = await todasLasPaginas(
    (page) =>
      resolver({
        mock: () => handlers.administracion.alumnos(),
        real: () =>
          api.get(alumnos.listar, {
            // La pantalla nombra sus filtros como los campos (`id_colegio`…);
            // el backend los espera sin prefijo. Antes no se traducían y
            // ningún filtro llegaba al servidor.
            params: {
              colegio: filtros.colegio || filtros.id_colegio || undefined,
              subprograma: filtros.subprograma || filtros.programa || filtros.id_programa || undefined,
              ciclo: filtros.ciclo || filtros.id_ciclo || undefined,
              grado: filtros.grado || filtros.id_grado || undefined,
              activo: activoDe(filtros.estado),
              page: page || undefined,
            },
          }),
        forzarReal: adminContraApiReal,
      }),
    filtros.pagina,
  )

  const pagina = normalizarPaginado(datos)
  const items = pagina.items.map(normalizarAlumno)
  // Con la API real el servidor ya filtró todo menos la búsqueda por nombre.
  return { ...pagina, items: filtrarAlumnos(items, Array.isArray(datos) ? filtros : { q: filtros.q }) }
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

/**
 * `PATCH /alumnos/{id}` — solo los campos editables, con los nombres del
 * backend. El formulario también lleva sección y ciclo, que son de solo
 * lectura (los calcula el servidor) y no deben viajar.
 */
export const actualizarAlumno = (idAlumno, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarAlumno(idAlumno, cambios),
    real: () => api.patch(alumnos.actualizar(idAlumno), cuerpoDeAlumno(cambios)),
    forzarReal: adminContraApiReal,
  })

function cuerpoDeAlumno(cambios) {
  const cuerpo = {}
  if (cambios.nombres !== undefined) cuerpo.nombres = cambios.nombres
  if (cambios.apellidos !== undefined) cuerpo.apellidos = cambios.apellidos
  if (cambios.id_colegio) cuerpo.id_colegio = Number(cambios.id_colegio)
  if (cambios.id_grado) cuerpo.id_grado = Number(cambios.id_grado)
  const idPrograma = cambios.id_programa ?? cambios.id_programa_actual
  if (idPrograma) cuerpo.id_programa_actual = Number(idPrograma)
  return cuerpo
}

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
  const datos = await todasLasPaginas(
    (page) =>
      resolver({
        mock: () => handlers.administracion.usuarios(),
        real: () =>
          api.get(usuarios.listar, {
            params: {
              rol: filtros.rol || undefined,
              activo: activoDe(filtros.estado),
              q: filtros.q || undefined,
              page: page || undefined,
            },
          }),
        forzarReal: adminContraApiReal,
      }),
    filtros.pagina,
  )

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
  return (Array.isArray(datos) ? datos : (datos?.asignaciones ?? [])).map(normalizarAsignacion)
}

/**
 * Una asignación con la forma plana que usan las pantallas:
 * `{ id_colegio, colegio, grados: [id_grado…], detalle_grados: [...] }`.
 *
 * El backend la manda anidada —`{ colegio: {id, nombre}, grados: [{id,
 * nombre, cantidad_alumnos, ciclos, subprogramas}] }`— y las pantallas la
 * leían como plana: el formulario de Alumnos se quedaba sin colegios ni grados
 * que ofrecer al Docente, y el filtro de Rúbrica pintaba
 * "[object Object].° grado". Se traduce aquí, una sola vez.
 */
export function normalizarAsignacion(a) {
  const grados = (a.grados ?? []).map((g) =>
    g != null && typeof g === 'object'
      ? { ...g, id_grado: g.id_grado ?? g.id ?? idDe(g.grado), nombre: g.nombre ?? g.grado?.nombre }
      : { id_grado: g },
  )
  return {
    ...a,
    id_colegio: a.id_colegio ?? idDe(a.colegio),
    colegio: typeof a.colegio === 'object' && a.colegio !== null ? a.colegio.nombre : a.colegio,
    grados: grados.map((g) => g.id_grado),
    detalle_grados: grados,
  }
}

// El nombre antiguo sigue funcionando: lo usan la precarga y el control de
// actividad para saber si el docente tiene asignaciones.
export const listarAsignaciones = listarMisAsignaciones

export { usarMock as negocioEnMock } from '../client'
