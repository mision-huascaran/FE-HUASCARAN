// Alumnos sin conexión da lo mismo que con conexión (CU014, D61). Datos inventados.
//
// El caso del probador: con conexión, "Todos" y la búsqueda muestran a un
// alumno inactivo con pertenencia pendiente, sin sección ni subprograma. Se
// corta la red sin recargar y la tabla quedaba en "Sin registros", porque la
// precarga solo traía activos. Y su detalle decía "No se encontró al alumno".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AlumnosPage from '../AlumnosPage'
import FichaEstudiantePage from '../../estudiantes/FichaEstudiantePage'
import { alumnosSinConexion, buscarAlumnoLocal, unirAlumnosLocales } from '../alumnosSinConexion'
import useSessionStore from '../../../store/sessionStore'
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

const ACTIVO = { id_alumno: 701, nombre: 'Prueba Activa, Uno', id_colegio: 1, id_grado: 1, id_programa: 1, id_seccion: 3, seccion: 'A', activo: true }
const PENDIENTE = {
  id_alumno: 702,
  nombre: 'AAA Ficticio, Inactivo',
  colegio: { id: 1, nombre: 'I.E. Ficticia' },
  id_colegio: 1,
  grado: { id: 1, nombre: '1.°' },
  id_grado: 1,
  id_programa: null,
  id_seccion: null,
  seccion: null,
  activo: false,
  pertenencia_pendiente: true,
}

// Con conexión, el servidor: "Todos" trae a los dos, búsqueda incluida.
const listar = vi.fn()
vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    listarAlumnosAdmin: (...args) => listar(...args),
    obtenerAlumno: async () => {
      throw Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
    },
  }
})

const ESPERA = { timeout: 8000 }
const definirConexion = (enLinea) => Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })

function iniciarSesion() {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: ROLES.DOCENTE, id_docente: 1, nombre_completo: 'Prueba' },
    cargando: false,
  })
}

/** La precarga que dejó una versión anterior: solo con activos. */
async function sembrarPrecarga(alumnos) {
  const idb = await import('idb-keyval')
  idb.__sembrar('sicedu.precarga', { propietario: 4, guardadoEn: new Date().toISOString(), datos: { alumnos } })
}

function montar(ui, ruta = '/') {
  iniciarSesion()
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/estudiantes/:id" element={<FichaEstudiantePage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  localStorage.clear()
  const idb = await import('idb-keyval')
  idb.__limpiar()
  definirConexion(true)
  listar.mockReset()
  listar.mockImplementation(async (filtros) => {
    const { filtrarAlumnos } = await vi.importActual('../../../api/resources/administracion')
    return { items: filtrarAlumnos([ACTIVO, PENDIENTE], filtros) }
  })
  // "Todos" en cada filtro y la búsqueda del probador.
  localStorage.setItem('sicedu.filtros.alumnos', JSON.stringify({ estado: 'todos', q: 'AAA' }))
})

// TanStack Query sigue los eventos `online`/`offline`: sin devolverle la red,
// el caso siguiente arrancaría con todas las consultas en pausa.
afterEach(() => {
  definirConexion(true)
  window.dispatchEvent(new Event('online'))
  onlineManager.setOnline(true)
})

