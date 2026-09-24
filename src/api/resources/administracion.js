// Administración (P16): colegios, alumnos, docentes, cuentas y asignaciones.
//
// Estado del backend (APIS_BACKEND.md), respetado endpoint por endpoint:
//
//   REAL   colegios, alumnos (alta, listado paginado y edición), profesores
//          (alta, listado, edición, activar y desactivar) y las cuentas de
//          Supervisor y Directivo (alta, listado, activar y desactivar).
//   MOCK   las asignaciones docente-colegio-periodo, y la EDICIÓN de una cuenta
//          de Supervisor o Directivo: el backend no publica un PATCH para ellas
//          (solo `PATCH /profesores/{id}`, que es para docentes).
//
// Los catálogos de rúbrica se leen con `useCatalogos` y NO tienen escritura: la
// rúbrica es un instrumento oficial de Misión Huascarán (RF-025, RN-016).
import { api, resolver, usarMock, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { administracion } = ENDPOINTS

/** El backend real solo devuelve `nombres`/`apellidos`; la tabla muestra un nombre. */
function normalizarDocente(d) {
  const nombre = d.nombre ?? [d.nombres, d.apellidos].filter(Boolean).join(' ').trim()
  return {
    ...d,
    nombre,
    // `GET /profesores` no trae las asignaciones del periodo: sin ellas, la
    // columna queda vacía en vez de romperse.
    colegios_vigentes: d.colegios_vigentes ?? [],
  }
}

// ── Docentes ────────────────────────────────────────────────────────────────

export const listarDocentes = async () => {
  const filas = await resolver({
    mock: () => handlers.administracion.docentes(),
    real: () => api.get(administracion.profesores),
    forzarReal: adminContraApiReal,
  })
  return (filas ?? []).map(normalizarDocente)
}

/**
 * Alta de un docente.
 *
 * El backend NO recibe contraseña: genera una temporal, la manda por correo y la
 * devuelve en `contraseña_temporal` solo si el envío falló, para que el
 * Supervisor se la entregue a mano. Por eso la pantalla no pide contraseña y sí
 * muestra la que llegue de vuelta.
 */
export const crearDocente = async ({ nombres, apellidos, correo }) => {
  const creado = await resolver({
    mock: () => handlers.administracion.crearDocente({ nombres, apellidos, correo }),
    real: () => api.post(administracion.profesores, { nombres, apellidos, correo, activo: true }),
    forzarReal: adminContraApiReal,
  })
  return normalizarDocente(creado)
}

/**
 * Baja lógica: el backend desactiva la cuenta y su ficha de docente, no borra
 * nada. El docente deja de poder iniciar sesión y se puede reactivar.
 */
export const desactivarDocente = (idUsuario) =>
  resolver({
    mock: () => handlers.administracion.desactivarUsuario(idUsuario),
    real: () => api.patch(administracion.desactivarProfesor(idUsuario)),
    forzarReal: adminContraApiReal,
  })

/**
 * `PATCH /profesores/{id_usuario}` — parcial.
 * El backend escribe los nombres en `usuario` y en `docente`, así que el
 * listado no se queda con el nombre viejo.
 */
export const actualizarDocente = (idUsuario, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarUsuario(idUsuario, cambios),
    real: () => api.patch(administracion.profesor(idUsuario), cambios),
    forzarReal: adminContraApiReal,
  })

export const activarDocente = (idUsuario) =>
  resolver({
    mock: () => handlers.administracion.activarUsuario(idUsuario),
    real: () => api.patch(administracion.activarProfesor(idUsuario)),
    forzarReal: adminContraApiReal,
  })

// ── Colegios y alumnos ──────────────────────────────────────────────────────

/**
 * Grados y programas PARA LOS FORMULARIOS DE ADMINISTRACIÓN.
 *
 * Existen aparte de `resources/catalogos.js` por una razón concreta: al dar de
 * alta un alumno hay que enviar `id_colegio`, `id_grado` e `id_programa_actual`
 * del backend REAL. Si el desplegable ofreciera los del mock, el alta llegaría
 * con un id que allí no existe y el servidor respondería
 * `404 No existe un grado con id_grado=…`. El catálogo compartido, en cambio,
 * sigue en mock porque de él viven el dashboard y las pantallas de captura.
 */
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


export const listarColegiosAdmin = () =>
  resolver({
    mock: () => handlers.administracion.colegios(),
    real: () => api.get(administracion.colegios),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /colegios`. El backend guarda `{ nombre, zona }` y nada más, así que el
 * formulario tampoco pide nada más: la abreviatura que usan las etiquetas de
 * los gráficos la deduce el mock del propio nombre.
 */
export const crearColegio = ({ nombre, zona }) =>
  resolver({
    mock: () => handlers.administracion.crearColegio({ nombre, zona }),
    real: () => api.post(administracion.colegios, { nombre, zona }),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /alumnos` — paginado y con filtros. La respuesta viene envuelta
 * (`{ total, limit, offset, items }`), no como array suelto, porque sin `total`
 * no se puede saber cuántas páginas hay.
 *
 * El backend devuelve `nombres` y `apellidos` por separado y no resuelve el
 * nombre del colegio: eso se arma aquí una sola vez.
 */
/** `PATCH /colegios/{id}` — parcial. El backend solo admite nombre y zona. */
export const actualizarColegio = (idColegio, { nombre, zona }) =>
  resolver({
    mock: () => handlers.administracion.actualizarColegio(idColegio, { nombre, zona }),
    real: () => api.patch(administracion.colegio(idColegio), { nombre, zona }),
    forzarReal: adminContraApiReal,
  })

export const listarAlumnosAdmin = async (filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.administracion.alumnos(),
    real: () =>
      api.get(administracion.alumnos, {
        params: {
          colegio: filtros.colegio || undefined,
          grado: filtros.grado || undefined,
          programa: filtros.programa || undefined,
          q: filtros.q || undefined,
          limit: filtros.limit ?? 50,
          offset: filtros.offset ?? 0,
        },
      }),
    forzarReal: adminContraApiReal,
  })

  // El mock responde un array; la API real, la envoltura con `total`.
  const items = Array.isArray(datos) ? datos : (datos?.items ?? [])
  return {
    total: Array.isArray(datos) ? datos.length : (datos?.total ?? items.length),
    limit: Array.isArray(datos) ? items.length : (datos?.limit ?? 50),
    offset: Array.isArray(datos) ? 0 : (datos?.offset ?? 0),
    items: items.map((a) => ({
      ...a,
      nombre: a.nombre ?? [a.apellidos, a.nombres].filter(Boolean).join(', '),
      id_programa: a.id_programa ?? a.id_programa_actual,
    })),
  }
}

