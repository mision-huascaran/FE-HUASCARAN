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

  it('los filtros de la pantalla llegan al servidor con sus nombres', async () => {
    await listarAlumnosAdmin({ id_colegio: '7', id_grado: '1', id_ciclo: '1', id_programa: '2', estado: 'activo' })
    expect(get.mock.calls.at(-1)[1].params).toMatchObject({ colegio: '7', grado: '1', ciclo: '1', subprograma: '2', activo: true })
  })

  it('editar no envía los campos de solo lectura (sección, ciclo)', async () => {
    await actualizarAlumno(42, { nombres: 'Ana', apellidos: 'Quispe', id_colegio: '7', id_grado: '1', id_programa: '1', seccion: 'Única', ciclo: 'III' })
    expect(patch).toHaveBeenCalledWith('/alumnos/42', {
      nombres: 'Ana',
      apellidos: 'Quispe',
      id_colegio: 7,
      id_grado: 1,
      id_programa_actual: 1,
    })
  })

  it('Usuarios (y los demás listados) traen todas las páginas, no solo las 10 primeras', async () => {
    const pagina = (n) => ({
      data: {
        items: Array.from({ length: n === 3 ? 2 : 10 }, (_, i) => ({ id_usuario: (n - 1) * 10 + i + 1, nombres: 'U' })),
        total: 22,
        pagina: n,
        paginas: 3,
        por_pagina: 10,
      },
    })
    get.mockImplementation((_ruta, config) => Promise.resolve(pagina(config?.params?.page ?? 1)))

    const { items } = await listarUsuariosAdmin({ estado: 'activo' })
    expect(items).toHaveLength(22)
    expect(get.mock.calls.map(([, config]) => config.params.page ?? 1).sort()).toEqual([1, 2, 3])

    get.mockImplementation(() => Promise.resolve({ data: {} }))
  })
})

describe('Resúmenes del Inicio del Docente (D13)', () => {
  it('contra la API real no se inventan cifras del simulador', async () => {
    expect(await obtenerResumenDocente(1, { periodo: 3, semana: 30 })).toBeNull()
  })
})

