// Regresiones de la ejecución del 09/10/2026 (Plan de Pruebas, CP06, CP14,
// CP-INI-04) sobre el módulo Alumnos:
//
//   D02 — los filtros se guardan en LocalStorage (CU014, paso 5).
//   D06 — sin conexión la tabla se lee de la precarga de IndexedDB.
//   D07 — sin conexión "Nuevo", "Editar" e "Inactivar" se ven deshabilitados
//         con el aviso, en vez de desaparecer.
//   D10 — el Docente tiene en el formulario los colegios y grados asignados.
//   D11 — "Inactivar" usa el id del alumno y la ruta de baja lógica.
//
// Los casos que escriben ABREN UNA ACTIVIDAD primero: CU010 exige una activa
// para que el Docente pueda crear, editar o inactivar, y sin ella los botones
// salen deshabilitados a propósito.
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

vi.mock('idb-keyval', () => {
  let almacen = {}
  return {
    get: vi.fn(async (k) => almacen[k]),
    set: vi.fn(async (k, v) => {
      almacen[k] = v
    }),
    del: vi.fn(async (k) => {
      delete almacen[k]
    }),
    __sembrar: (k, v) => {
      almacen[k] = v
    },
    __limpiar: () => {
      almacen = {}
    },
  }
})

const cambiarEstado = vi.fn(async () => ({ ok: true }))
// La API se resuelve con el simulador; solo se espía la baja lógica y se fijan
// las asignaciones con la forma ANIDADA que devuelve el backend.
vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    cambiarEstadoAlumno: (...args) => cambiarEstado(...args),
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

/** CU010: sin actividad abierta el Docente no puede escribir. */
function abrirActividad() {
  useActividadStore.getState().iniciar({ idDocente: 1 })
}

function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}

function montar(idRol = ROLES.DOCENTE) {
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

beforeEach(async () => {
  cambiarEstado.mockClear()
  localStorage.clear()
  const idb = await import('idb-keyval')
  idb.__limpiar()
  definirConexion(true)
})

afterEach(() => {
  definirConexion(true)
  // La actividad no puede filtrarse de un caso al siguiente: el de sin
  // conexión comprueba justamente que los botones estén deshabilitados.
  useActividadStore.getState().limpiar()
})

describe('Alumnos — hallazgos del 09/10/2026', () => {
  it('D06/D07: sin conexión muestra los alumnos de la precarga y deshabilita la escritura con aviso', async () => {
    const idb = await import('idb-keyval')
    idb.__sembrar('sicedu.precarga', {
      propietario: 4,
      guardadoEn: new Date().toISOString(),
      datos: {
        alumnos: [
          { id_alumno: 501, nombre: 'Ana María Quispe', id_colegio: 1, id_grado: 1, id_programa: 1, activo: true },
          { id_alumno: 502, nombre: 'Luis Huamán', id_colegio: 1, id_grado: 1, id_programa: 1, activo: true },
        ],
      },
    })
    definirConexion(false)
    montar()

    expect(await screen.findByText('Ana María Quispe', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Luis Huamán')).toBeInTheDocument()

    const aviso = 'Acción no disponible sin conexión. Conéctate a internet para gestionar estudiantes.'
    const nuevo = screen.getByRole('button', { name: /^nuevo$/i })
    expect(nuevo).toBeDisabled()
    expect(nuevo).toHaveAttribute('title', aviso)
    screen.getAllByRole('button', { name: /^(editar|inactivar) /i }).forEach((boton) => {
      expect(boton).toBeDisabled()
      expect(boton).toHaveAttribute('title', aviso)
    })
  })

  it('D02: el filtro aplicado se guarda en LocalStorage', async () => {
    montar()
    const ciclo = await screen.findByLabelText('Ciclo', {}, ESPERA)
    fireEvent.change(ciclo, { target: { value: '1' } })
    // Se filtra al pulsar, no al teclear: una sola consulta en vez de una por
    // cada campo que se toca.
    fireEvent.click(screen.getByRole('button', { name: /^filtrar$/i }))

    await waitFor(() => {
      const guardado = JSON.parse(localStorage.getItem('sicedu.filtros.alumnos'))
      expect(String(guardado.id_ciclo)).toBe('1')
    })
  })

  it('D10: el Docente puede elegir su colegio y grado asignados en "Nuevo"', async () => {
    abrirActividad()
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /^nuevo$/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)

    const colegio = within(dialogo).getByLabelText(/^Colegio/)
    await waitFor(() => expect(within(colegio).getByRole('option', { name: 'I.E. 86021 Ranrahirca' })).toBeInTheDocument(), ESPERA)
    const grado = within(dialogo).getByLabelText(/^Grado/)
    // Solo el grado asignado (1.º), además del marcador "Seleccione".
    const opciones = within(grado).getAllByRole('option').filter((o) => o.value !== '')
    expect(opciones.map((o) => o.value)).toEqual(['1'])
  })

  it('D11: "Inactivar" envía el id del alumno por la ruta de baja lógica', async () => {
    abrirActividad()
    montar()
    const [inactivar] = await screen.findAllByRole('button', { name: /^inactivar /i }, ESPERA)
    fireEvent.click(inactivar)
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Inactivar' }))

    await waitFor(() => expect(cambiarEstado).toHaveBeenCalled())
    const [idAlumno, activo] = cambiarEstado.mock.calls[0]
    expect(idAlumno).toEqual(expect.any(Number))
    expect(activo).toBe(false)
  })

  it('sin actividad abierta, "Editar" e "Inactivar" están deshabilitados', async () => {
    // CU010: las escrituras del Docente exigen una actividad activa. Si los
    // botones siguieran vivos, el docente rellenaría el formulario entero para
    // que el servidor se lo rechace al guardar con un 409.
    montar()
    await screen.findAllByRole('button', { name: /^inactivar /i }, ESPERA)

    const motivo = 'Pulse "Iniciar actividad" para poder registrar.'
    const nuevo = screen.getByRole('button', { name: /^nuevo$/i })
    expect(nuevo).toBeDisabled()
    expect(nuevo).toHaveAttribute('title', motivo)

    screen.getAllByRole('button', { name: /^(editar|inactivar) /i }).forEach((boton) => {
      expect(boton).toBeDisabled()
      expect(boton).toHaveAttribute('title', motivo)
    })
  })

  it('al abrir actividad, los botones de escritura se habilitan', async () => {
    abrirActividad()
    montar()
    await screen.findAllByRole('button', { name: /^inactivar /i }, ESPERA)

    expect(screen.getByRole('button', { name: /^nuevo$/i })).toBeEnabled()
    screen.getAllByRole('button', { name: /^(editar|inactivar) /i }).forEach((boton) => {
      expect(boton).toBeEnabled()
    })
  })

  it('los filtros caben en una fila y se aplican con el botón', async () => {
    // Antes cada filtro ocupaba el ancho completo y había que bajar seis veces
    // para ver el primer alumno.
    montar()
    const filtrar = await screen.findByRole('button', { name: /^filtrar$/i }, ESPERA)

    // Todos los filtros y los botones viven en el mismo contenedor.
    const fila = filtrar.closest('form')
    expect(within(fila).getByLabelText('Ciclo')).toBeInTheDocument()
    expect(within(fila).getByLabelText('Estado')).toBeInTheDocument()
    expect(within(fila).getByRole('button', { name: /^limpiar$/i })).toBeInTheDocument()
  })
})
