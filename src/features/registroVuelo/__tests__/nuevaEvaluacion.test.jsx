// Registrar evaluación diagnóstica (P7): el formulario guiado de tres pasos.
// Cubre RF-019, RF-020, RN-004, RN-005 y RN-010.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import { ALUMNOS, EVALUACIONES } from '../../../api/mock/db'
import NuevaEvaluacionPage from '../NuevaEvaluacionPage'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

// Un alumno con evaluación en julio: su nivel final es el nivel inicial de octubre (RN-005).
const ALUMNO = ALUMNOS.find((a) => EVALUACIONES.some((e) => e.id_alumno === a.id_alumno && e.id_periodo === 2))
const OCTUBRE = '3'

const boton = (nombre) => screen.getByRole('button', { name: nombre })

async function elegirAlumno() {
  renderConProveedores(<NuevaEvaluacionPage />, { ruta: '/registro-vuelo/nuevo', rol: ROLES.DOCENTE })
  await userEvent.type(screen.getByLabelText('Buscar estudiante'), ALUMNO.codigo)
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(ALUMNO.codigo) }, { timeout: 4000 }))
  return screen.findByLabelText(/Periodo de evaluación/)
}

/** Elige la primera opción real (no el placeholder) de un selector. */
async function elegirPrimera(etiqueta) {
  const selector = screen.getByLabelText(etiqueta)
  const opcion = [...selector.options].find((o) => o.value && !o.disabled)
  await userEvent.selectOptions(selector, opcion.value)
}

async function completarPrueba() {
  await userEvent.selectOptions(await elegirAlumno(), OCTUBRE)
  await elegirPrimera(/Nivel de la prueba tomada/)
  await userEvent.type(screen.getByLabelText(/^Aciertos/), '4')
  await elegirPrimera(/Rúbrica de Fluidez/)
  await elegirPrimera(/Rúbrica de Comprensión/)
  // El nivel inicial sale del histórico del alumno, que llega por su cuenta.
  await waitFor(() => expect(boton('Revisar y guardar')).toBeEnabled())
}

beforeEach(() => {
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => {
  useActividadStore.getState().limpiar()
  vi.restoreAllMocks()
})

describe('Paso 1: elegir al estudiante', () => {
  it('no busca con menos de 3 caracteres y avisa si no hay resultados', async () => {
    const listar = vi.spyOn(handlers.alumnos, 'listar')
    renderConProveedores(<NuevaEvaluacionPage />, { ruta: '/registro-vuelo/nuevo', rol: ROLES.DOCENTE })
    await userEvent.type(screen.getByLabelText('Buscar estudiante'), 'ab')
    await new Promise((r) => setTimeout(r, 500))
    expect(listar).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Buscar estudiante'), 'zzzz-no-existe')
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()
  })

  it('al elegirlo autocompleta y bloquea sus datos, y pasa al segundo paso (RN-004)', async () => {
    await elegirAlumno()
    await userEvent.click(boton('Anterior'))

    expect(screen.getByLabelText('ID del sistema')).toHaveValue(ALUMNO.codigo)
    expect(screen.getByLabelText('ID del sistema')).toBeDisabled()
    expect(screen.getByLabelText('Grado')).toHaveValue(`${ALUMNO.id_grado}.°`)
  })
})

describe('Paso 2: la prueba', () => {
  it('los cortes cerrados no se pueden elegir (RN-010)', async () => {
    const periodo = await elegirAlumno()
    expect(within(periodo).getByRole('option', { name: /Abril/ })).toBeDisabled()
    expect(within(periodo).getByRole('option', { name: /Octubre/ })).toBeEnabled()
  })

  it('no deja avanzar hasta completar la prueba y las dos dimensiones de la rúbrica (RN-008)', async () => {
    await completarPrueba()

    // Quitar una sola dimensión de la rúbrica vuelve a bloquear el avance.
    await userEvent.selectOptions(screen.getByLabelText(/Rúbrica de Comprensión/), '')
    expect(boton('Revisar y guardar')).toBeDisabled()
    await elegirPrimera(/Rúbrica de Comprensión/)
    expect(boton('Revisar y guardar')).toBeEnabled()

    // Y sin nivel de prueba, también.
    await userEvent.selectOptions(screen.getByLabelText(/Nivel de la prueba tomada/), '')
    expect(boton('Revisar y guardar')).toBeDisabled()
  })
})

describe('Paso 3: revisar y guardar', () => {
  it('guarda la evaluación como revisada y vuelve al histórico', async () => {
    const guardar = vi.spyOn(handlers.evaluaciones, 'guardar')
    await completarPrueba()
    await userEvent.type(screen.getByLabelText('Observaciones'), 'Lee con buena entonación')
    await userEvent.click(boton('Revisar y guardar'))

    expect(screen.getByText('Lee con buena entonación')).toBeInTheDocument()
    await userEvent.click(boton('Guardar evaluación'))

    await waitFor(() => expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/registro-vuelo'))
    expect(guardar).toHaveBeenCalledWith(
      expect.objectContaining({ id_alumno: ALUMNO.id_alumno, id_periodo: 3, aciertos: 4, total: 5, estado: 'revisado' }),
    )
    // RN-005: el nivel inicial sale del periodo anterior, no lo escribe nadie.
    expect(guardar.mock.calls[0][0].nivel_inicial_razkids).toBeTruthy()
  })

  it('el borrador se guarda como pendiente', async () => {
    const guardar = vi.spyOn(handlers.evaluaciones, 'guardar')
    await completarPrueba()
    await userEvent.click(boton('Revisar y guardar'))
    await userEvent.click(boton('Guardar borrador'))
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ estado: 'pendiente' })))
  })

  it('si el guardado falla lo dice y se queda en la revisión', async () => {
    vi.spyOn(handlers.evaluaciones, 'guardar').mockRejectedValue(errorHttp(409, { detail: 'No hay una actividad iniciada' }))
    await completarPrueba()
    await userEvent.click(boton('Revisar y guardar'))
    await userEvent.click(boton('Guardar evaluación'))

    expect(await screen.findByText('No hay una actividad iniciada')).toBeInTheDocument()
    expect(boton('Guardar evaluación')).toBeInTheDocument()
  })

  it('sin actividad iniciada no deja guardar (CU010)', async () => {
    useActividadStore.getState().limpiar()
    await completarPrueba()
    await userEvent.click(boton('Revisar y guardar'))
    expect(boton('Guardar evaluación')).toBeDisabled()
    expect(boton('Guardar borrador')).toBeDisabled()
  })

  it('cancelar vuelve al histórico sin guardar', async () => {
    const guardar = vi.spyOn(handlers.evaluaciones, 'guardar')
    await completarPrueba()
    await userEvent.click(boton('Revisar y guardar'))
    await userEvent.click(boton('Cancelar'))

    await waitFor(() => expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/registro-vuelo'))
    expect(guardar).not.toHaveBeenCalled()
  })
})
