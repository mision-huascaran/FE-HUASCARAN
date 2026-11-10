// Colegios (CU013): el alta pide los Subprogramas, que son obligatorios.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import MantenimientoColegios from '../MantenimientoColegios'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'
import usePrecarga from '../../../hooks/usePrecarga'

vi.mock('../../../hooks/usePrecarga', () => ({ default: vi.fn(() => null) }))

const ESPERA = { timeout: 8000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: ROLES.JEFA, id_docente: null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/colegios']}>
          <Routes>
            <Route path="/colegios" element={<MantenimientoColegios />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('Colegios (CU013)', () => {
  it('Nuevo colegio pide los Subprogramas, obligatorios en CU013', async () => {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /agregar/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    expect(within(dialogo).getByText('Subprogramas')).toBeInTheDocument()
    expect(await within(dialogo).findByRole('checkbox', { name: /Alfabetización/ }, ESPERA)).toBeInTheDocument()
  })

  /**
   * D61 y D70 — CP-COL-04, CP-CAL-01. Sin conexión la pantalla entera se
   * cambiaba por "Requiere conexión": no se veía la copia y no había forma
   * de llegar al Calendario académico, que sí se consulta sin conexión.
   */
  it('sin conexión sigue mostrando los colegios y deja abrir el calendario', async () => {
    // D61 — Al perder la conexión A MITAD de sesión la pantalla pasa a leer
    // la copia precargada (la misma que usa un arranque ya sin conexión):
    // por eso tiene que haber algo en ella, o se vería "Sin registros" al
    // caer la red igual que antes de corregir D61.
    usePrecarga.mockReturnValue({
      colegios: [{ id_colegio: 1, nombre: 'I.E. 1234', departamento: 'Áncash', provincia: 'Yungay', distrito: 'Yungay', activo: true }],
    })
    montar()
    await screen.findByRole('table', {}, ESPERA)
    await screen.findAllByRole('button', { name: /^editar /i }, ESPERA)

    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })

    // D61 — Cambiar de fuente (del servidor a la copia precargada) es ahora
    // una consulta nueva, así que la tabla pasa por un instante de carga: se
    // espera a que vuelva a aparecer en vez de comprobarla al instante.
    expect(await screen.findByRole('table', {}, ESPERA)).toBeInTheDocument()
    expect(screen.queryByText('Requiere conexión')).not.toBeInTheDocument()
    expect((await screen.findAllByRole('button', { name: /^editar /i }, ESPERA))[0]).toBeDisabled()
    expect(screen.getByRole('button', { name: /calendario académico/i })).toBeEnabled()
  })

  /**
   * D61 — "sigue mostrando los colegios" de arriba cubre perder la conexión A
   * MITAD de sesión, con la lista ya en la caché de TanStack Query. Pero
   * "reabrir SICEDU sin conexión" es otra cosa: no hay nada en memoria, y la
   * pantalla solo tiene lo que haya en la copia de IndexedDB (la precarga del
   * Supervisor). Sin este camino, la consulta se iba al servidor, fallaba y
   * la tabla quedaba en "Sin registros" aunque los colegios sí estuvieran
   * descargados.
   */
  it('al abrir ya sin conexión, lee la copia precargada en vez de quedar sin registros', async () => {
    usePrecarga.mockReturnValue({
      colegios: [
        {
          id_colegio: 1,
          nombre: 'I.E. Precargada',
          departamento: 'Áncash',
          provincia: 'Yungay',
          distrito: 'Yungay',
          activo: true,
        },
      ],
    })
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })

    montar()

    expect(await screen.findByText('I.E. Precargada', {}, ESPERA)).toBeInTheDocument()
  })

  it('al inactivar un colegio lo confirma y vuelve a pedir la lista (S4)', async () => {
    montar()
    const [interruptor] = await screen.findAllByRole('switch', { name: /^inactivar /i }, ESPERA)
    fireEvent.click(interruptor)
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)
    fireEvent.click(within(dialogo).getByRole('button', { name: /^inactivar$/i }))

    expect(await screen.findByText('Colegio inactivado', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('No se borró ningún alumno ni registro.')).toBeInTheDocument()
  })
})

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  window.dispatchEvent(new Event('online'))
  usePrecarga.mockReturnValue(null)
})
