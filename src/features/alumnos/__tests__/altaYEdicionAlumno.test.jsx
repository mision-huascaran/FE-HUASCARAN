// El popup de Alumnos de punta a punta: lo escrito llega a la API.
//
// Ninguna prueba pulsaba "Guardar" en "Nuevo alumno", y por eso pasó que el
// alta reventara en `sinLosOcultos` —llamaba a `visible(valores)` sin el
// contexto que lee el campo de cambio de grupo— sin que saliera el POST.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AlumnosPage from '../AlumnosPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'
import { hoy } from '../../../lib/relojServidor'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}))

const crear = vi.fn(async (datos) => ({ id_alumno: 999, ...datos }))
const actualizar = vi.fn(async (id, cambios) => ({ id_alumno: id, ...cambios }))
// El resto de la API la resuelve el simulador; solo se espían las escrituras.
vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    crearAlumno: (...args) => crear(...args),
    actualizarAlumno: (...args) => actualizar(...args),
    listarAsignaciones: async () =>
      [
        {
          colegio: { id: 1, nombre: 'I.E. 86021 Ranrahirca' },
          grados: [{ id: 1, nombre: '1.º', cantidad_alumnos: 3, ciclos: ['III'], subprogramas: ['Alfabetización'] }],
        },
      ].map(original.normalizarAsignacion),
  }
})

const ESPERA = { timeout: 8000 }

function montar(idRol) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: idRol === ROLES.DOCENTE ? 1 : null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AlumnosPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** Elige en un desplegable en cuanto la opción existe (los catálogos llegan después). */
async function elegir(dialogo, etiqueta, valor) {
  const select = within(dialogo).getByLabelText(etiqueta)
  await waitFor(() => expect(within(select).getAllByRole('option').some((o) => o.value === valor)).toBe(true), ESPERA)
  fireEvent.change(select, { target: { value: valor } })
}

beforeEach(() => {
  crear.mockClear()
  actualizar.mockClear()
  localStorage.clear()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => {
  useActividadStore.getState().limpiar()
})

describe('Alumnos — guardar desde el popup', () => {
  it('"Nuevo alumno" llama a crearAlumno con lo escrito y la sección única ya puesta', async () => {
    useActividadStore.getState().iniciar({ idDocente: 1 })
    montar(ROLES.DOCENTE)
    fireEvent.click(await screen.findByRole('button', { name: /^agregar$/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)

    fireEvent.change(within(dialogo).getByLabelText(/^Nombres/), { target: { value: 'Rosa' } })
    fireEvent.change(within(dialogo).getByLabelText(/^Apellidos/), { target: { value: 'Huamán Villar' } })
    await elegir(dialogo, /^Colegio/, '1')
    await elegir(dialogo, /^Grado/, '1')
    const programa = within(dialogo).getByLabelText(/^Subprograma/)
    await waitFor(() => expect(within(programa).getAllByRole('option').length).toBeGreaterThan(1), ESPERA)
    const idPrograma = within(programa).getAllByRole('option').find((o) => o.value !== '').value
    fireEvent.change(programa, { target: { value: idPrograma } })
    fireEvent.change(within(dialogo).getByLabelText(/^Pertenece al grupo desde/), { target: { value: hoy() } })

    // El grado tiene una sola sección: el desplegable no se queda en "Seleccione".
    const seccion = within(dialogo).getByLabelText(/^Sección/)
    await waitFor(() => expect(seccion.value).not.toBe(''), ESPERA)

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1), ESPERA)
    expect(crear.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        nombres: 'Rosa',
        apellidos: 'Huamán Villar',
        id_colegio: '1',
        id_grado: '1',
        id_programa: idPrograma,
        id_seccion: seccion.value,
        pertenece_desde: hoy(),
        // Es un alta: la fecha de cambio de grupo no aplica y no se manda.
        cambio_grupo_desde: '',
      }),
    )
  })

  it('"Editar" cambiando el grado pide y envía cambio_grupo_desde', async () => {
    montar(ROLES.SUPERVISOR)
    const [editar] = await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)
    fireEvent.click(editar)
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    const grado = await within(dialogo).findByLabelText(/^Grado/, {}, ESPERA)
    await waitFor(() => expect(grado.value).not.toBe(''), ESPERA)

    // Sin tocar el grupo, no se pide la fecha.
    expect(within(dialogo).queryByLabelText(/^Cambia de grupo desde/)).not.toBeInTheDocument()

    const otroGrado = within(grado).getAllByRole('option').find((o) => o.value !== '' && o.value !== grado.value).value
    fireEvent.change(grado, { target: { value: otroGrado } })

    const fecha = await within(dialogo).findByLabelText(/^Cambia de grupo desde/, {}, ESPERA)
    fireEvent.change(fecha, { target: { value: hoy() } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1), ESPERA)
    const [idAlumno, cambios] = actualizar.mock.calls[0]
    expect(idAlumno).toEqual(expect.any(Number))
    expect(cambios).toEqual(expect.objectContaining({ id_grado: otroGrado, cambio_grupo_desde: hoy() }))
  })
})
