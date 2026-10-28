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
import { comoGradosConDia } from '../../lib/gradosColegio'
import { hoy } from '../../lib/relojServidor'

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
  // El backend responde `{items, total, page, page_size, total_pages}`.
  const porPaginaReal = datos?.por_pagina ?? datos?.page_size ?? porPagina
  return {
    items,
    total,
    pagina: datos?.pagina ?? datos?.page ?? 1,
    paginas: datos?.paginas ?? datos?.total_pages ?? Math.max(1, Math.ceil(total / porPaginaReal)),
    por_pagina: porPaginaReal,
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

/**
 * `?activo=` tal y como lo espera el backend.
 *
 * CUIDADO CON "TODOS". En el contrato el parámetro es `boolean` con
 * `default: true`, y NO admite null: omitirlo no significa "todos", significa
 * "solo los activos". Por eso aquí no hay un `undefined` para ese caso —
 * devolvía la lista de activos haciéndola pasar por la lista completa—. "Todos"
 * se resuelve pidiendo las dos mitades; lo hace `todasLasPaginas`.
 */
const activoDe = (estado) => estado !== 'inactivo'

/** Filtra una lista por un texto libre contra uno de sus campos. */
const buscarEn = (filas, texto, campo) => {
  const busca = String(texto ?? '').trim().toLowerCase()
  if (!busca) return filas
  return filas.filter((f) => String(f[campo] ?? '').toLowerCase().includes(busca))
}

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
 *
 * Y, cuando el filtro de Estado está en "Todos", las DOS MITADES. El backend
 * no tiene forma de decir "da igual el estado" (ver `activoDe`), así que se
 * pide `activo=true`, luego `activo=false`, y se juntan. Sin esto "Todos"
 * enseñaba exactamente lo mismo que "Activos".
 */
async function todasLasPaginas(pedir, { pagina, estado } = {}) {
  const barrido = async (activo) => {
    const primera = await pedir(pagina, activo)
    if (Array.isArray(primera) || pagina) return primera

    const { paginas } = normalizarPaginado(primera)
    if (paginas <= 1) return primera

    const resto = await Promise.all(Array.from({ length: paginas - 1 }, (_, i) => pedir(i + 2, activo)))
    return unirPaginas(primera, [primera, ...resto])
  }

  const primeraMitad = await barrido(activoDe(estado))
  // El simulador devuelve un array y ya filtra por estado en el cliente:
  // pedirle la segunda mitad duplicaría cada fila.
  if (estado !== 'todos' || pagina || Array.isArray(primeraMitad)) return primeraMitad

  return unirPaginas(primeraMitad, [primeraMitad, await barrido(false)])
}

/** Varias respuestas paginadas convertidas en una sola, ya completa. */
function unirPaginas(base, partes) {
  const items = partes.flatMap((datos) => normalizarPaginado(datos).items)
  return { ...base, items, total: items.length, pagina: 1, paginas: 1, por_pagina: items.length }
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
    (page, activo) =>
      resolver({
        mock: () => handlers.administracion.colegios(),
        real: () =>
          api.get(colegios.listar, {
            params: {
              departamento: filtros.departamento || undefined,
              distrito: filtros.distrito || undefined,
              activo,
              page: page || undefined,
            },
          }),
        forzarReal: adminContraApiReal,
      }),
    { pagina: filtros.pagina, estado: filtros.estado },
  )

  const pagina = normalizarPaginado(datos)
  const items = pagina.items.map((c) => ({ ...c, id_colegio: c.id_colegio ?? c.id }))
  // El estado ya lo resolvió el servidor contra la API real; en el simulador,
  // aquí. La BÚSQUEDA POR NOMBRE es siempre local: `GET /colegios` solo acepta
  // `departamento`, `distrito` y `activo`, no hay `q` como en alumnos y
  // usuarios. Filtrar aquí es exacto porque se traen todas las páginas.
  const porNombre = buscarEn(Array.isArray(datos) ? porEstado(items, filtros.estado) : items, filtros.q, 'nombre')
  return { ...pagina, items: porNombre }
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
/**
 * El cuerpo que esperan `POST /colegios` y `PATCH /colegios/{id}` (CU013).
 *
 * Lo único con trampa son los GRADOS: el formulario los maneja como
 * `[{id_grado, dia_clase}]` y el backend los quiere exactamente así, pero una
 * pantalla vieja (o un colegio creado antes del cambio) puede traerlos como
 * `[3, 4]`. `comoGradosConDia` normaliza las dos formas; mandar la lista de
 * números responde 422.
 *
 * `provincia` es ahora obligatoria y `distrito` opcional, justo al revés que
 * antes. Un `null` en provincia da 422, así que no se manda vacía.
 */
function cuerpoDeColegio(colegio = {}) {
  const cuerpo = { ...colegio }
  /**
   * Los grados viajan con su día de clase y sus SECCIONES por nombre.
   *
   * El backend solo agrega: las que no vienen se conservan, y "A", "a" y " a "
   * son la misma. Se mandan todas —las que ya existen y las nuevas— porque así
   * la petición es idempotente: repetirla no crea nada de más ni borra nada.
   */
  if ('grados' in cuerpo) {
    cuerpo.grados = comoGradosConDia(cuerpo.grados).map(({ id_grado, dia_clase, secciones }) => ({
      id_grado: Number(id_grado),
      dia_clase: Number(dia_clase),
      ...(secciones?.length ? { secciones: secciones.map((x) => x.nombre) } : {}),
    }))
  }
  // `programas: list[int]`, obligatorio. El multi-select los da como strings.
  if ('programas' in cuerpo) {
    cuerpo.programas = (cuerpo.programas ?? []).map((p) =>
      Number(typeof p === 'object' && p !== null ? p.id_programa ?? p.id : p),
    )
  }
  if (cuerpo.distrito === '') cuerpo.distrito = null
  // Con "" el backend responde 422; omitida, aplica "Única" al crear, y en el
  // PATCH no se toca.
  const vacio = (valor) => !String(valor ?? '').trim()
  if ('seccion' in cuerpo && vacio(cuerpo.seccion)) delete cuerpo.seccion
  // El programa es solo de Primaria: se fuerza siempre, y así un colegio que
  // quedó con otro nivel se corrige al guardarlo.
  cuerpo.nivel_educativo = 'Primaria'
  return cuerpo
}

/**
 * `GET /colegios/{id}` — el colegio COMPLETO.
 *
 * Hace falta de verdad: el listado (`ColegioItem`) no trae ni `grados` ni
 * `programas`, así que abrir "Editar" desde la tabla daba un formulario sin
 * grados, y guardar los habría borrado. El popup pide el detalle al abrirse.
 */
export const obtenerColegio = async (idColegio) => {
  const colegio = await resolver({
    mock: () => handlers.administracion.colegio(idColegio),
    real: () => api.get(colegios.detalle(idColegio)),
    forzarReal: adminContraApiReal,
  })
  if (!colegio) return colegio
  return {
    ...colegio,
    id_colegio: colegio.id_colegio ?? colegio.id,
    // El formulario los maneja como `[{id_grado, dia_clase}]`; el detalle los
    // manda como `[{id, nombre, dia_clase}]`.
    grados: comoGradosConDia(colegio.grados),
    // `ItemCatalogo {id, nombre}` → la forma que usan los desplegables. Esta es
    // la ÚNICA fuente que da los subprogramas de un colegio con su id:
    // `/me/asignaciones` los manda por nombre, y casar por texto se rompe en
    // cuanto alguien renombre uno.
    programas: (colegio.programas ?? []).map((p) => ({
      id_programa: Number(p.id_programa ?? p.id),
      nombre: p.nombre,
    })),
    /**
     * `colegio.seccion` DESAPARECIÓ del contrato con T3. Las secciones son
     * ahora de cada grado y vienen dentro de `grados[].secciones`.
     */
  }
}

export const crearColegio = (colegio) =>
  resolver({
    mock: () => handlers.administracion.crearColegio(cuerpoDeColegio(colegio)),
    real: () => api.post(colegios.crear, cuerpoDeColegio(colegio)),
    forzarReal: adminContraApiReal,
  })

/** `PATCH /colegios/{id}` — parcial. Mandar `null` en un obligatorio da 422. */
export const actualizarColegio = (idColegio, cambios) =>
  resolver({
    mock: () => handlers.administracion.actualizarColegio(idColegio, cuerpoDeColegio(cambios)),
    real: () => api.patch(colegios.actualizar(idColegio), cuerpoDeColegio(cambios)),
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
    /**
     * La sección pasó de texto a objeto `{id, nombre}` cuando T3 la convirtió
     * en entidad. Se guardan las dos caras: el id para mandarlo al servidor y
     * el nombre para pintarlo.
     */
    id_seccion: a.id_seccion ?? idDe(a.seccion),
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
    (page, activo) =>
      resolver({
        mock: () => handlers.administracion.alumnos(),
        real: () =>
          api.get(alumnos.listar, {
            // Nombres y tipos exactos de `GET /alumnos` (openapi.json):
            // `id_colegio`, `id_programa` e `id_grado` son enteros y `ciclo`
            // es TEXTO ("III" | "IV" | "V"). Mandar `ciclo=2` daba 422.
            params: {
              id_colegio: filtros.id_colegio || filtros.colegio || undefined,
              id_programa: filtros.id_programa || filtros.subprograma || filtros.programa || undefined,
              ciclo: cicloComoTexto(filtros.id_ciclo || filtros.ciclo),
              id_grado: filtros.id_grado || filtros.grado || undefined,
              activo,
              q: String(filtros.q ?? '').trim() || undefined,
              page: page || undefined,
            },
          }),
        forzarReal: adminContraApiReal,
      }),
    { pagina: filtros.pagina, estado: filtros.estado },
  )

  const pagina = normalizarPaginado(datos)
  const items = pagina.items.map(normalizarAlumno)
  // Con la API real el servidor ya filtró todo, búsqueda incluida.
  return { ...pagina, items: Array.isArray(datos) ? filtrarAlumnos(items, filtros) : items }
}

/** El filtro de ciclo usa ids (1, 2, 3) en la pantalla; el backend, "III", "IV", "V". */
function cicloComoTexto(valor) {
  if (valor == null || valor === '') return undefined
  return CICLO_POR_ID[valor] ?? String(valor)
}

/**
 * `POST /alumnos`.
 *
 * NO se manda el ciclo: lo calcula el backend (Alfabetización → III;
 * Comprensión Lectora → 2.º III, 3.º y 4.º IV, 5.º y 6.º V). 1.º grado solo
 * admite Alfabetización, y el colegio debe ofrecer ese grado y ese
 * subprograma.
 *
 * DOS CAMPOS NUEVOS desde T3, y los dos obligatorios en la práctica:
 *
 *   · `pertenece_desde` — desde cuándo el alumno está en ese grupo. Es lo que
 *     sostiene todo el historial de pertenencia: sin esa fecha no se puede
 *     saber quién estaba en un aula el día de una clase, que es de lo que
 *     dependen las tablas históricas de Lectura, Rúbrica y Registro de Vuelo.
 *     No puede ser futura.
 *   · `id_seccion` — se puede omitir si el grado tiene UNA sola sección, pero
 *     con varias el servidor responde 422. Se manda siempre que se tenga.
 */
export const crearAlumno = ({
  nombres,
  apellidos,
  id_colegio: idColegio,
  id_grado: idGrado,
  id_programa: idPrograma,
  id_seccion: idSeccion,
  pertenece_desde: perteneceDesde,
}) =>
  resolver({
    mock: () =>
      handlers.administracion.crearAlumno({
        nombres,
        apellidos,
        id_colegio: idColegio,
        id_grado: idGrado,
        id_programa: idPrograma,
        id_seccion: idSeccion,
        pertenece_desde: perteneceDesde,
      }),
    real: () =>
      api.post(alumnos.crear, {
        nombres,
        apellidos,
        id_colegio: Number(idColegio),
        id_grado: Number(idGrado),
        // `AlumnoCrear` pide `id_programa` (no `id_programa_actual`): con el
        // nombre viejo el alta respondía 422 por falta de un campo obligatorio.
        id_programa: Number(idPrograma),
        ...(idSeccion ? { id_seccion: Number(idSeccion) } : {}),
        ...(perteneceDesde ? { pertenece_desde: perteneceDesde } : {}),
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /alumnos/{id}` — el alumno completo.
 *
 * Hace falta por un campo concreto: `pertenece_desde`, el inicio de su grupo
 * actual. El backend lo añadió "para validar `cambio_grupo_desde` en el
 * front", y es el mínimo de esa fecha: mover a alguien a un grupo nuevo desde
 * antes de que empezara el anterior no significa nada.
 *
 * Llega en `null` si el alumno está inactivo, porque entonces no tiene grupo
 * en curso.
 */
export const obtenerAlumno = async (idAlumno) => {
  const alumno = await resolver({
    mock: () => handlers.administracion.alumno(idAlumno),
    real: () => api.get(alumnos.detalle(idAlumno)),
    forzarReal: adminContraApiReal,
  })
  return alumno ? normalizarAlumno(alumno) : alumno
}

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
  if (cambios.id_seccion) cuerpo.id_seccion = Number(cambios.id_seccion)
  const idPrograma = cambios.id_programa ?? cambios.id_programa_actual
  if (idPrograma) cuerpo.id_programa = Number(idPrograma)
  /**
   * Cambiar de GRUPO —colegio, grado, sección o subprograma— exige decir desde
   * cuándo. Corregir solo el nombre, no: por eso viaja aparte y solo cuando la
   * pantalla lo manda.
   */
  if (cambios.cambio_grupo_desde) cuerpo.cambio_grupo_desde = cambios.cambio_grupo_desde
  return cuerpo
}

/** Los campos que, al cambiar, convierten una edición en un cambio de grupo. */
export const CAMPOS_DE_GRUPO = ['id_colegio', 'id_grado', 'id_seccion', 'id_programa']
/**
 * ¿La edición mueve al alumno de grupo?
 *
 * El grupo son cuatro campos: colegio, grado, sección y subprograma. Tocar
 * cualquiera de ellos abre un intervalo nuevo en su historial de pertenencia y
 * el backend pide la fecha efectiva. Se comparan como texto porque el
 * formulario devuelve cadenas donde el registro trae números.
 */
export const cambiaDeGrupo = (antes, ahora) =>
  Boolean(antes) &&
  CAMPOS_DE_GRUPO.some((campo) => {
    const previo = antes[campo]
    const nuevo = ahora?.[campo]
    // Un campo que el formulario todavía no tocó no cuenta como cambio.
    if (nuevo === undefined || nuevo === null || nuevo === '') return false
    return String(previo ?? '') !== String(nuevo)
  })

/**
 * Cuándo se creó el alumno, en `YYYY-MM-DD` (D65).
 *
 * Es la fecha que el formulario propone cuando al alumno le falta el inicio de
 * su pertenencia: la única que se sabe cierta. El nombre del campo no está en
 * el contrato publicado —se pidió al backend—, así que se aceptan las tres
 * formas en que suele venir y, si no viene ninguna, se devuelve vacío y la
 * elige la persona. Proponer hoy sería inventar un historial que no ocurrió.
 */
export const fechaDeCreacion = (registro) => {
  const valor = registro?.creado_en ?? registro?.fecha_creacion ?? registro?.creado ?? null
  if (!valor) return ''
  // Puede llegar como instante (`2026-03-02T08:15:00-05:00`) o como día suelto.
  return String(valor).slice(0, 10)
}

/**
 * Activar o inactivar a un alumno. AHORA LLEVA CUERPO, y es obligatorio.
 *
 * `aplicar_desde` es la fecha efectiva de la baja o el alta, no la del clic.
 * Importa para el historial: un alumno que se fue el día 3 pero se inactiva el
 * día 20 no estuvo en el aula esas dos semanas, y las tablas de esas fechas
 * tienen que reflejarlo.
 *
 * Se envía la fecha de HOY según el reloj del servidor cuando la pantalla no
 * da otra. Es el caso corriente y evita que la operación falle con un 422,
 * pero no sustituye al selector de fecha efectiva, que es trabajo pendiente.
 */
export const cambiarEstadoAlumno = (idAlumno, activo, { aplicarDesde } = {}) => {
  const cuerpo = { aplicar_desde: aplicarDesde || hoy() }
  return resolver({
    mock: () => handlers.administracion.actualizarAlumno(idAlumno, { activo, ...cuerpo }),
    real: () => api.patch(activo ? alumnos.activar(idAlumno) : alumnos.desactivar(idAlumno), cuerpo),
    forzarReal: adminContraApiReal,
  })
}

/**
 * Historial del alumno (CU015), construido a partir de la auditoría.
 *
 * Exige conexión: sin ella, la pestaña muestra su estado vacío. El backend
 * agrupa por evento, así que varias filas con la misma fecha y autor llegan
 * como una sola edición con el detalle de los campos cambiados.
 */
export const listarHistorialAlumno = async (idAlumno) => {
  const datos = await resolver({
    mock: () => handlers.administracion.auditoria('alumno', idAlumno),
    real: () => api.get(alumnos.historial(idAlumno)),
    forzarReal: adminContraApiReal,
  })
  // D29: la respuesta es un PAGINADO, no una lista. Devolverla tal cual hacía
  // que la tabla llamara a `.slice()` sobre un objeto y tumbara la pantalla
  // entera con "No se pudo mostrar esta pantalla".
  return normalizarPaginado(datos).items.map((evento) => ({
    ...evento,
    cambios: Array.isArray(evento.cambios) ? evento.cambios : [],
  }))
}

/**
 * Auditoría de un registro, para la pestaña de la plantilla de mantenimiento.
 *
 * El backend publica auditoría SOLO del alumno: es lo único que piden los CU.
 * Para colegios y usuarios devuelve lista vacía a propósito, y la pestaña
 * muestra su estado vacío en vez de inventarse un historial.
 */
export const listarAuditoria = async (entidad, id) => {
  if (entidad === 'alumno') return listarHistorialAlumno(id)
  const datos = await resolver({
    mock: () => handlers.administracion.auditoria(entidad, id),
    real: () => Promise.resolve({ items: [] }),
    forzarReal: adminContraApiReal,
  })
  // Siempre una LISTA, venga de donde venga: la pestaña no tiene por qué saber
  // si el origen pagina o no (D29).
  return normalizarPaginado(datos).items
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
    (page, activo) =>
      resolver({
        mock: () => handlers.administracion.usuarios(),
        real: () =>
          api.get(usuarios.listar, {
            params: {
              rol: filtros.rol || undefined,
              activo,
              q: filtros.q || undefined,
              page: page || undefined,
            },
          }),
        forzarReal: adminContraApiReal,
      }),
    { pagina: filtros.pagina, estado: filtros.estado },
  )

  const pagina = normalizarPaginado(datos)
  const items = pagina.items.map((u) => ({
    ...conNombre(u),
    // `UsuarioItem` trae `id` y el rol como texto. Sin esto, activar o
    // desactivar enviaba `PATCH /usuarios/undefined/desactivar` (422).
    id_usuario: u.id_usuario ?? u.id,
    id_rol: u.id_rol ?? ID_ROL_POR_NOMBRE[u.rol] ?? null,
    colegios_asignados: Array.isArray(u.colegios_asignados) ? u.colegios_asignados : [],
    es_supervisor_original: Boolean(u.es_supervisor_original),
    // CU001/CU016: todavía no ha cambiado su contraseña temporal.
    debe_cambiar_contrasena: Boolean(u.debe_cambiar_contrasena),
  }))

  // Con la API real el servidor ya filtró. El simulador devuelve la lista
  // entera, así que rol, búsqueda y estado se aplican aquí: sin esto, el
  // desplegable de docentes ofrecía también supervisores y directivos.
  return { ...pagina, items: Array.isArray(datos) ? filtrarUsuarios(items, filtros) : items }
}

/** Rol, estado y búsqueda por nombre o correo sobre una lista ya traída. */
function filtrarUsuarios(filas, filtros = {}) {
  const texto = String(filtros.q ?? '').trim().toLowerCase()
  return porEstado(filas, filtros.estado).filter(
    (u) =>
      (!filtros.rol || u.rol === filtros.rol) &&
      (!texto || `${u.nombre ?? ''} ${u.correo ?? ''}`.toLowerCase().includes(texto)),
  )
}

const ID_ROL_POR_NOMBRE = { Docente: 1, Supervisor: 2, Directivo: 3 }

/**
 * `id_anio_escolar` a partir del año que escribe el Supervisor (p. ej. 2026).
 * Sin año, el vigente. El catálogo es `GET /anios-escolares` →
 * `[{id, nombre, vigente}]`.
 */
/**
 * `GET /anios-escolares` — los años con los que trabaja el programa.
 *
 * Traía `api.get` a pelo, sin `resolver`, así que contra el simulador reventaba
 * en vez de devolver nada. Ahora pasa por el mismo camino que todo lo demás.
 *
 * El vigente viene marcado con `vigente: true`: es el que los formularios
 * proponen por defecto, porque es el año en el que casi siempre se trabaja.
 */
export const listarAniosEscolares = () =>
  resolver({
    mock: () => handlers.anios(),
    real: () => api.get(ENDPOINTS.catalogos.anios),
    forzarReal: adminContraApiReal,
  })

/** El año vigente de una lista, o el primero si ninguno lo está. */
export const anioVigente = (anios = []) => anios.find((a) => a.vigente) ?? anios[0] ?? null

async function idAnioEscolar(anio) {
  const anios = (await listarAniosEscolares()) ?? []
  const texto = String(anio ?? '').trim()
  const elegido = texto ? anios.find((a) => String(a.nombre).includes(texto)) : anioVigente(anios)
  return elegido?.id ?? anioVigente(anios)?.id ?? null
}

/**
 * `asignacion` de `UsuarioCrear` / `UsuarioEditar`, o null si no corresponde.
 *
 * UN DOCENTE PUEDE TENER VARIOS COLEGIOS (D67, tanda G1). El contrato cambió
 * de forma, no se amplió: `desde_periodo` ya no existe, ni `id_colegio` ni
 * `grados` sueltos en la raíz. Un cuerpo con la forma vieja responde 422.
 *
 *   {"id_anio_escolar": 2,
 *    "colegios": [{"id_colegio": 1, "grados": [1, 2]},
 *                 {"id_colegio": 4, "grados": [5], "inicio_asignacion": "retroactivo"}]}
 *
 * En la EDICIÓN, `colegios` es la lista COMPLETA del año: el colegio que no
 * venga se libera de sus PA no terminados. No es un añadido incremental, y por
 * eso el formulario manda siempre todos los que tiene puestos.
 */
async function asignacionDe(datos, { obligatoria }) {
  if (Number(datos.id_rol) !== 1 && obligatoria) return null

  /**
   * Se acepta la forma nueva (`colegios`) y, mientras queden pantallas sin
   * migrar, también un colegio suelto en la raíz, que se convierte aquí.
   */
  const crudos = Array.isArray(datos.colegios) && datos.colegios.length
    ? datos.colegios
    : datos.id_colegio
      ? [{ id_colegio: datos.id_colegio, grados: datos.grados, inicio_asignacion: datos.inicio_asignacion }]
      : []

  if (!crudos.length) return null

  const colegios = crudos
    .map((c) => {
      const grados = (Array.isArray(c.grados) ? c.grados : []).map(Number).filter(Boolean)
      const bloque = { id_colegio: Number(c.id_colegio) }
      // Sin grados elegidos se OMITE el campo y el backend decide. NUNCA se
      // manda `[]` ni `null`: los dos responden 422.
      if (grados.length) bloque.grados = grados
      /**
       * DESDE QUÉ PERIODO empieza, y es POR COLEGIO: cada uno tiene su
       * calendario, así que uno puede estar en receso y otro en un PA.
       *
       *   · `retroactivo` — crea además la fila del PA recién culminado para
       *     regularizarlo. Solo habilita escribir mientras dure ese receso.
       *   · `proximo` — desde el PA siguiente. En el PR4 no hay PA siguiente
       *     y el backend lo rechaza: hay que elegir el año escolar que viene.
       *
       * En un PA o en un año sin empezar el backend lo ignora, así que no se
       * manda; si el colegio está en PR y falta, responde 422
       * `inicio_asignacion_requerido` con el índice de SU bloque.
       */
      if (c.inicio_asignacion) bloque.inicio_asignacion = c.inicio_asignacion
      return bloque
    })
    .filter((c) => Number.isFinite(c.id_colegio) && c.id_colegio > 0)

  if (!colegios.length) return null

  return { id_anio_escolar: await idAnioEscolar(datos.anio_escolar), colegios }
}

/**
 * `GET /colegios/estado-calendario` — en qué periodo está HOY cada colegio.
 *
 * Hace falta para una sola pregunta del formulario de Usuarios: si el colegio
 * elegido está en receso, hay que preguntar si la asignación es retroactiva o
 * empieza en el próximo periodo. Cada colegio tiene su propio calendario, así
 * que no se puede deducir de un periodo global —ya no existe—.
 *
 * `estado_calendario` llega en `null` cuando ese colegio no tiene calendario
 * configurado para el año.
 */
/**
 * ¿Ese colegio está HOY en receso? Devuelve el PR, o `null`.
 *
 * Es la única pregunta que decide si el formulario de Usuarios tiene que pedir
 * "desde qué periodo": en un PA no hay ambigüedad y el backend ignora el
 * campo, y sin calendario configurado tampoco hay nada que preguntar.
 */
export function recesoDelColegio(estados, idColegio) {
  const estado = (estados ?? []).find((c) => String(c.id) === String(idColegio))?.estado_calendario
  return estado?.tipo === 'PR' ? estado : null
}

/**
 * Las opciones de "desde qué periodo" para un receso.
 *
 * En el PR4 NO se ofrece "Próximo": no existe un PA siguiente dentro de ese
 * año escolar y el backend lo rechaza pidiendo que se elija el año que viene.
 * Ofrecerlo sería invitar al error.
 */
export const opcionesDeInicio = (receso) =>
  receso
    ? [
        { value: 'retroactivo', label: `Retroactivo: regularizar el PA${receso.numero ?? ''} que acaba de terminar` },
        ...(receso.es_pr4 ? [] : [{ value: 'proximo', label: 'Próximo: empezar en el siguiente periodo' }]),
      ]
    : []

export const listarEstadoCalendario = (idAnioEscolar) =>
  resolver({
    mock: () => handlers.administracion.estadoCalendario(idAnioEscolar),
    real: () =>
      api.get(colegios.estadoCalendario, {
        params: idAnioEscolar ? { id_anio_escolar: Number(idAnioEscolar) } : {},
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * Filtro por colegio de Usuarios, en el cliente: `GET /usuarios` no lo admite.
 *
 * Los Docentes se quedan si ese colegio está entre sus `colegios_asignados`.
 * Supervisor y Directivo son GLOBALES (`["Global"]`): siempre se quedan, y el
 * filtro de Rol ya decide si deben verse.
 */
export function filtrarUsuariosPorColegio(filas, nombreColegio) {
  if (!nombreColegio) return filas
  return filas.filter((u) => {
    const colegios = u.colegios_asignados ?? []
    if (Number(u.id_rol) !== 1 || colegios.includes('Global')) return true
    return colegios.includes(nombreColegio)
  })
}

const textoONulo = (v) => (v == null || String(v).trim() === '' ? undefined : String(v).trim())

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
export const crearUsuario = async (datos) => {
  const respuesta = await resolver({
    mock: () => handlers.administracion.crearUsuario(datos),
    // Cuerpo exacto de `UsuarioCrear`: nombres, apellidos, dni, correo,
    // id_rol y, para un Docente, `asignacion: {id_colegio, id_anio_escolar,
    // grados}`. Antes se mandaban sueltos y sin DNI: 422.
    real: async () =>
      api.post(usuarios.crear, {
        nombres: textoONulo(datos.nombres),
        apellidos: textoONulo(datos.apellidos),
        dni: textoONulo(datos.dni),
        correo: textoONulo(datos.correo),
        id_rol: Number(datos.id_rol),
        asignacion: await asignacionDe(datos, { obligatoria: true }),
      }),
    forzarReal: adminContraApiReal,
  })
  // `UsuarioCreado` envuelve al usuario: `{usuario, correo_enviado, contraseña_temporal}`.
  return respuesta?.usuario ? { ...respuesta, correo: respuesta.usuario.correo } : respuesta
}

/**
 * `GET /usuarios/{id}` — `UsuarioDetalle`, con la asignación del Docente.
 *
 * El listado solo trae el NOMBRE del colegio, así que "Editar" salía sin año ni
 * grados. Se devuelve en la forma del formulario: colegio y grados del periodo
 * vigente (o del primero) como strings, y el año escolar en 4 dígitos.
 */
export const obtenerUsuario = async (idUsuario) => {
  const usuario = await resolver({
    // El simulador no tiene detalle: el popup se queda con la fila.
    mock: async () => null,
    real: () => api.get(usuarios.detalle(idUsuario)),
    forzarReal: adminContraApiReal,
  })
  if (!usuario) return usuario
  const asignacion = usuario.asignacion ?? null

  let anio = ''
  if (asignacion?.id_anio_escolar != null) {
    const anios = (await api.get(ENDPOINTS.catalogos.anios))?.data ?? []
    const nombre = anios.find((a) => a.id === asignacion.id_anio_escolar)?.nombre
    anio = /\d{4}/.exec(String(nombre ?? ''))?.[0] ?? ''
  }

  /**
   * `asignacion` viene AGRUPADA POR COLEGIO (tanda G1).
   *
   * Antes era `asignacion.periodos[]` con un `id_colegio` dentro de cada
   * periodo, y aquí se aplanaba a UN colegio: el Docente con dos perdía el
   * segundo al abrir su ficha, y al guardar se lo quitaba sin que nadie lo
   * pidiera. Ahora cada elemento de `colegios` es un colegio seleccionado, y
   * sus grados salen del periodo vigente o, si no hay, del primero.
   */
  const colegios = (asignacion?.colegios ?? []).map((c) => {
    const periodos = c.periodos ?? []
    const periodo = periodos.find((p) => p.vigente) ?? periodos[0]
    return {
      id_colegio: String(c.id_colegio),
      nombre: c.colegio,
      grados: (periodo?.grados ?? []).map((g) => String(g.id_grado)),
      // `retroactiva: true` significa que ese PA está habilitado con
      // "Retroactivo", y el formulario lo propone al reabrirlo.
      inicio_asignacion: periodo?.retroactiva ? 'retroactivo' : '',
    }
  })

  return {
    ...usuario,
    colegios,
    // La forma plana se conserva para lo que todavía la lee (el primero).
    id_colegio: colegios[0]?.id_colegio ?? '',
    grados: colegios[0]?.grados ?? [],
    anio_escolar: anio,
  }
}

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
    // Solo campos de `UsuarioEditar`. El formulario lleva además `id_rol`
    // vacío (no se edita) y los campos del Docente; mandarlos tal cual daba
    // 422. La asignación solo viaja si se eligió un colegio (rotar/renovar).
    real: async () => {
      const cuerpo = {
        nombres: textoONulo(cambios.nombres),
        apellidos: textoONulo(cambios.apellidos),
        dni: textoONulo(cambios.dni),
        correo: textoONulo(cambios.correo),
      }
      const asignacion = await asignacionDe(cambios, { obligatoria: false })
      if (asignacion) cuerpo.asignacion = asignacion
      return api.patch(usuarios.actualizar(id), cuerpo)
    },
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
