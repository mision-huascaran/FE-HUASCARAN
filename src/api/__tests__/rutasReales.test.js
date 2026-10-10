// Verifica que los recursos llamen a las RUTAS Y PARÁMETROS correctos.
//
// Estos tests existen por un fallo real: se mandaba `PATCH /colegios/{id}`
// con `{activo}` para dar de baja un colegio, y el servidor respondía 200 sin
// cambiar nada, porque la baja tiene ruta propia. Un fallo silencioso que
// ninguna prueba de interfaz habría detectado, porque la pantalla se comporta
// igual.
//
// Se fuerza la rama de API real sustituyendo `resolver`, que en pruebas
// siempre tira del simulador.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn(() => Promise.resolve({ data: {} }))
const post = vi.fn(() => Promise.resolve({ data: {} }))
const patch = vi.fn(() => Promise.resolve({ data: {} }))

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get, post, patch },
  // Siempre la rama real: es lo que se quiere comprobar.
  resolver: ({ real }) => Promise.resolve(real()).then((r) => r?.data),
  adminContraApiReal: true,
  authContraApiReal: true,
}))

const {
  actualizarAlumno,
  actualizarUsuario,
  crearAlumno,
  crearUsuario,
  desactivarUsuario,
  cambiarEstadoColegio,
  cambiarEstadoAlumno,
  listarAlumnosAdmin,
  listarColegiosAdmin,
  listarUsuariosAdmin,
  listarMisAsignaciones,
} = await import('../resources/administracion')
const { iniciarActividad, finalizarActividad, listarActividades, obtenerActividad } =
  await import('../resources/actividades')
const { listarSeguimiento, obtenerDocenteSeguimiento, listarActividadesDe } =
  await import('../resources/seguimiento')
const { obtenerInicioDocente, obtenerInicioSupervisor, obtenerInicioDirectivo } =
  await import('../resources/inicio')
const { recuperarConLlave } = await import('../resources/auth')
const { obtenerResumenDocente } = await import('../resources/docentes')

beforeEach(() => {
  get.mockClear()
  post.mockClear()
  patch.mockClear()
})

describe('Bajas lógicas: tienen ruta propia', () => {
  it('inactivar un colegio usa /desactivar, no PATCH con {activo}', async () => {
    await cambiarEstadoColegio(3, false)
    expect(patch).toHaveBeenCalledWith('/colegios/3/desactivar')
  })

  it('activar un colegio usa /activar', async () => {
    await cambiarEstadoColegio(3, true)
    expect(patch).toHaveBeenCalledWith('/colegios/3/activar')
  })

  it('lo mismo con los alumnos', async () => {
    await cambiarEstadoAlumno(9, false)
    expect(patch).toHaveBeenCalledWith('/alumnos/9/desactivar')
    await cambiarEstadoAlumno(9, true)
    expect(patch).toHaveBeenCalledWith('/alumnos/9/activar')
  })
})

describe('Actividades (CU009, CU017-CU019)', () => {
  it('el id lo genera el cliente, para que reintentar no duplique', async () => {
    await iniciarActividad({ id: 'uuid-1' })
    expect(post).toHaveBeenCalledWith('/actividades', { id_actividad: 'uuid-1' })
  })

  it('manda `inicio` solo si se le da, y con zona', async () => {
    await iniciarActividad({ id: 'uuid-1', inicio: '2026-10-08T13:00:00Z' })
    expect(post).toHaveBeenCalledWith('/actividades', { id_actividad: 'uuid-1', inicio: '2026-10-08T13:00:00Z' })
  })

  it('finalizar sin `fin` deja que el servidor ponga la hora', async () => {
    await finalizarActividad('uuid-1')
    expect(post).toHaveBeenCalledWith('/actividades/uuid-1/finalizar', {})
  })

  it('los filtros del listado viajan como query', async () => {
    await listarActividades({ desde: '2026-10-01', estado: 'finalizada', pagina: 2 })
    const [ruta, config] = get.mock.calls.at(-1)
    expect(ruta).toBe('/actividades')
    expect(config.params).toMatchObject({ desde: '2026-10-01', estado: 'finalizada', page: 2 })
    // Lo vacío no se manda: omitirlo es "Todos".
    expect(config.params.hasta).toBeUndefined()
  })

  it('el detalle va por id', async () => {
    await obtenerActividad('uuid-9')
    expect(get).toHaveBeenCalledWith('/actividades/uuid-9')
  })
})

describe('Seguimiento (CU020, CU021)', () => {
  it('lista por las rutas de seguimiento', async () => {
    await listarSeguimiento({ id_colegio: 2 })
    expect(get.mock.calls.at(-1)[0]).toBe('/seguimiento/docentes')
    await obtenerDocenteSeguimiento(5)
    expect(get).toHaveBeenCalledWith('/seguimiento/docentes/5')
    await listarActividadesDe(5, {})
    expect(get.mock.calls.at(-1)[0]).toBe('/seguimiento/docentes/5/actividades')
  })
})

