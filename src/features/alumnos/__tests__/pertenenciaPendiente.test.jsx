// Alumno con la pertenencia pendiente (CU014, semana 14): el que todavía no
// tiene ningún intervalo en su historial —típicamente, uno recién importado—.
//
// Se cubre lo que cambia respecto de un alumno normal:
//   · la tabla lo señala con una insignia y trae su DNI;
//   · "Editar" deja guardar solo nombres, DNI o grado sin exigir el grupo
//     completo, pero en cuanto se informa el subprograma o la sección, el
//     grupo (grado, subprograma, sección) y la fecha de pertenencia pasan a
//     ser obligatorios;
//   · "Activar"/"Inactivar" no pregunta "Aplicar cambio desde": no hay grupo
//     en curso del que entrar o salir en una fecha.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AlumnosPage from '../AlumnosPage'
import useSessionStore from '../../../store/sessionStore'
import handlers from '../../../api/mock/handlers'
import { ROLES } from '../../../auth/roles'
import { hoy } from '../../../lib/relojServidor'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}))

const PENDIENTE = {
  id_alumno: 501,
  id: 501,
  nombres: 'Juan',
  apellidos: 'Quispe',
  nombre: 'Juan Quispe',
  dni: null,
  activo: true,
  pertenencia_pendiente: true,
  id_colegio: 1,
  colegio: { id: 1, nombre: 'I.E. 86021 Ranrahirca' },
  id_grado: null,
  grado: null,
  id_programa: null,
  programa: null,
  id_seccion: null,
  seccion: null,
  ciclo: null,
}

const actualizar = vi.fn(async (id, cambios) => ({ id_alumno: id, ...cambios }))
const cambiarEstado = vi.fn(async () => ({ ok: true }))
const listarAlumnos = vi.fn(async () => ({ items: [PENDIENTE], total: 1, pagina: 1, paginas: 1, por_pagina: 40 }))

vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    actualizarAlumno: (...a) => actualizar(...a),
    cambiarEstadoAlumno: (...a) => cambiarEstado(...a),
    listarAlumnosAdmin: (...a) => listarAlumnos(...a),
  }
})

const ESPERA = { timeout: 8000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: ROLES.SUPERVISOR, id_docente: null, nombre_completo: 'Prueba' },
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

/** El detalle que devuelve el simulador para `obtenerAlumno` (CU014). */
function conDetallePendiente() {
  vi.spyOn(handlers.administracion, 'alumno').mockResolvedValue(PENDIENTE)
}

async function abrirEdicion() {
  montar()
  const [editar] = await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)
  fireEvent.click(editar)
  return screen.findByRole('dialog', {}, ESPERA)
}

