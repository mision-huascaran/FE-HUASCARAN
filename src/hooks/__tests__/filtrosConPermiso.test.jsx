// D56 — El aula de un permiso de corrección tiene que poder ELEGIRSE.
//
// El contrato es explícito: "los grupos a los que solo llega por un permiso no
// suman a `asignaciones`". Como estos filtros se construían solo con
// `GET /me/asignaciones`, el colegio del permiso no aparecía en el
// desplegable y el Docente no tenía forma de abrir la pantalla donde usarlo.
//
// El aviso de que está entrando por un permiso no se inventa aquí: cada
// módulo lo recibe del servidor en `escritura.aviso_permiso`.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useFiltrosDeGrupo from '../useFiltrosDeGrupo'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

const ASIGNADO = { id_colegio: 1, colegio: 'I.E. Ranrahirca', grados: [{ id_grado: 2, nombre: '2.º' }] }

const PERMISO = {
  id_permiso: 7,
  colegio: { id: 9, nombre: 'Colegio Lejano' },
  grado: { id: 3, nombre: '3.º' },
  anio_escolar: { id: 1, nombre: '2026' },
  periodo: 'PA3',
  modulo: 'lectura',
  fin: '2026-10-26T04:59:00Z',
}

const permisos = vi.fn(() => [])

vi.mock('../../api/resources/administracion', () => ({
  listarMisAsignaciones: vi.fn(async () => [ASIGNADO]),
  obtenerColegio: vi.fn(async (id) => ({
    id_colegio: Number(id),
    // El detalle del colegio SÍ trae los grados del permiso: desde T4 la
    // lectura del Docente incluye los colegios y grados de sus permisos.
    grados: [
      { id_grado: 2, nombre: '2.º', secciones: [{ id_seccion: 102, nombre: 'Única' }] },
      { id_grado: 3, nombre: '3.º', secciones: [{ id_seccion: 103, nombre: 'Única' }] },
    ],
    programas: [{ id_programa: 1, nombre: 'Alfabetización' }],
  })),
}))

vi.mock('../../api/resources/inicio', () => ({
  obtenerInicioDocente: vi.fn(async () => ({ permisos_vigentes: permisos() })),
}))

vi.mock('../../api/resources/catalogos', () => ({ obtenerSemanas: vi.fn(async () => []) }))

vi.mock('../useCatalogos', () => ({ useColegiosReales: () => ({ data: [] }) }))

function usar(ruta = '/lectura') {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envoltorio = ({ children }) => (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(() => useFiltrosDeGrupo({ esDocente: true, idAnioEscolar: 1 }), { wrapper: envoltorio })
}

beforeEach(() => {
  permisos.mockReturnValue([])
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombre_completo: 'Docente' },
    cargando: false,
  })
})

describe('Los filtros de un grupo, con permisos (D56)', () => {
  it('sin permisos, solo sus colegios asignados', async () => {
    const { result } = usar()
    await waitFor(() => expect(result.current.colegios).toHaveLength(1))
    expect(result.current.colegios[0]).toMatchObject({ id_colegio: 1, nombre: 'I.E. Ranrahirca' })
  })

  it('el COLEGIO del permiso vigente se añade al desplegable', async () => {
    permisos.mockReturnValue([PERMISO])
    const { result } = usar()

    await waitFor(() => expect(result.current.colegios).toHaveLength(2))
    expect(result.current.colegios.map((c) => c.nombre)).toContain('Colegio Lejano')
    // Marcado, para no confundirlo con una asignación.
    expect(result.current.colegios.find((c) => c.id_colegio === 9)?.soloPorPermiso).toBe(true)
  })

  it('y su GRADO también, aunque el Docente no tenga asignación ahí', async () => {
    permisos.mockReturnValue([PERMISO])
    const { result } = usar('/lectura?colegio=9')

    await waitFor(() => expect(result.current.grados.length).toBeGreaterThan(0))
    expect(result.current.grados.map((g) => g.id_grado)).toEqual([3])
  })

  it('en el colegio ASIGNADO el permiso de otro colegio no añade grados', async () => {
    permisos.mockReturnValue([PERMISO])
    const { result } = usar('/lectura?colegio=1')

    await waitFor(() => expect(result.current.grados.length).toBeGreaterThan(0))
    expect(result.current.grados.map((g) => g.id_grado)).toEqual([2])
  })
})
