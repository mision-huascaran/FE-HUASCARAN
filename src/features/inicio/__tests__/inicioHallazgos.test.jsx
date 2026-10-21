// Regresiones de la ejecución del 09/10/2026 en el Módulo de Inicio:
//
//   D01 — Directivo: Salud del Sistema. La tarjeta se RETIRÓ (ver abajo).
//   D12 — Docente: "Mis asignaciones" muestra el ciclo EBR.
//   D15 — Supervisor: "Con actividad en curso" lee `docentes_con_actividad_activa`.
//   D16 — Supervisor: la alerta no repite "Atención: Atención:".
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import InicioDirectivo from '../InicioDirectivo'
import InicioSupervisor from '../InicioSupervisor'
import ResumenesAccion from '../ResumenesAccion'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const docente = vi.fn()
const supervisor = vi.fn()
const directivo = vi.fn()
vi.mock('../../../api/resources/inicio', () => ({
  obtenerInicioDocente: () => docente(),
  obtenerInicioSupervisor: () => supervisor(),
  obtenerResumenSupervisor: () => supervisor(),
  obtenerInicioDirectivo: () => directivo(),
  obtenerResumenDocente: vi.fn(),
}))

const ESPERA = { timeout: 8000 }

function montar(componente, idRol) {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: idRol, id_docente: idRol === ROLES.DOCENTE ? 1 : null, nombres: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <MemoryRouter>{componente}</MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => localStorage.clear())

describe('Inicio — hallazgos del 09/10/2026', () => {
  it('D01: "Salud del sistema" ya no se muestra, y las otras dos siguen', async () => {
    /**
     * D01 se arregló pintando "Sin datos disponibles" cuando `salud_sistema`
     * llegaba en `null`. Pero llega SIEMPRE en null —depende de la
     * sincronización offline, que el backend no tiene—, así que la tarjeta
     * nunca enseñó un dato. Se retiró entera: ocupaba sitio y hacía dudar de
     * las dos que sí valen. Vuelve el día que haya algo que poner en ella.
     */
    directivo.mockResolvedValue({ beneficiarios_activos: 3, colegios_operando: 2, salud_sistema: null })
    montar(<InicioDirectivo />, ROLES.DIRECTIVO)

    expect(await screen.findByText('Total de beneficiarios activos', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Total de colegios operando')).toBeInTheDocument()
    expect(screen.queryByText(/salud del sistema/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Sin datos disponibles')).not.toBeInTheDocument()
  })

  it('D15: cuenta los docentes con actividad y pinta la alerta tal como llega', async () => {
    // El contrato manda `{tipo, mensaje, critica}` con el mensaje YA redactado
    // ("Inactividad Operativa - …"). La pantalla no le añade un encabezado
    // propio: antes anteponía "Atención:" al que ya traía (D16).
    const MENSAJE = 'Inactividad Operativa - QA Pin A: Sin actividad registrada en los últimos 4 días hábiles.'
    supervisor.mockResolvedValue({
      colegios_registrados: 12,
      docentes_activos: 11,
      docentes_con_actividad_activa: 1,
      registros_vencidos: 0,
      registros_incompletos: 0,
      alertas: [{ tipo: 'inactividad_operativa', mensaje: MENSAJE, critica: false }],
    })
    montar(<InicioSupervisor />, ROLES.SUPERVISOR)

    const tarjeta = (await screen.findByText('Con actividad en curso', {}, ESPERA)).closest('div').parentElement
    expect(tarjeta).toHaveTextContent('1')

    const alerta = screen.getByText(MENSAJE).closest('li')
    // La etiqueta la pone la gravedad, no el texto del servidor.
    expect(alerta.textContent).toBe(`Aviso: ${MENSAJE}`)
    // El acceso del Supervisor a sus docentes va a Seguimiento, no a /sesiones (403).
    expect(screen.getByRole('link', { name: /seguimiento/i })).toHaveAttribute('href', '/seguimiento')
    expect(screen.queryByRole('link', { name: /sesiones/i })).not.toBeInTheDocument()
  })

  it('D12: "Mis asignaciones" muestra el ciclo EBR', async () => {
    docente.mockResolvedValue({
      asignaciones: [
        {
          colegio: { id: 7, nombre: 'Colegio de Prueba' },
          grados: [{ id: 1, nombre: '1.º', cantidad_alumnos: 3, ciclos: ['III'], subprogramas: ['Alfabetización'] }],
        },
      ],
      totales: { ciclos: ['III'], subprogramas: ['Alfabetización'], cantidad_alumnos: 3 },
    })
    montar(<ResumenesAccion />, ROLES.DOCENTE)

    expect(await screen.findByText('Ciclos', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('III')).toBeInTheDocument()
  })
})