describe('Inicio por rol y asignaciones', () => {
  it('cada rol tiene su endpoint', async () => {
    await obtenerInicioDocente()
    expect(get).toHaveBeenCalledWith('/inicio/docente')
    await obtenerInicioSupervisor()
    expect(get).toHaveBeenCalledWith('/inicio/supervisor')
    await obtenerInicioDirectivo()
    expect(get).toHaveBeenCalledWith('/inicio/directivo')
  })

  it('las asignaciones salen del token, no de un id de docente', async () => {
    await listarMisAsignaciones()
    expect(get).toHaveBeenCalledWith('/me/asignaciones')
  })
})

describe('Listados paginados', () => {
  it('colegios y usuarios mandan `page` y `activo`', async () => {
    await listarColegiosAdmin({ estado: 'inactivo', pagina: 3 })
    expect(get.mock.calls.at(-1)[1].params).toMatchObject({ activo: false, page: 3 })

    await listarUsuariosAdmin({ rol: 'Docente', estado: 'activo' })
    expect(get.mock.calls.at(-1)[1].params).toMatchObject({ rol: 'Docente', activo: true })
  })

  /**
   * El fallo que motivó estas dos pruebas: en el contrato `activo` es un
   * boolean con `default: true` y NO admite null, así que NO mandarlo no
   * significa "todos" sino "solo los activos". "Todos" enseñaba lo mismo que
   * "Activos" y nadie lo notaba, porque casi todo está activo.
   */
  it('"Todos" nunca omite `activo`: pide las dos mitades', async () => {
    get.mockImplementation((_ruta, config) => {
      const activo = config?.params?.activo
      return Promise.resolve({
        data: {
          items: activo
            ? [{ id: 1, nombre: 'Colegio Vivo', activo: true }]
            : [{ id: 2, nombre: 'Colegio Cerrado', activo: false }],
          total: 1,
          page: 1,
          page_size: 10,
          total_pages: 1,
        },
      })
    })

    const { items } = await listarColegiosAdmin({ estado: 'todos' })

    const pedidos = get.mock.calls.map((c) => c[1].params.activo)
    expect(pedidos).toEqual([true, false])
    expect(items.map((c) => c.nombre)).toEqual(['Colegio Vivo', 'Colegio Cerrado'])
  })

  it('"Activos" e "Inactivos" siguen pidiendo una sola mitad', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0, page: 1, page_size: 10, total_pages: 1 } })

    await listarColegiosAdmin({ estado: 'activo' })
    expect(get.mock.calls.map((c) => c[1].params.activo)).toEqual([true])

    get.mockClear()
    await listarColegiosAdmin({ estado: 'inactivo' })
    expect(get.mock.calls.map((c) => c[1].params.activo)).toEqual([false])
  })

  it('la búsqueda de colegios se aplica en el cliente: GET /colegios no tiene `q`', async () => {
    get.mockResolvedValue({
      data: {
        items: [
          { id: 1, nombre: 'IE San Martín', activo: true },
          { id: 2, nombre: 'IE Túpac Amaru', activo: true },
        ],
        total: 2,
        page: 1,
        page_size: 10,
        total_pages: 1,
      },
    })

    const { items } = await listarColegiosAdmin({ estado: 'activo', q: 'túpac' })

    expect(get.mock.calls.at(-1)[1].params).not.toHaveProperty('q')
    expect(items.map((c) => c.nombre)).toEqual(['IE Túpac Amaru'])
  })
})

describe('Recovery Key (CU001)', () => {
  it('manda los campos con ñ que espera el backend', async () => {
    await recuperarConLlave({ correo: 'a@b.test', llave: 'K-1', passwordNueva: 'Ab1!abcd', confirmacion: 'Ab1!abcd' })
    expect(post).toHaveBeenCalledWith('/password/recuperar-con-llave', {
      correo: 'a@b.test',
      llave: 'K-1',
      'contraseña_nueva': 'Ab1!abcd',
      'confirmar_contraseña_nueva': 'Ab1!abcd',
    })
  })
})

