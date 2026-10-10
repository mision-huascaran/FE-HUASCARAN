// Nivel final mensual (P9): elegir colegio, abrir el ajuste de un alumno y
// guardarlo con su justificación. Cubre RF-018, RF-023, RN-009 y RN-015.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import NivelFinalPage from '../NivelFinalPage'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

async function abrirAjuste() {
  renderConProveedores(<NivelFinalPage />, { ruta: '/nivel-final', rol: ROLES.DOCENTE })
  expect(screen.getByText('Elija un colegio')).toBeInTheDocument()

  // En jsdom no hay ancho de escritorio: los filtros viven en el panel "Filtros".
  await userEvent.click(screen.getByRole('button', { name: /^Filtros/ }))
  const colegio = screen.getByLabelText(/^Colegio/)
  await waitFor(() => expect(colegio.options.length).toBeGreaterThan(1))
  await userEvent.selectOptions(colegio, '1')
  await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

  const [ajustar] = await screen.findAllByRole('button', { name: /Ajustar nivel final de/ }, { timeout: 8000 })
  await userEvent.click(ajustar)
  return screen.findByRole('dialog', { name: 'Ajustar nivel final' })
}

/** Elige en el selector un nivel distinto del calculado, que es el que viene puesto. */
async function cambiarNivel(panel) {
  const selector = within(panel).getByLabelText(/^Nivel final/)
  const otro = [...selector.options].map((o) => o.value).find((v) => v && v !== selector.value)
  await userEvent.selectOptions(selector, otro)
  return otro
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Ajuste del nivel final (P9)', () => {
  it('el nivel calculado se muestra bloqueado y explica de dónde sale (RF-018)', async () => {
    const panel = await abrirAjuste()
    expect(within(panel).getByText('Nivel calculado')).toBeInTheDocument()
    expect(within(panel).getByText(/rúbricas semanales del mes\. No es editable\./)).toBeInTheDocument()
    expect(within(panel).getByText('Solo se exige cuando el nivel final difiere del calculado.')).toBeInTheDocument()
  })

  it('cambiar el nivel calculado obliga a justificar (RN-015)', async () => {
    const panel = await abrirAjuste()
    const guardar = within(panel).getByRole('button', { name: 'Guardar ajuste' })
    await cambiarNivel(panel)

    expect(within(panel).getByText('Obligatoria al modificar el nivel calculado')).toBeInTheDocument()
    expect(guardar).toBeDisabled()

    await userEvent.type(within(panel).getByLabelText(/^Justificación/), 'Avanzó en las dos últimas semanas')
    expect(guardar).toBeEnabled()
  })

  it('guarda el ajuste con el mes, el nivel y la justificación, y cierra', async () => {
    const ajustar = vi.spyOn(handlers.nivelFinal, 'ajustar')
    const panel = await abrirAjuste()
    const nivel = await cambiarNivel(panel)
    await userEvent.type(within(panel).getByLabelText(/^Justificación/), 'Avanzó en las dos últimas semanas')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar ajuste' }))

    expect(await screen.findByText('Nivel final ajustado')).toBeInTheDocument()
    expect(ajustar).toHaveBeenCalledWith(
      expect.objectContaining({ nivel_final: nivel, justificacion: 'Avanzó en las dos últimas semanas', mes: expect.stringMatching(/^\d{4}-\d{2}$/) }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajustar nivel final' })).not.toBeInTheDocument())
  })

  it('si el servidor rechaza el ajuste lo dice y deja el panel abierto', async () => {
    vi.spyOn(handlers.nivelFinal, 'ajustar').mockRejectedValue(errorHttp(409, { detail: 'El mes ya fue cerrado' }))
    const panel = await abrirAjuste()
    await cambiarNivel(panel)
    await userEvent.type(within(panel).getByLabelText(/^Justificación/), 'Motivo')
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar ajuste' }))

    expect(await screen.findByText('El mes ya fue cerrado')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Ajustar nivel final' })).toBeInTheDocument()
  })

  it('cancelar cierra sin guardar', async () => {
    const ajustar = vi.spyOn(handlers.nivelFinal, 'ajustar')
    const panel = await abrirAjuste()
    await userEvent.click(within(panel).getByRole('button', { name: 'Cancelar' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajustar nivel final' })).not.toBeInTheDocument())
    expect(ajustar).not.toHaveBeenCalled()
  })
})
