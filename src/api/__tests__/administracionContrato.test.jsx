// Ramas del contrato REAL de administración que no ejercitan rutasReales.test.js:
// año escolar por defecto, roles que llegan como texto desconocido y auditoría
// de entidades que el backend no audita.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import PestanaAuditoria from '../../components/mantenimiento/PestanaAuditoria'
import { ToastProvider } from '../../components/ui'
import MantenimientoUsuarios from '../../features/usuarios/MantenimientoUsuarios'
import { clienteDePrueba, iniciarSesionComo } from '../../test/renderConProveedores'
import { ROLES } from '../../auth/roles'

// `vi.hoisted`: los dobles tienen que existir antes de que los imports de
// arriba carguen `client` (vi.mock se eleva por encima de todo).
const { get, post, patch } = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve({ data: {} })),
  post: vi.fn(() => Promise.resolve({ data: {} })),
  patch: vi.fn(() => Promise.resolve({ data: {} })),
}))

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get, post, patch },
  resolver: ({ real }) => Promise.resolve(real()).then((r) => r?.data),
  adminContraApiReal: true,
}))

const { actualizarUsuario, listarAuditoria, listarUsuariosAdmin, listarGradosAdmin, listarProgramasAdmin, cambiarEstadoAlumno, crearColegio, actualizarColegio } =
  await import('../resources/administracion')

const EDICION = { nombres: 'Rosa', apellidos: 'Camones', dni: '12345678', correo: 'rosa@sicedu.test', id_colegio: '7', grados: ['1'] }

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: {} })
  patch.mockClear()
  post.mockClear()
})

describe('Año escolar de la asignación', () => {
  it('sin año escrito usa el vigente', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 1, nombre: '2025', vigente: false }, { id: 2, nombre: '2026', vigente: true }] })
    await actualizarUsuario(15, { ...EDICION, anio_escolar: '' })
    expect(patch.mock.calls.at(-1)[1].asignacion.id_anio_escolar).toBe(2)
  })

  it('un año que no está en el catálogo cae al vigente en vez de mandar null', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 2, nombre: '2026', vigente: true }] })
    await actualizarUsuario(15, { ...EDICION, anio_escolar: '1999' })
    expect(patch.mock.calls.at(-1)[1].asignacion.id_anio_escolar).toBe(2)
  })

  it('sin catálogo ni vigente manda null y deja que el backend lo rechace', async () => {
    get.mockResolvedValueOnce({ data: null })
    await actualizarUsuario(15, { ...EDICION, anio_escolar: '' })
    expect(patch.mock.calls.at(-1)[1].asignacion.id_anio_escolar).toBeNull()
  })
})

describe('Contrato de listados', () => {
  it('un rol que llega con un nombre desconocido queda en null, no en un rol cualquiera', async () => {
    get.mockResolvedValueOnce({ data: { items: [{ id: 30, nombres: 'X', rol: 'Invitado', colegios_asignados: null }], total: 1 } })
    const { items } = await listarUsuariosAdmin({ estado: 'activo' })
    expect(items[0]).toMatchObject({ id_usuario: 30, id_rol: null, colegios_asignados: [], es_supervisor_original: false })
  })

  it('grados y programas del backend traen `id`: se exponen como id_grado e id_programa', async () => {
    get.mockResolvedValueOnce({ data: [{ id: 3, nombre: '3.°' }] })
    expect(await listarGradosAdmin()).toEqual([{ id: 3, nombre: '3.°', id_grado: 3 }])
    get.mockResolvedValueOnce({ data: null })
    expect(await listarProgramasAdmin()).toEqual([])
  })

  it('la auditoría de colegios o usuarios no se pide al backend, que solo audita alumnos', async () => {
    await listarAuditoria('colegio', 4)
    expect(get).not.toHaveBeenCalled()
    await listarAuditoria('alumno', 4)
    expect(get).toHaveBeenCalledWith(expect.stringContaining('/alumnos/4'))
  })

  it('reactivar un alumno usa su ruta /activar', async () => {
    await cambiarEstadoAlumno(8, true)
    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/alumnos\/8\/activar$/), {
      // El cuerpo es obligatorio desde T3; sin él, 422.
      aplicar_desde: expect.any(String),
    })
  })
})

/**
 * El backend solo publica historial del ALUMNO. Para colegios y usuarios,
 * `listarAuditoria` devolvía `Promise.resolve([])` por la rama real, pero
 * `resolver` lee `respuesta?.data` y un array no tiene `.data`: salía
 * `undefined`, que TanStack Query v5 trata como error, y la pestaña mostraba
 * "No se pudo cargar" en vez de su estado vacío.
 *
 * Al normalizar la respuesta con `normalizarPaginado` (D29) quedó arreglado de
 * paso: ahora siempre sale una lista, venga `{items: []}` o un array.
 */