describe('Contrato real de Alumnos y asignaciones (hallazgos del 09/10/2026)', () => {
  it('D10 / "[object Object].° grado": las asignaciones anidadas se aplanan', async () => {
    get.mockResolvedValueOnce({
      data: {
        asignaciones: [
          {
            colegio: { id: 7, nombre: 'Colegio de Prueba' },
            grados: [{ id: 1, nombre: '1.º', cantidad_alumnos: 3, ciclos: ['III'], subprogramas: ['Alfabetización'] }],
          },
        ],
      },
    })
    const [asignacion] = await listarMisAsignaciones()
    expect(asignacion).toMatchObject({ id_colegio: 7, colegio: 'Colegio de Prueba', grados: [1] })
    expect(asignacion.detalle_grados[0]).toMatchObject({ id_grado: 1, nombre: '1.º', cantidad_alumnos: 3 })
  })

  it('D11: la fila del alumno trae `id_alumno` aunque el backend mande `id`', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 42,
            nombres: 'Ana',
            apellidos: 'Quispe',
            colegio: { id: 7, nombre: 'Colegio de Prueba' },
            grado: { id: 1, nombre: '1.º' },
            subprograma: { id: 1, nombre: 'Alfabetización' },
            ciclo: { id: 1, nombre: 'III' },
            activo: true,
          },
        ],
        total: 1,
      },
    })
    const { items } = await listarAlumnosAdmin({ estado: 'activo' })
    expect(items[0]).toMatchObject({ id_alumno: 42, id_colegio: 7, id_grado: 1, id_programa: 1, ciclo: 'III' })

    await cambiarEstadoAlumno(items[0].id_alumno, false)
    expect(patch).toHaveBeenCalledWith('/alumnos/42/desactivar')
  })

  it('los filtros llegan con los nombres y tipos de GET /alumnos (openapi.json)', async () => {
    // `ciclo` es TEXTO ("III" | "IV" | "V"): mandar `ciclo=2` respondía 422.
    await listarAlumnosAdmin({ id_colegio: '7', id_grado: '1', id_ciclo: '2', id_programa: '2', estado: 'activo', q: 'ana' })
    const { params } = get.mock.calls.at(-1)[1]
    expect(params).toMatchObject({ id_colegio: '7', id_grado: '1', ciclo: 'IV', id_programa: '2', activo: true, q: 'ana' })
    expect(params).not.toHaveProperty('colegio')
    expect(params).not.toHaveProperty('grado')
    expect(params).not.toHaveProperty('subprograma')
  })

  it('crear un alumno manda `id_programa`, como pide AlumnoCrear', async () => {
    await crearAlumno({ nombres: 'Ana', apellidos: 'Quispe', id_colegio: '7', id_grado: '1', id_programa: '1' })
    expect(post).toHaveBeenCalledWith('/alumnos', { nombres: 'Ana', apellidos: 'Quispe', id_colegio: 7, id_grado: 1, id_programa: 1 })
  })

  it('editar no envía los campos de solo lectura (sección, ciclo)', async () => {
    await actualizarAlumno(42, { nombres: 'Ana', apellidos: 'Quispe', id_colegio: '7', id_grado: '1', id_programa: '1', seccion: 'Única', ciclo: 'III' })
    expect(patch).toHaveBeenCalledWith('/alumnos/42', {
      nombres: 'Ana',
      apellidos: 'Quispe',
      id_colegio: 7,
      id_grado: 1,
      id_programa: 1,
    })
  })

  it('Usuarios (y los demás listados) traen todas las páginas, no solo las 10 primeras', async () => {
    const pagina = (n) => ({
      data: {
        // Forma exacta de `Paginado_UsuarioItem_` en openapi.json.
        items: Array.from({ length: n === 3 ? 2 : 10 }, (_, i) => ({ id: (n - 1) * 10 + i + 1, nombres: 'U', rol: 'Docente' })),
        total: 22,
        page: n,
        page_size: 10,
        total_pages: 3,
      },
    })
    get.mockImplementation((_ruta, config) => Promise.resolve(pagina(config?.params?.page ?? 1)))

    const { items } = await listarUsuariosAdmin({ estado: 'activo' })
    expect(items).toHaveLength(22)
    expect(get.mock.calls.map(([, config]) => config.params.page ?? 1).sort()).toEqual([1, 2, 3])

    get.mockImplementation(() => Promise.resolve({ data: {} }))
  })
})