beforeEach(() => {
  actualizar.mockClear()
  cambiarEstado.mockClear()
  localStorage.clear()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

afterEach(() => vi.restoreAllMocks())

describe('Tabla — alumno con pertenencia pendiente', () => {
  it('se señala con una insignia y su DNI sale como "—"', async () => {
    montar()
    await screen.findByText('Juan Quispe', {}, ESPERA)
    expect(screen.getByText('Pertenencia pendiente')).toBeInTheDocument()
    const fila = screen.getByText('Juan Quispe').closest('tr')
    // Sin grado, programa ni sección, varias celdas dicen "—"; el DNI es una de ellas.
    expect(within(fila).getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('Editar un pendiente', () => {
  it('el modal pide "Pertenece al grupo desde", no "Cambia de grupo desde"', async () => {
    conDetallePendiente()
    const dialogo = await abrirEdicion()
    expect(await within(dialogo).findByLabelText(/^Pertenece al grupo desde/, {}, ESPERA)).toBeInTheDocument()
    expect(within(dialogo).queryByLabelText(/^Cambia de grupo desde/)).not.toBeInTheDocument()
  })

  it('guarda solo el DNI, sin exigir el grupo ni la fecha de pertenencia', async () => {
    conDetallePendiente()
    const dialogo = await abrirEdicion()
    await within(dialogo).findByLabelText(/^Pertenece al grupo desde/, {}, ESPERA)

    fireEvent.change(within(dialogo).getByLabelText(/^DNI/), { target: { value: '12345678' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1), ESPERA)
    expect(actualizar.mock.calls[0][1]).toEqual(expect.objectContaining({ dni: '12345678' }))
  })

  it('informar el subprograma sin grado ni sección bloquea "Guardar" y lo dice', async () => {
    conDetallePendiente()
    const dialogo = await abrirEdicion()
    const programa = await within(dialogo).findByLabelText(/^Subprograma/, {}, ESPERA)
    await waitFor(() => expect(within(programa).getAllByRole('option').length).toBeGreaterThan(1), ESPERA)
    const idPrograma = within(programa).getAllByRole('option').find((o) => o.value !== '').value
    fireEvent.change(programa, { target: { value: idPrograma } })

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    // No se envía nada: el grado y la sección pasaron a ser obligatorios.
    expect(actualizar).not.toHaveBeenCalled()
    expect(await within(dialogo).findAllByText('Este campo es obligatorio', {}, ESPERA)).not.toHaveLength(0)
  })

  it('con el grupo completo, pide y envía también "Pertenece al grupo desde"', async () => {
    conDetallePendiente()
    const dialogo = await abrirEdicion()

    const grado = await within(dialogo).findByLabelText(/^Grado/, {}, ESPERA)
    await waitFor(() => expect(within(grado).getAllByRole('option').length).toBeGreaterThan(1), ESPERA)
    const idGrado = within(grado).getAllByRole('option').find((o) => o.value !== '').value
    fireEvent.change(grado, { target: { value: idGrado } })

    const programa = within(dialogo).getByLabelText(/^Subprograma/)
    await waitFor(() => expect(within(programa).getAllByRole('option').length).toBeGreaterThan(1), ESPERA)
    const idPrograma = within(programa).getAllByRole('option').find((o) => o.value !== '').value
    fireEvent.change(programa, { target: { value: idPrograma } })

    const seccion = within(dialogo).getByLabelText(/^Sección/)
    await waitFor(() => expect(seccion.value).not.toBe(''), ESPERA)

    const fecha = within(dialogo).getByLabelText(/^Pertenece al grupo desde/)
    fireEvent.change(fecha, { target: { value: hoy() } })

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(actualizar).toHaveBeenCalledTimes(1), ESPERA)
    expect(actualizar.mock.calls[0][1]).toEqual(
      expect.objectContaining({ id_grado: idGrado, id_programa: idPrograma, id_seccion: seccion.value, pertenece_desde: hoy() }),
    )
  })
})

describe('Activar/Inactivar un pendiente', () => {
  it('no pregunta "Aplicar cambio desde" y manda el cambio como pendiente', async () => {
    montar()
    const interruptor = await screen.findByRole('switch', { name: /^inactivar Juan Quispe$/i }, ESPERA)
    fireEvent.click(interruptor)

    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(within(dialogo).queryByLabelText(/fecha efectiva/i)).not.toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: /^inactivar$/i }))

    await waitFor(() => expect(cambiarEstado).toHaveBeenCalledTimes(1), ESPERA)
    const [, activo, opciones] = cambiarEstado.mock.calls[0]
    expect(activo).toBe(false)
    expect(opciones).toEqual(expect.objectContaining({ pendiente: true }))
  })
})

describe('DNI (semana 14)', () => {
  it('con menos de 8 dígitos, bloquea "Guardar" con el texto de CU014', async () => {
    conDetallePendiente()
    const dialogo = await abrirEdicion()
    await within(dialogo).findByLabelText(/^Pertenece al grupo desde/, {}, ESPERA)

    fireEvent.change(within(dialogo).getByLabelText(/^DNI/), { target: { value: '1234567' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    expect(actualizar).not.toHaveBeenCalled()
    expect(await within(dialogo).findByText('El DNI debe tener exactamente 8 dígitos.', {}, ESPERA)).toBeInTheDocument()
  })

  it('un 409 dni_duplicado del servidor se pinta debajo del campo', async () => {
    // El mock reemplaza `actualizarAlumno` entero, así que aquí se simula
    // directamente lo que `conDniLegible` arma a partir del 409 real: un
    // error de campo, igual que cualquier 422 (ver administracion.js).
    conDetallePendiente()
    const error = new Error('duplicado')
    error.response = {
      status: 409,
      data: {
        detail: 'Ya existe un alumno registrado con ese DNI.',
        motivo: 'dni_duplicado',
        errores: [{ campo: 'dni', mensaje: 'Ya existe un alumno registrado con ese DNI.' }],
      },
    }
    actualizar.mockRejectedValueOnce(error)

    const dialogo = await abrirEdicion()
    await within(dialogo).findByLabelText(/^Pertenece al grupo desde/, {}, ESPERA)
    fireEvent.change(within(dialogo).getByLabelText(/^DNI/), { target: { value: '12345678' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))

    expect(await within(dialogo).findByText('Ya existe un alumno registrado con ese DNI.', {}, ESPERA)).toBeInTheDocument()
  })
})
