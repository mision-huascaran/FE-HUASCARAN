// Registro de Vuelo: editar una evaluación (P6) y ver su trazabilidad (P8).
// Cubre RF-021, RF-023, RF-024, RN-005, RN-010, RN-014 y RN-015.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import { EVALUACIONES } from '../../../api/mock/db'
import RegistroVueloPage from '../RegistroVueloPage'
import ModalTrazabilidad from '../ModalTrazabilidad'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

const COLEGIO = 1

async function abrirEdicion() {
  renderConProveedores(<RegistroVueloPage />, { ruta: `/registro-vuelo?colegio=${COLEGIO}`, rol: ROLES.DOCENTE })
  const [editar] = await screen.findAllByRole('button', { name: 'Editar evaluación' }, { timeout: 8000 })
  await userEvent.click(editar)
  return screen.findByRole('dialog', { name: 'Editar evaluación' })
}

/** Una letra del selector de nivel final distinta de la que está elegida. */
function otraLetra(selector) {
  return [...selector.options].map((o) => o.value).find((v) => v && v !== selector.value)
}

beforeEach(() => {
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => {
  useActividadStore.getState().limpiar()
  vi.restoreAllMocks()
})

describe('Editar evaluación (P6)', () => {
  it('el nivel inicial es automático y no se puede editar (RN-005)', async () => {
    const panel = await abrirEdicion()
    const nivelInicial = within(panel).getByLabelText(/Nivel inicial Raz-Kids/)
    expect(nivelInicial).toBeDisabled()
    expect(nivelInicial.value).not.toBe('')
  })

  it('cambiar la sugerencia obliga a justificar antes de confirmar (RF-023, RN-015)', async () => {
    const panel = await abrirEdicion()
    const nivelFinal = within(panel).getByLabelText(/Nivel final/)
    const confirmar = within(panel).getByRole('button', { name: 'Confirmar evaluación' })
    expect(within(panel).queryByLabelText(/Justificación del cambio/)).not.toBeInTheDocument()

    await userEvent.selectOptions(nivelFinal, otraLetra(nivelFinal))
    const justificacion = within(panel).getByLabelText(/Justificación del cambio/)
    expect(confirmar).toBeDisabled()

    await userEvent.type(justificacion, 'Leyó con fluidez el texto del nivel siguiente')
    expect(confirmar).toBeEnabled()
  })

  it('con un total imposible (más aciertos que preguntas) avisa y no deja confirmar', async () => {
    const panel = await abrirEdicion()
    const total = within(panel).getByLabelText(/^Total de preguntas/)
    await userEvent.clear(total)
    await userEvent.type(total, '1')
    await userEvent.clear(within(panel).getByLabelText(/^Aciertos/))
    await userEvent.type(within(panel).getByLabelText(/^Aciertos/), '5')

    expect(within(panel).getByText(/Complete la prueba y las dos dimensiones/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Confirmar evaluación' })).toBeDisabled()
  })

  /**
   * BUG (REPORTE_CALIDAD.md): `calcularNivelFinal` convierte con `Number('')`,
   * que vale 0. Con "Aciertos" VACÍO —un campo obligatorio— la prueba se da por
   * completa con 0 aciertos, se sugiere bajar de nivel y se puede confirmar:
   * se guardaría `aciertos: 0` que el docente nunca escribió.
   */
  it.fails('sin la prueba completa avisa y no deja confirmar', async () => {
    const panel = await abrirEdicion()
    await userEvent.clear(within(panel).getByLabelText(/^Aciertos/))

    expect(within(panel).getByText(/Complete la prueba y las dos dimensiones/)).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Confirmar evaluación' })).toBeDisabled()
  })

  it('un periodo cerrado se marca con candado y explica que requiere justificación (RN-010)', async () => {
    const panel = await abrirEdicion()
    await userEvent.selectOptions(within(panel).getByLabelText(/Periodo de evaluación/), '1')
    expect(within(panel).getByText('Periodo cerrado: requiere justificación para corregirse')).toBeInTheDocument()
    expect(within(panel).getByRole('option', { name: 'Abril 🔒' })).toBeInTheDocument()
  })

  it('guardar borrador envía el estado "pendiente", avisa y cierra el panel', async () => {
    const guardar = vi.spyOn(handlers.evaluaciones, 'guardar')
    const panel = await abrirEdicion()
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByText('Evaluación guardada')).toBeInTheDocument()
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'pendiente', id_periodo: 3 }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar evaluación' })).not.toBeInTheDocument())
  })

  it('confirmar envía el estado "revisado" con la sugerencia y la decisión por separado (RN-014)', async () => {
    const guardar = vi.spyOn(handlers.evaluaciones, 'guardar')
    const panel = await abrirEdicion()
    const nivelFinal = within(panel).getByLabelText(/Nivel final/)
    const elegida = otraLetra(nivelFinal)
    await userEvent.selectOptions(nivelFinal, elegida)
    await userEvent.type(within(panel).getByLabelText(/Justificación del cambio/), 'Ajuste por observación en aula')
    await userEvent.click(within(panel).getByRole('button', { name: 'Confirmar evaluación' }))

    await waitFor(() => expect(guardar).toHaveBeenCalled())
    const [enviado] = guardar.mock.calls[0]
    expect(enviado).toMatchObject({ estado: 'revisado', nivel_ajustado: elegida, justificacion: 'Ajuste por observación en aula' })
    expect(enviado.nivel_sugerido).not.toBe(elegida)
  })

  it('si el guardado falla lo dice y deja el panel abierto', async () => {
    vi.spyOn(handlers.evaluaciones, 'guardar').mockRejectedValue(errorHttp(409, { detail: 'El periodo ya está cerrado' }))
    const panel = await abrirEdicion()
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar borrador' }))

    expect(await screen.findByText('El periodo ya está cerrado')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Editar evaluación' })).toBeInTheDocument()
  })

  it('cancelar cierra sin guardar', async () => {
    const guardar = vi.spyOn(handlers.evaluaciones, 'guardar')
    const panel = await abrirEdicion()
    await userEvent.click(within(panel).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar evaluación' })).not.toBeInTheDocument())
    expect(guardar).not.toHaveBeenCalled()
  })
})

describe('Trazabilidad (P8)', () => {
  const filaDe = (evaluacion) => ({
    nombre: 'Alumno de prueba',
    codigo: 'EST-PRB-1001',
    grado_nombre: '3.° grado',
    colegio: 'I.E. de prueba',
    evaluacion,
    calculo: { motivo: 'Aciertos sobre el umbral del nivel' },
  })
  const AJUSTADA = EVALUACIONES.find((e) => e.ajustado_por_docente && e.justificacion)
  const CONFIRMADA = EVALUACIONES.find((e) => !e.ajustado_por_docente)

  it('sin evaluación no pinta nada', () => {
    const { container } = render(<ModalTrazabilidad open onClose={() => {}} fila={{ evaluacion: null }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('si el docente cambió la sugerencia, muestra la diferencia y su justificación (RN-015)', () => {
    render(<ModalTrazabilidad open onClose={() => {}} fila={filaDe(AJUSTADA)} />)
    const modal = screen.getByRole('dialog', { name: 'Alumno de prueba' })

    expect(within(modal).getByText('Diferencia detectada')).toBeInTheDocument()
    expect(within(modal).getByText('Cambio manual')).toBeInTheDocument()
    expect(within(modal).getByText('Modificado por docente')).toBeInTheDocument()
    expect(within(modal).getByText(AJUSTADA.justificacion)).toBeInTheDocument()
    expect(within(modal).getByText('Aciertos sobre el umbral del nivel')).toBeInTheDocument()
  })

  it('si confirmó la sugerencia, no inventa una diferencia ni pide justificación', () => {
    render(<ModalTrazabilidad open onClose={() => {}} fila={filaDe(CONFIRMADA)} />)
    expect(screen.getByText('Confirmó la sugerencia')).toBeInTheDocument()
    expect(screen.queryByText('Diferencia detectada')).not.toBeInTheDocument()
    expect(screen.queryByText('Justificación del docente')).not.toBeInTheDocument()
  })

  it('un cambio sin justificación registrada lo dice en vez de dejar el hueco', () => {
    render(<ModalTrazabilidad open onClose={() => {}} fila={filaDe({ ...AJUSTADA, justificacion: null })} />)
    expect(screen.getByText('Sin justificación registrada.')).toBeInTheDocument()
  })

  it('pinta un hito por paso de la revisión, aun con un tipo desconocido', () => {
    const hitos = [
      { tipo: 'sistema', titulo: 'Sugerencia calculada', fecha: '2026-10-01T10:00:00Z', autor: 'Sistema' },
      { tipo: 'otro', titulo: 'Hito importado', fecha: '2026-10-02T10:00:00Z', autor: 'Migración' },
    ]
    render(<ModalTrazabilidad open onClose={() => {}} fila={filaDe({ ...CONFIRMADA, trazabilidad: hitos })} />)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Sugerencia calculada'),
      expect.stringContaining('Hito importado'),
    ])
    expect(screen.getByText(/Última modificación: Migración/)).toBeInTheDocument()
  })

  it('sin hitos muestra un guion como última modificación', () => {
    render(<ModalTrazabilidad open onClose={() => {}} fila={filaDe({ ...CONFIRMADA, trazabilidad: undefined })} />)
    expect(screen.getByText(/Última modificación: —/)).toBeInTheDocument()
  })
})