describe('Contrato real de Usuarios (CU016)', () => {
  it('la fila trae `id_usuario` e `id_rol` aunque el backend mande `id` y `rol`', async () => {
    get.mockResolvedValueOnce({
      data: { items: [{ id: 15, nombres: 'Rosa', apellidos: 'Camones', rol: 'Docente', activo: true }], total: 1, page: 1, page_size: 10, total_pages: 1 },
    })
    const { items } = await listarUsuariosAdmin({ estado: 'activo' })
    expect(items[0]).toMatchObject({ id_usuario: 15, id_rol: 1 })

    // Antes: PATCH /usuarios/undefined/desactivar → 422.
    await desactivarUsuario(items[0].id_usuario)
    expect(patch).toHaveBeenCalledWith('/usuarios/15/desactivar')
  })

  it('crear un Docente manda el cuerpo de UsuarioCrear, con DNI y `asignacion`', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 3, nombre: '2026', vigente: true }] })
    post.mockResolvedValueOnce({ data: { usuario: { id: 20, correo: 'rosa@sicedu.test' }, correo_enviado: true } })

    await crearUsuario({
      nombres: 'Rosa',
      apellidos: 'Camones',
      dni: '12345678',
      correo: 'rosa@sicedu.test',
      id_rol: '1',
      anio_escolar: '2026',
      id_colegio: '7',
      grados: ['1', '2'],
    })

    expect(get).toHaveBeenCalledWith('/anios-escolares')
    expect(post).toHaveBeenCalledWith('/usuarios', {
      nombres: 'Rosa',
      apellidos: 'Camones',
      dni: '12345678',
      correo: 'rosa@sicedu.test',
      id_rol: 1,
      asignacion: { id_colegio: 7, id_anio_escolar: 3, grados: [1, 2] },
    })
  })

  it('crear un Supervisor no manda asignación', async () => {
    post.mockResolvedValueOnce({ data: { usuario: { id: 21 }, correo_enviado: true } })
    await crearUsuario({ nombres: 'Ana', apellidos: 'Ruiz', dni: '87654321', correo: 'ana@sicedu.test', id_rol: '2' })
    expect(post.mock.calls.at(-1)[1]).toMatchObject({ id_rol: 2, asignacion: null })
  })

  it('sin grados elegidos OMITE `grados` (null y [] dan 422 en dev)', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 1, nombre: '2026', vigente: true }] })
    await actualizarUsuario(4, { nombres: 'Docente', apellidos: 'Desactivado', dni: '76355221', correo: 'd@sicedu.test', id_colegio: '1', grados: [], anio_escolar: '' })
    const [, cuerpo] = patch.mock.calls.at(-1)
    expect(cuerpo.asignacion).toEqual({ id_colegio: 1, id_anio_escolar: 1 })
    expect(cuerpo.asignacion).not.toHaveProperty('grados')
  })

  it('el año escolar escrito se traduce a su id del catálogo', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 1, nombre: '2026', vigente: true }, { id: 2, nombre: '2027', vigente: false }] })
    await actualizarUsuario(2, { nombres: 'Docente', apellidos: 'de Prueba', dni: '00000002', correo: 'p@sicedu.test', id_colegio: '1', grados: ['1'], anio_escolar: '2027' })
    expect(patch.mock.calls.at(-1)[1].asignacion).toEqual({ id_colegio: 1, id_anio_escolar: 2, grados: [1] })
  })

  it('editar no manda `id_rol` vacío ni campos sueltos del Docente', async () => {
    await actualizarUsuario(15, { nombres: 'Rosa', apellidos: 'Camones', dni: '12345678', correo: 'rosa@sicedu.test', id_rol: '', anio_escolar: '', id_colegio: '', grados: [] })
    expect(patch).toHaveBeenCalledWith('/usuarios/15', { nombres: 'Rosa', apellidos: 'Camones', dni: '12345678', correo: 'rosa@sicedu.test' })
  })
})

describe('Filtro de Usuarios por colegio (en el cliente)', () => {
  const FILAS = [
    { id_usuario: 2, id_rol: 1, nombre: 'Docente de Prueba', colegios_asignados: ['Colegio de Prueba'] },
    { id_usuario: 4, id_rol: 1, nombre: 'Docente Desactivado', colegios_asignados: [] },
    { id_usuario: 6, id_rol: 1, nombre: 'Docente Yungay', colegios_asignados: ['Colegio Yungay'] },
    { id_usuario: 1, id_rol: 2, nombre: 'Jefa de Prueba', colegios_asignados: ['Global'] },
    { id_usuario: 3, id_rol: 3, nombre: 'Directivo de Prueba', colegios_asignados: ['Global'] },
  ]

  it('deja los docentes de ese colegio y a Supervisor y Directivo, que son globales', async () => {
    const { filtrarUsuariosPorColegio } = await import('../resources/administracion')
    expect(filtrarUsuariosPorColegio(FILAS, 'Colegio de Prueba').map((u) => u.id_usuario)).toEqual([2, 1, 3])
  })

  it('sin colegio elegido no filtra', async () => {
    const { filtrarUsuariosPorColegio } = await import('../resources/administracion')
    expect(filtrarUsuariosPorColegio(FILAS, undefined)).toHaveLength(5)
  })
})

describe('Resúmenes del Inicio del Docente (D13)', () => {
  it('contra la API real no se inventan cifras del simulador', async () => {
    expect(await obtenerResumenDocente(1, { periodo: 3, semana: 30 })).toBeNull()
  })
})

