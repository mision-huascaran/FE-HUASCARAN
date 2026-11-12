// Bug UAT #820 — "Docente: en Rúbrica y Registro de Vuelo el filtro de Grado
// sale vacío".
//
// La búsqueda guardada de cada módulo (D105) o un enlace podían traer un
// colegio que ya no era del Docente. Su detalle responde 403, no había grados
// que ofrecer y el filtro se quedaba así: el desplegable pintaba otro colegio
// y Grado vacío, sin salida.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useFiltrosDeGrupo from '../useFiltrosDeGrupo'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'
import { PREFIJO_FILTROS } from '../useFiltrosGuardados'

const COLEGIO_AJENO = 99

vi.mock('../../api/resources/administracion', () => ({
  listarMisAsignaciones: vi.fn(async () => [
    { id_colegio: 1, colegio: 'IE Uno', grados: [3], detalle_grados: [{ id_grado: 3, subprogramas: ['Alfabetización'] }] },
  ]),
  obtenerColegio: vi.fn(async (id) => {
    if (Number(id) === COLEGIO_AJENO) {
      throw Object.assign(new Error('Fuera de alcance'), { response: { status: 403 } })
    }
    return {
      id_colegio: Number(id),
      grados: [{ id_grado: 3, nombre: '3.º', dia_clase: 2, secciones: [{ id: 30, nombre: 'A' }] }],
      programas: [{ id_programa: 1, nombre: 'Alfabetización' }],
    }
  }),
}))
vi.mock('../../api/resources/inicio', () => ({ obtenerInicioDocente: vi.fn(async () => ({ permisos_vigentes: [] })) }))
vi.mock('../../api/resources/habilitaciones', () => ({ obtenerMisHabilitaciones: vi.fn(async () => ({ permisos: [] })) }))
vi.mock('../../api/resources/catalogos', () => ({ obtenerSemanas: vi.fn(async () => []) }))
vi.mock('../useCatalogos', () => ({ useColegiosReales: () => ({ data: [] }) }))

function usar(ruta) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envoltorio = ({ children }) => (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(() => useFiltrosDeGrupo({ esDocente: true, idAnioEscolar: 1, conSemana: false }), {
    wrapper: envoltorio,
  })
}

beforeEach(() => {
  localStorage.clear()
  useSessionStore.setState({
    token: 't',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1 },
    cargando: false,
  })
})

describe('Un colegio fuera del alcance del Docente (bug UAT #820)', () => {
  it.each(['/rubrica', '/registro-vuelo'])('en %s, el guardado se descarta y Grado se llena', async (ruta) => {
    localStorage.setItem(`${PREFIJO_FILTROS}grupo:${ruta}`, `colegio=${COLEGIO_AJENO}&grado=5&mes=11`)
    const { result } = usar(ruta)

    await waitFor(() => expect(result.current.filtros.idColegio).toBe('1'))
    await waitFor(() => expect(result.current.grados.map((g) => g.id_grado)).toEqual([3]))
    expect(result.current.filtros.idGrado).toBe('3')
    await waitFor(() => expect(result.current.grupoValido).toBe(true))
  })

  it('lo mismo si el colegio llega por la URL', async () => {
    const { result } = usar(`/rubrica?colegio=${COLEGIO_AJENO}`)
    await waitFor(() => expect(result.current.filtros.idColegio).toBe('1'))
    await waitFor(() => expect(result.current.grados).toHaveLength(1))
  })

  /**
   * El propio comentario del parche dice por qué existe esta condición: "para
   * no entrar en un bucle si el servidor y la lista no coinciden". Si
   * `asignaciones` SÍ dice que el colegio es suyo pero su detalle igual
   * responde 403 —una inconsistencia real entre los dos endpoints—, no se
   * limpia: se queda con el colegio tal cual.
   *
   * Hay DOS colegios a propósito, con el válido (5) primero en la lista: sin
   * la protección, limpiar el 99 y autoelegir caería en el 5 —un colegio
   * DISTINTO del que de verdad se pidió—, que es un resultado comprobable y
   * no solo "no explotó".
   */
  it('si el colegio SÍ está en la lista de asignaciones pero su detalle igual da 403, no se limpia (evita el bucle)', async () => {
    const { listarMisAsignaciones } = await import('../../api/resources/administracion')
    listarMisAsignaciones.mockResolvedValueOnce([
      { id_colegio: 5, colegio: 'Válido', grados: [3], detalle_grados: [{ id_grado: 3, subprogramas: ['Alfabetización'] }] },
      { id_colegio: COLEGIO_AJENO, colegio: 'Inconsistente', grados: [3], detalle_grados: [{ id_grado: 3, subprogramas: ['Alfabetización'] }] },
    ])

    const { result } = usar(`/rubrica?colegio=${COLEGIO_AJENO}`)

    await waitFor(() => expect(result.current.colegios.length).toBe(2))
    // Tiempo de sobra para que, si la protección no estuviera, ya se hubiera
    // reemplazado por el otro colegio (5).
    await new Promise((resuelve) => setTimeout(resuelve, 300))
    expect(result.current.filtros.idColegio).toBe(String(COLEGIO_AJENO))
  })
})
