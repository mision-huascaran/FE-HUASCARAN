// CU014 — Inactivar desde la lista de Alumnos manda la fecha efectiva solo a
// quien tiene la pertenencia definida.
//
// Regresión del E2E F3 (422 `aplicar_desde` obligatorio): la lista no trae
// `pertenece_desde`, y un respaldo en `esPendiente` tomaba por pendiente a todo
// alumno activo. La baja salía con el cuerpo vacío. Ahora solo cuenta
// `pertenencia_pendiente`, que es lo que manda el backend.
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

const COLEGIO = { id: 1, nombre: 'I.E. 86021 Ranrahirca' }

/** Como llega una fila del listado real: sin `pertenece_desde`. */
const fila = (id, nombres, apellidos, pendiente) => ({
  id_alumno: id,
  id,
  nombres,
  apellidos,
  nombre: `${nombres} ${apellidos}`,
  dni: null,
  activo: true,
  pertenencia_pendiente: pendiente,
  id_colegio: COLEGIO.id,
  colegio: COLEGIO,
  id_grado: pendiente ? null : 1,
  grado: pendiente ? null : { id: 1, nombre: '1.º' },
  id_programa: pendiente ? null : 1,
  programa: pendiente ? null : { id: 1, nombre: 'Alfabetización' },
  id_seccion: pendiente ? null : 7,
  seccion: pendiente ? null : 'Única',
  ciclo: pendiente ? null : 'III',
})

const PENDIENTE = fila(501, 'Juan', 'Quispe', true)
const DEFINIDO = fila(502, 'Ana', 'Rojas', false)

const listarAlumnos = vi.fn(async () => ({ items: [PENDIENTE, DEFINIDO], total: 2, pagina: 1, paginas: 1, por_pagina: 40 }))

vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, listarAlumnosAdmin: (...a) => listarAlumnos(...a) }
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

/** Inactiva desde el interruptor de la fila y devuelve el diálogo de confirmación. */
async function abrirBaja(nombre) {
  montar()
  fireEvent.click(await screen.findByRole('switch', { name: `Inactivar ${nombre}` }, ESPERA))
  return screen.findByRole('dialog', {}, ESPERA)
}

let enviado
beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  // Lo que viaja al servidor: `cambiarEstadoAlumno` arma el cuerpo y el
  // simulador lo recibe junto con `activo`.
  enviado = vi.spyOn(handlers.administracion, 'actualizarAlumno').mockImplementation(async (id, cambios) => ({ id_alumno: id, ...cambios }))
})

afterEach(() => vi.restoreAllMocks())

describe('Inactivar desde la lista de Alumnos', () => {
  it('pertenencia definida: pide la fecha efectiva y manda aplicar_desde', async () => {
    const dialogo = await abrirBaja('Ana Rojas')
    expect(within(dialogo).getByLabelText(/fecha efectiva/i)).toHaveValue(hoy())

    fireEvent.click(within(dialogo).getByRole('button', { name: /^inactivar$/i }))

    await waitFor(() => expect(enviado).toHaveBeenCalledTimes(1), ESPERA)
    expect(enviado).toHaveBeenCalledWith(DEFINIDO.id_alumno, { activo: false, aplicar_desde: hoy() })
  })

  it('pertenencia pendiente: no pide fecha y la baja va sin aplicar_desde', async () => {
    const dialogo = await abrirBaja('Juan Quispe')
    expect(within(dialogo).queryByLabelText(/fecha efectiva/i)).not.toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: /^inactivar$/i }))

    await waitFor(() => expect(enviado).toHaveBeenCalledTimes(1), ESPERA)
    expect(enviado).toHaveBeenCalledWith(PENDIENTE.id_alumno, { activo: false })
  })
})
