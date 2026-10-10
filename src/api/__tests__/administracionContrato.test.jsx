// Ramas del contrato REAL de administración que no ejercitan rutasReales.test.js:
// año escolar por defecto, roles que llegan como texto desconocido y auditoría
// de entidades que el backend no audita.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import PestanaAuditoria from '../../components/mantenimiento/PestanaAuditoria'
import { clienteDePrueba } from '../../test/renderConProveedores'

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

const { actualizarUsuario, listarAuditoria, listarUsuariosAdmin, listarGradosAdmin, listarProgramasAdmin, cambiarEstadoAlumno } =
  await import('../resources/administracion')

const EDICION = { nombres: 'Rosa', apellidos: 'Camones', dni: '12345678', correo: 'rosa@sicedu.test', id_colegio: '7', grados: ['1'] }

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: {} })
  patch.mockClear()
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
    expect(patch).toHaveBeenCalledWith(expect.stringMatching(/\/alumnos\/8\/activar$/))
  })
})

/**
 * BUG (REPORTE_CALIDAD.md): para colegios y usuarios, `listarAuditoria` define
 * `real: () => Promise.resolve([])`, pero `resolver` devuelve `respuesta?.data`
 * y un array no tiene `.data`: el resultado es `undefined`, no `[]`. TanStack
 * Query v5 trata un `undefined` como error, así que contra la API real la
 * pestaña Auditoría de Colegios y Usuarios muestra "No se pudo cargar la
 * auditoría" en vez de su estado vacío.
 */
describe('Auditoría de entidades sin historial en el backend', () => {
  it.fails('el servicio devuelve una lista vacía', async () => {
    await expect(listarAuditoria('usuario', 4)).resolves.toEqual([])
  })

  it.fails('la pestaña muestra "Sin cambios registrados", no un error', async () => {
    render(
      <QueryClientProvider client={clienteDePrueba()}>
        <PestanaAuditoria seccion="colegio" registro={{ id_colegio: 4 }} cargarAuditoria={(id) => listarAuditoria('colegio', id)} />
      </QueryClientProvider>,
    )
    expect(await screen.findByText('Sin cambios registrados')).toBeInTheDocument()
  })
})
