// CU003/CU014: la precarga de alumnos trae a TODOS, no solo a los activos.
// Sin conexión, "Todos" se resuelve con esta copia: si solo trajera activos,
// el inactivo (o con pertenencia pendiente) que se ve con conexión
// desaparecía al cortarse la red.
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import useSincronizacionLocal from '../useSincronizacionLocal'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

vi.mock('idb-keyval', () => ({ get: vi.fn(async () => null), set: vi.fn(async () => {}), del: vi.fn(async () => {}) }))

const listar = vi.fn(async () => ({ items: [] }))
vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarAlumnosAdmin: (...args) => listar(...args),
}))

describe('Precarga de alumnos', () => {
  it.each([
    ['Docente', ROLES.DOCENTE],
    ['Supervisor', ROLES.SUPERVISOR],
  ])('del %s: pide "todos" (activos e inactivos)', async (_, idRol) => {
    listar.mockClear()
    useSessionStore.setState({ token: 'mock.4.2026', usuario: { id_usuario: 4, id_rol: idRol }, cargando: false })
    const cliente = crearQueryClient()
    renderHook(() => useSincronizacionLocal(), {
      wrapper: ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>,
    })
    await waitFor(() => expect(listar).toHaveBeenCalled())
    expect(listar).toHaveBeenCalledWith({ estado: 'todos' })
  })
})