describe('Alumnos sin conexión (CU014)', () => {
  it('al perder la conexión sin recargar, la tabla sigue mostrando al alumno inactivo con pertenencia pendiente', async () => {
    await sembrarPrecarga([ACTIVO])
    montar(<AlumnosPage />)
    expect(await screen.findByText(PENDIENTE.nombre, {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Pertenencia pendiente')).toBeInTheDocument()

    act(() => {
      definirConexion(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(await screen.findByText(/Se muestra la última información guardada en este equipo/, {}, ESPERA)).toBeInTheDocument()
    expect(await screen.findByText(PENDIENTE.nombre, {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText(ACTIVO.nombre)).not.toBeInTheDocument()
  })

  it('abriendo ya sin conexión, la precarga con inactivos da el mismo resultado', async () => {
    await sembrarPrecarga([ACTIVO, PENDIENTE])
    localStorage.setItem('sicedu.filtros.alumnos', JSON.stringify({ estado: 'todos', q: 'aaa ficticio' }))
    definirConexion(false)
    montar(<AlumnosPage />)
    expect(await screen.findByText(PENDIENTE.nombre, {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText(ACTIVO.nombre)).not.toBeInTheDocument()
    expect(listar).not.toHaveBeenCalled()
  })

  it('el detalle se abre sin conexión con la fila de la copia local', async () => {
    await sembrarPrecarga([ACTIVO, PENDIENTE])
    definirConexion(false)
    montar(<AlumnosPage />, `/estudiantes/${PENDIENTE.id_alumno}`)
    expect(await screen.findByRole('heading', { level: 1, name: PENDIENTE.nombre }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.queryByText('No se encontró al alumno')).not.toBeInTheDocument()
  })
})

describe('Ficha del alumno sin conexión y sin copia (bug 5)', () => {
  const NO_DISPONIBLE = 'Contenido no disponible sin conexión'

  it('Resumen, Registro de Vuelo, Rúbrica y Seguimiento de Lectura no muestran ceros ni "Sin evaluar" falsos', async () => {
    await sembrarPrecarga([ACTIVO, PENDIENTE])
    definirConexion(false)
    onlineManager.setOnline(false)
    montar(<AlumnosPage />, `/estudiantes/${PENDIENTE.id_alumno}`)
    await screen.findByRole('heading', { level: 1, name: PENDIENTE.nombre }, ESPERA)

    expect(await screen.findByText(NO_DISPONIBLE, {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText('Sin evaluar')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin datos de asistencia')).not.toBeInTheDocument()

    for (const pestana of ['Registro de Vuelo', 'Rúbrica', 'Seguimiento de Lectura']) {
      fireEvent.click(screen.getByRole('tab', { name: pestana }))
      expect(await screen.findByText(NO_DISPONIBLE, {}, ESPERA)).toBeInTheDocument()
      expect(screen.queryByText(/Sin registros/i)).not.toBeInTheDocument()
    }
  })
})

describe('alumnosSinConexion', () => {
  const enLinea = (cliente, filas, filtros = {}) => cliente.setQueryData(['alumnos', 'mantenimiento', filtros, true, true], filas)

  it('une la precarga con lo visto con conexión, sin repetir y quedándose con lo visto', () => {
    const cliente = new QueryClient()
    enLinea(cliente, [{ ...ACTIVO, nombre: 'Prueba Activa, Uno (editado)' }, PENDIENTE])
    const filas = alumnosSinConexion(cliente, { alumnos: [ACTIVO] })
    expect(filas.map((a) => a.id_alumno)).toEqual([701, 702])
    expect(filas[0].nombre).toBe('Prueba Activa, Uno (editado)')
  })

  it('no toma las consultas hechas sin conexión (son la propia copia)', () => {
    const cliente = new QueryClient()
    cliente.setQueryData(['alumnos', 'mantenimiento', {}, false, true], [PENDIENTE])
    expect(alumnosSinConexion(cliente, { alumnos: [ACTIVO] }).map((a) => a.id_alumno)).toEqual([701])
  })

  it('reconoce el id del backend (`id`) y el del simulador (`id_alumno`)', () => {
    expect(unirAlumnosLocales([{ id: 5, nombre: 'X' }], [{ id_alumno: 5, nombre: 'Y' }])).toEqual([{ id_alumno: 5, nombre: 'Y' }])
    expect(buscarAlumnoLocal(new QueryClient(), { alumnos: [{ id: 9 }] }, '9')).toEqual({ id: 9 })
    expect(buscarAlumnoLocal(new QueryClient(), null, '9')).toBeNull()
  })
})
