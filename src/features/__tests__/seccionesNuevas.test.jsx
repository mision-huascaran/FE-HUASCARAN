// D110 — Las secciones que se agregan a un grado aparecen en las pantallas.
//
// QA agregó "A" y "B" a un grado que tenía "Única". El backend devolvía las
// tres, pero Asistencias y "Nuevo alumno" seguían ofreciendo solo "Única": el
// detalle del colegio se guardaba en la caché PARA SIEMPRE (y se copia a
// IndexedDB), así que una vez visto no se volvía a pedir.
//
// Aquí la caché arranca con la copia vieja (solo "Única", de hace 10 minutos) y
// el servidor ya tiene "A" y "B". Con conexión, cada pantalla las ofrece; sin
// conexión, se sigue viendo la copia. "Única" no se esconde: eso lo decide el
// analista, no el front.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import AsistenciaPage from '../asistencia/AsistenciaPage'
import AlumnosPage from '../alumnos/AlumnosPage'
import useFiltrosDeGrupo from '../../hooks/useFiltrosDeGrupo'
import { CLAVE_RAIZ_COLEGIO, claveDetalleColegio } from '../../hooks/consultaColegio'
import handlers from '../../api/mock/handlers'
import useSessionStore from '../../store/sessionStore'
import useActividadStore from '../../store/actividadStore'
import { ROLES } from '../../auth/roles'

vi.mock('idb-keyval', () => {
  const almacen = new Map()
  return {
    get: vi.fn(async (k) => almacen.get(k)),
    set: vi.fn(async (k, v) => {
      almacen.set(k, v)
    }),
    del: vi.fn(async (k) => almacen.delete(k)),
  }
})

vi.mock('../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
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
const { obtenerColegio } = await import('../../api/resources/administracion')

/** El servidor ya tiene "A" y "B" en todos los grados, además de "Única". */
let pedidosDelDetalle = 0
function servidorConSeccionesNuevas() {
  const original = handlers.administracion.colegio
  vi.spyOn(handlers.administracion, 'colegio').mockImplementation(async (id) => {
    pedidosDelDetalle += 1
    const colegio = await original(id)
    return {
      ...colegio,
      grados: colegio.grados.map((g) => ({
        ...g,
        secciones: [...g.secciones, { id: 900 + g.id, nombre: 'A' }, { id: 950 + g.id, nombre: 'B' }],
      })),
    }
  })
}

/** Un cliente con la copia VIEJA del colegio 1 (solo "Única"), de hace 10 minutos. */
async function clienteConCopiaVieja() {
  const cliente = crearQueryClient()
  const viejo = await obtenerColegio(1)
  cliente.setQueryData(claveDetalleColegio(1), viejo, { updatedAt: Date.now() - 10 * 60 * 1000 })
  return cliente
}

const conRed = (enLinea) => Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
const nombres = (select) => within(select).getAllByRole('option').map((o) => o.textContent)

function comoDocente() {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombre_completo: 'Docente' },
    cargando: false,
  })
}

function montar(cliente, ui, ruta = '/') {
  return render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  conRed(true)
  comoDocente()
  pedidosDelDetalle = 0
})

afterEach(() => {
  conRed(true)
  onlineManager.setOnline(true)
  useActividadStore.getState().limpiar()
  vi.restoreAllMocks()
})

describe('Con conexión, las secciones nuevas aparecen (D110)', () => {
  it('en Asistencias', async () => {
    const cliente = await clienteConCopiaVieja()
    servidorConSeccionesNuevas()
    localStorage.setItem('sicedu.filtros.asistencia', JSON.stringify({ idColegio: '1', idGrado: '1' }))
    montar(cliente, <AsistenciaPage />)

    fireEvent.click(await screen.findByRole('button', { name: /^filtros$/i }, ESPERA))
    const seccion = await screen.findByLabelText('Sección', {}, ESPERA)
    await waitFor(() => expect(nombres(seccion)).toEqual(expect.arrayContaining(['Única', 'A', 'B'])), ESPERA)
  })

  it('en Lectura, Rúbrica y Registro de Vuelo (sus filtros)', async () => {
    const cliente = await clienteConCopiaVieja()
    servidorConSeccionesNuevas()
    const envoltorio = ({ children }) => (
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={['/seguimiento-lectura?colegio=1&grado=1']}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useFiltrosDeGrupo({ esDocente: false, idAnioEscolar: 1 }), {
      wrapper: envoltorio,
    })

    await waitFor(() => expect(result.current.secciones.map((s) => s.nombre)).toEqual(['Única', 'A', 'B']), ESPERA)
  })

  it('en "Nuevo alumno"', async () => {
    const cliente = await clienteConCopiaVieja()
    servidorConSeccionesNuevas()
    useActividadStore.getState().iniciar({ idDocente: 1 })
    montar(cliente, <AlumnosPage />)

    fireEvent.click(await screen.findByRole('button', { name: /^agregar$/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    for (const [etiqueta, valor] of [
      [/^Colegio/, '1'],
      [/^Grado/, '1'],
    ]) {
      const select = within(dialogo).getByLabelText(etiqueta)
      await waitFor(() => expect(within(select).getAllByRole('option').some((o) => o.value === valor)).toBe(true), ESPERA)
      fireEvent.change(select, { target: { value: valor } })
    }

    const seccion = within(dialogo).getByLabelText(/^Sección/)
    await waitFor(() => expect(nombres(seccion)).toEqual(expect.arrayContaining(['Única', 'A', 'B'])), ESPERA)
  })
})

describe('Sin conexión se sigue viendo la copia (D110)', () => {
  it('no la vacía ni la cambia, y no pide nada', async () => {
    const cliente = await clienteConCopiaVieja()
    servidorConSeccionesNuevas()
    conRed(false)
    onlineManager.setOnline(false)
    const envoltorio = ({ children }) => (
      <QueryClientProvider client={cliente}>
        <MemoryRouter initialEntries={['/seguimiento-lectura?colegio=1&grado=1']}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
    const { result } = renderHook(() => useFiltrosDeGrupo({ esDocente: false, idAnioEscolar: 1 }), {
      wrapper: envoltorio,
    })

    await waitFor(() => expect(result.current.secciones.map((s) => s.nombre)).toEqual(['Única']), ESPERA)
    expect(pedidosDelDetalle).toBe(0)
  })
})

describe('Una sola clave para el detalle (D110)', () => {
  it('el id se normaliza: número o texto de la URL caen en la misma entrada', () => {
    expect(claveDetalleColegio(1)).toEqual(claveDetalleColegio('1'))
    expect(claveDetalleColegio(1).slice(0, 1)).toEqual(CLAVE_RAIZ_COLEGIO)
  })

  it('invalidar la raíz deja el detalle por volver a pedir', async () => {
    const cliente = await clienteConCopiaVieja()
    cliente.setQueryData(claveDetalleColegio(1), await obtenerColegio(1))
    await cliente.invalidateQueries({ queryKey: CLAVE_RAIZ_COLEGIO })
    expect(cliente.getQueryState(claveDetalleColegio(1)).isInvalidated).toBe(true)
  })
})
