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

const { cambiarEstadoColegio, cambiarEstadoAlumno, listarColegiosAdmin, listarUsuariosAdmin, listarMisAsignaciones } =
  await import('../resources/administracion')
const { iniciarActividad, finalizarActividad, listarActividades, obtenerActividad } =
  await import('../resources/actividades')
const { listarSeguimiento, obtenerDocenteSeguimiento, listarActividadesDe } =
  await import('../resources/seguimiento')
const { obtenerInicioDocente, obtenerInicioSupervisor, obtenerInicioDirectivo } =
  await import('../resources/inicio')
const { recuperarConLlave } = await import('../resources/auth')

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