describe('Auditoría de entidades sin historial en el backend', () => {
  it('el servicio devuelve una lista vacía', async () => {
    await expect(listarAuditoria('usuario', 4)).resolves.toEqual([])
  })

  it('la pestaña muestra "Sin cambios registrados", no un error', async () => {
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <PestanaAuditoria entidad="colegio" registro={{ id_colegio: 4 }} cargarAuditoria={(id) => listarAuditoria('colegio', id)} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Sin cambios registrados')).toBeInTheDocument()
  })
})

describe('Cuerpo de colegio (CU013)', () => {
  it('no manda seccion ni nivel_educativo vacíos y convierte programas a números', async () => {
    await crearColegio({ nombre: 'I.E. X', seccion: '', nivel_educativo: '  ', programas: ['1', 2, { id_programa: 3 }, { id: 4 }] })
    const cuerpo = post.mock.calls.at(-1)[1]
    expect(cuerpo).not.toHaveProperty('seccion')
    expect(cuerpo.programas).toEqual([1, 2, 3, 4])

    await actualizarColegio(5, { seccion: '' })
    expect(patch.mock.calls.at(-1)[1]).toEqual({ nivel_educativo: 'Primaria' })
  })

  it('siempre manda nivel_educativo "Primaria", también al editar uno con otro nivel', async () => {
    await crearColegio({ nombre: 'I.E. Y' })
    expect(post.mock.calls.at(-1)[1].nivel_educativo).toBe('Primaria')
    await actualizarColegio(5, { nombre: 'I.E. Y', nivel_educativo: 'Secundaria' })
    expect(patch.mock.calls.at(-1)[1].nivel_educativo).toBe('Primaria')
  })
})

describe('Editar un Docente en Usuarios', () => {
  const DETALLE = {
    id: 15,
    nombres: 'Rosa',
    apellidos: 'Camones',
    dni: '12345678',
    correo: EDICION.correo,
    rol: 'Docente',
    // Tanda G1: `asignacion` viene agrupada por colegio, no como
    // `periodos[]` con un `id_colegio` dentro. Los grados salen del periodo
    // vigente o, si no hay, del primero.
    asignacion: {
      id_anio_escolar: 2,
      colegios: [
        {
          id_colegio: 7,
          colegio: 'I.E. Uno',
          periodos: [
            { id_periodo: 2, numero: 2, vigente: true, retroactiva: false, grados: [{ id_grado: 3, nombre: '3.°' }, { id_grado: 2, nombre: '2.°' }] },
          ],
        },
      ],
    },
  }
  const RESPUESTAS = new Map(Object.entries({
    '/usuarios': { items: [{ id: 15, nombres: 'Rosa', apellidos: 'Camones', dni: '12345678', correo: EDICION.correo, rol: 'Docente', colegios_asignados: ['I.E. Uno'] }], total: 1 },
    '/usuarios/15': DETALLE,
    '/colegios': { items: [{ id: 7, nombre: 'I.E. Uno' }, { id: 8, nombre: 'I.E. Dos' }], total: 2 },
    '/grados': [1, 2, 3].map((id) => ({ id, nombre: `${id}.°` })),
    '/anios-escolares': [{ id: 1, nombre: 'Año escolar 2025', vigente: false }, { id: 2, nombre: 'Año escolar 2026', vigente: true }],
  }))

  it('precarga año, colegio y grados de GET /usuarios/{id}, y editar solo el DNI no envía la asignación', async () => {
    get.mockImplementation((url) => Promise.resolve({ data: RESPUESTAS.get(url) ?? [] }))
    iniciarSesionComo(ROLES.SUPERVISOR)
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <ToastProvider>
          <MemoryRouter>
            <MantenimientoUsuarios />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /^editar /i }))
    const popup = await screen.findByRole('dialog')
    await waitFor(() => expect(within(popup).getByLabelText(/año escolar/i)).toHaveValue('2026'))
    expect(get).toHaveBeenCalledWith('/usuarios/15')
    // D67 — Ahora es un bloque por colegio: el desplegable trae el suyo y
    // sus grados van marcados dentro de ESE bloque.
    await waitFor(() => expect(within(popup).getAllByRole('combobox').some((c) => c.value === '7')).toBe(true))
    expect(within(popup).getByRole('checkbox', { name: /2\.° en el colegio 1/ })).toBeChecked()
    expect(within(popup).getByRole('checkbox', { name: /3\.° en el colegio 1/ })).toBeChecked()
    expect(within(popup).getByRole('checkbox', { name: /1\.° en el colegio 1/ })).not.toBeChecked()

    fireEvent.change(within(popup).getByLabelText(/^dni/i), { target: { value: '87654321' } })
    fireEvent.click(within(popup).getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(patch).toHaveBeenCalled())
    const [ruta, cuerpo] = patch.mock.calls.at(-1)
    expect(ruta).toBe('/usuarios/15')
    expect(cuerpo.dni).toBe('87654321')
    expect(cuerpo).not.toHaveProperty('asignacion')
  })
})