/** `PATCH /alumnos/{id}` — parcial: solo viajan los campos que cambian. */
export const actualizarAlumno = (idAlumno, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarAlumno(idAlumno, cambios),
    real: () => api.patch(administracion.alumno(idAlumno), cambios),
    forzarReal: adminContraApiReal,
  })
  resolver({ mock: () => handlers.administracion.alumnos(), real: () => handlers.administracion.alumnos() })

/**
 * `POST /alumnos` → { nombres, apellidos, id_colegio, id_grado, id_programa_actual }.
 * Un alumno no existe suelto: sin colegio, grado y programa el backend responde 404.
 */
export const crearAlumno = ({ nombres, apellidos, id_colegio: idColegio, id_grado: idGrado, id_programa: idPrograma, aula }) =>
  resolver({
    mock: () => handlers.administracion.crearAlumno({ nombres, apellidos, id_colegio: idColegio, id_grado: idGrado, id_programa: idPrograma, aula }),
    // El backend llama `id_programa_actual` a lo que la interfaz llama programa,
    // y no maneja aula todavía.
    real: () =>
      api.post(administracion.alumnos, {
        nombres,
        apellidos,
        id_colegio: Number(idColegio),
        id_grado: Number(idGrado),
        id_programa_actual: Number(idPrograma),
        activo: true,
      }),
    forzarReal: adminContraApiReal,
  })

// ── Cuentas de Supervisor y Directivo ───────────────────────────────────────

/** `GET /usuarios` — trae el nombre del rol ya resuelto (`rol`). */
export const listarUsuariosAdmin = async (rol) => {
  const filas = await resolver({
    mock: () => handlers.administracion.usuarios(),
    real: () => api.get(administracion.usuarios, { params: { rol: rol || undefined } }),
    forzarReal: adminContraApiReal,
  })
  return (filas ?? []).map((u) => ({
    ...u,
    nombre: u.nombre ?? [u.nombres, u.apellidos].filter(Boolean).join(' ').trim(),
  }))
}

/**
 * `POST /usuarios` — crea una cuenta de Supervisor o Directivo.
 *
 * Rechaza con 400 si el rol es Docente: esos se crean con `crearDocente`,
 * porque además necesitan su ficha en la tabla `docente`.
 *
 * `correo_enviado` dice si la credencial salió por correo. Cuando es `false`,
 * `contraseña_temporal` trae la ÚNICA copia y hay que mostrarla en pantalla.
 */
export const crearUsuario = ({ nombres, apellidos, correo, id_rol: idRol }) =>
  resolver({
    mock: () => handlers.administracion.crearUsuario({ nombres, apellidos, correo, id_rol: idRol }),
    real: () => api.post(administracion.usuarios, { nombres, apellidos, correo, id_rol: Number(idRol), activo: true }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PATCH /usuarios/{id}/desactivar`.
 *
 * El servidor rechaza con 409 la última cuenta activa de Supervisor o Directivo,
 * y también desactivarse a uno mismo. Su `detail` ya viene redactado para el
 * usuario final, así que se muestra tal cual.
 */
export const desactivarUsuario = (idUsuario) =>
  resolver({
    mock: () => handlers.administracion.desactivarUsuario(idUsuario),
    real: () => api.patch(administracion.desactivarUsuario(idUsuario)),
    forzarReal: adminContraApiReal,
  })

export const activarUsuario = (idUsuario) =>
  resolver({
    mock: () => handlers.administracion.activarUsuario(idUsuario),
    real: () => api.patch(administracion.activarUsuario(idUsuario)),
    forzarReal: adminContraApiReal,
  })

/**
 * TODO: el backend no publica un `PATCH /usuarios/{id}`. Editar una cuenta de
 * Supervisor o Directivo solo funciona contra el mock; la de un Docente sí se
 * corrige de verdad con `actualizarDocente`.
 */
export const actualizarUsuario = (id, payload) =>
  resolver({
    mock: () => handlers.administracion.actualizarUsuario(id, payload),
    real: () => handlers.administracion.actualizarUsuario(id, payload),
  })

/** Editar una cuenta administrativa todavía no existe en la API. */
export const edicionDeCuentasEnMock = true
export const negocioEnMock = usarMock

// ── Asignaciones (solo mock) ────────────────────────────────────────────────

export const listarAsignaciones = () =>
  resolver({ mock: () => handlers.administracion.asignaciones(), real: () => handlers.administracion.asignaciones() })

export const crearAsignacion = (payload) =>
  resolver({
    mock: () => handlers.administracion.crearAsignacion(payload),
    real: () => handlers.administracion.crearAsignacion(payload),
  })

export const eliminarAsignacion = (id) =>
  resolver({
    mock: () => handlers.administracion.eliminarAsignacion(id),
    real: () => handlers.administracion.eliminarAsignacion(id),
  })
