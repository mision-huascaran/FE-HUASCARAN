// D56 — "Iniciar actividad" con un permiso excepcional y SIN asignaciones.
//
// Es el caso en que un permiso de corrección existe: al Docente se le concede
// justo porque esa aula no es suya. Si el botón se queda deshabilitado, el
// permiso no sirve para nada, porque sin actividad abierta no se puede
// registrar ni corregir.
//
// La decisión buena es la del servidor (`puede_iniciar_actividad` y
// `motivo_no_puede_iniciar`). Lo que se prueba aquí es el RESPALDO local, que
// es lo que decide mientras esa respuesta no llega y lo único que hay sin
// conexión.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useActividad from '../useActividad'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'

const AHORA = new Date('2026-10-22T15:00:00Z')

const PERMISO_VIGENTE = {
  id_permiso: 7,
  id_colegio: 1,
  id_grado: 3,
  id_periodo_academico: 33,
  modulo: 'lectura',
  inicio: '2026-10-19T00:00:00-05:00',
  fin: '2026-10-25T23:59:59-05:00',
}

const CALENDARIO = {
  id_colegio: 1,
  periodos: [{ tipo: 'PA', numero: 3, id_periodo_academico: 33, fecha_inicio: '2026-08-01', fecha_fin: '2026-12-15' }],
  dias_no_lectivos: [],
}

const paquete = vi.fn()

vi.mock('../../../api/resources/habilitaciones', () => ({
  obtenerMisHabilitaciones: (...args) => paquete(...args),
}))

// El Inicio del Docente no contesta: se prueba justamente el respaldo local.
vi.mock('../../../api/resources/inicio', () => ({
  obtenerInicioDocente: vi.fn(async () => {
    throw new Error('sin servidor')
  }),
}))

vi.mock('../../../lib/relojServidor', async (importOriginal) => ({
  ...(await importOriginal()),
  ahora: () => AHORA,
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

function usar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envoltorio = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  return renderHook(() => useActividad(), { wrapper: envoltorio })
}

beforeEach(() => {
  paquete.mockReset()
  useActividadStore.getState().limpiar()
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombre_completo: 'Docente' },
    cargando: false,
  })
})

describe('Iniciar actividad sin asignaciones (D56)', () => {
  it('con un PERMISO VIGENTE el botón NO se deshabilita', async () => {
    paquete.mockResolvedValue({
      generado_en: AHORA.toISOString(),
      asignaciones: [],
      permisos: [PERMISO_VIGENTE],
      calendarios: [CALENDARIO],
    })
    const { result } = usar()

    await waitFor(() => expect(paquete).toHaveBeenCalled())
    await waitFor(() => expect(result.current.sinAsignaciones).toBe(false))
    expect(result.current.motivoNoPuedeIniciar).toBeNull()
  })

  it('sin asignaciones NI permisos vigentes, se deshabilita', async () => {
    paquete.mockResolvedValue({
      generado_en: AHORA.toISOString(),
      asignaciones: [],
      // Vencido: no habilita nada.
      permisos: [{ ...PERMISO_VIGENTE, inicio: '2026-10-01T00:00:00-05:00', fin: '2026-10-02T23:59:59-05:00' }],
      calendarios: [CALENDARIO],
    })
    const { result } = usar()

    await waitFor(() => expect(result.current.sinAsignaciones).toBe(true))
    expect(result.current.motivoNoPuedeIniciar).toBe('sin_asignaciones')
  })

  it('mientras no se sabe nada, el botón queda ACTIVO', async () => {
    /**
     * Deshabilitarlo "por si acaso" enseña un motivo que nadie ha comprobado.
     * Dejándolo activo, como mucho el servidor responde su 422 con el texto
     * bueno, que es el que hay que leer.
     */
    paquete.mockReturnValue(new Promise(() => {}))
    const { result } = usar()
    expect(result.current.sinAsignaciones).toBe(false)
  })
})
