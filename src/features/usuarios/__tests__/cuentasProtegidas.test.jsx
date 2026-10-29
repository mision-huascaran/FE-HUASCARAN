// D68 — Dos cuentas que no se pueden desactivar, y el botón lo dice (CU016).
//
// El backend ya las rechaza: `auto_desactivacion` con la propia cuenta, y la
// protección del Supervisor original, que CU001 declara que "no puede ser
// eliminada, no puede ser desactivada". Pero el botón se veía habilitado y
// había que pulsarlo para enterarse, que es enterarse tarde.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import MantenimientoUsuarios from '../MantenimientoUsuarios'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

const YO = 4
const USUARIOS = [
  // El Supervisor original: intocable por cualquiera, incluido él mismo.
  { id_usuario: 1, nombre: 'Ada Original', nombres: 'Ada', apellidos: 'Original', correo: 'ada@sicedu.test', id_rol: ROLES.JEFA, rol: 'Supervisor', activo: true, es_supervisor_original: true },
  // La cuenta con la que se está mirando la pantalla.
  { id_usuario: YO, nombre: 'Sara Supervisora', nombres: 'Sara', apellidos: 'Supervisora', correo: 'sara@sicedu.test', id_rol: ROLES.JEFA, rol: 'Supervisor', activo: true, es_supervisor_original: false },
  // Una cualquiera, que sí se puede desactivar.
  { id_usuario: 9, nombre: 'Rosa Docente', nombres: 'Rosa', apellidos: 'Docente', correo: 'rosa@sicedu.test', id_rol: ROLES.PROFESOR, rol: 'Docente', activo: true, es_supervisor_original: false },
]

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarUsuariosAdmin: vi.fn(async () => ({ items: USUARIOS, total: USUARIOS.length })),
  listarColegiosAdmin: vi.fn(async () => ({ items: [], total: 0 })),
  listarGradosAdmin: vi.fn(async () => []),
  listarEstadoCalendario: vi.fn(async () => []),
  listarAniosEscolares: vi.fn(async () => [{ id: 2, nombre: '2026', vigente: true }]),
}))

const botonDe = (nombre) =>
  screen.getAllByRole('button', { name: /^(inactivar|activar) /i }).find((b) => (b.getAttribute('aria-label') ?? '').includes(nombre))

function montar() {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: YO, id_rol: ROLES.JEFA, nombres: 'Sara', id_docente: null },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <MantenimientoUsuarios />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  // El Supervisor no necesita actividad para gestionar cuentas, pero se deja
  // abierta para que el test hable de la protección y no del bloqueo de D59.
  useActividadStore.getState().limpiar()
})

describe('Cuentas protegidas (D68, CU016)', () => {
  it('el Supervisor original no se puede desactivar, y el tooltip lo explica', async () => {
    montar()
    await screen.findAllByRole('button', { name: /^inactivar /i }, ESPERA)

    const boton = botonDe('Ada Original')
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'La cuenta del Supervisor original no se puede desactivar.')
  })

  it('la propia cuenta tampoco, con el texto del backend', async () => {
    // El servidor responde `409 auto_desactivacion` con estas mismas palabras.
    montar()
    await screen.findAllByRole('button', { name: /^inactivar /i }, ESPERA)

    const boton = botonDe('Sara Supervisora')
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('title', 'No puedes desactivar tu propia cuenta.')
  })

  it('las demás cuentas se pueden desactivar con normalidad', async () => {
    // La protección es de DOS filas concretas, no del botón entero: si
    // deshabilitara todas, Usuarios dejaría de servir para lo que existe.
    montar()
    await screen.findAllByRole('button', { name: /^inactivar /i }, ESPERA)

    const boton = botonDe('Rosa Docente')
    expect(boton).toBeEnabled()
    expect(boton).not.toHaveAttribute('title')
  })
})
