// Detalles de uso del módulo Usuarios revisados el 09/10/2026.
//
//   · El popup de alta pedía "Año escolar", "Colegio asignado" y "Grados"
//     también al crear un Supervisor o un Directivo. Son cuentas GLOBALES: no
//     tienen colegio ni grados que asignar. Aparecían en gris con la ayuda
//     "Solo para Docente" debajo, y aun así se dejaban rellenar.
//   · La búsqueda por nombre existía en Alumnos y faltaba aquí, aunque
//     `GET /usuarios` acepta `q` desde el primer día.
//   · Usuarios tenía una pestaña "Alumnos" que montaba el MISMO componente
//     que la sección Alumnos del menú. Dos caminos al mismo sitio.
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import MantenimientoUsuarios from '../MantenimientoUsuarios'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.2.2026',
    usuario: { id_usuario: 2, id_rol: ROLES.SUPERVISOR, nombre_completo: 'Jefa de Prueba' },
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

/**
 * Abre el popup de alta y devuelve el diálogo junto con su `<select>` de rol.
 *
 * Se busca DENTRO del diálogo a propósito: la barra de filtros tiene otro
 * control llamado "Rol" y, por fuera, se encuentra antes ese.
 */
async function abrirAlta() {
  fireEvent.click(await screen.findByRole('button', { name: /nuevo/i }, ESPERA))
  const popup = await screen.findByRole('dialog', {}, ESPERA)
  return { popup, rol: within(popup).getByLabelText(/^rol/i) }
}

beforeEach(() => {
  localStorage.clear()
})

describe('Usuarios — formulario y filtros', () => {
  it('los campos de asignación solo salen con el rol Docente', async () => {
    montar()
    const { popup, rol } = await abrirAlta()
    const en = () => within(popup)

    fireEvent.change(rol, { target: { value: String(ROLES.DOCENTE) } })
    expect(en().getByLabelText(/año escolar/i)).toBeInTheDocument()
    expect(en().getByLabelText(/colegio asignado/i)).toBeInTheDocument()
    expect(en().getByText(/^grados$/i)).toBeInTheDocument()

    fireEvent.change(rol, { target: { value: String(ROLES.SUPERVISOR) } })
    expect(en().queryByLabelText(/año escolar/i)).not.toBeInTheDocument()
    expect(en().queryByLabelText(/colegio asignado/i)).not.toBeInTheDocument()
    expect(en().queryByText(/^grados$/i)).not.toBeInTheDocument()

    fireEvent.change(rol, { target: { value: String(ROLES.DIRECTIVO) } })
    expect(en().queryByLabelText(/colegio asignado/i)).not.toBeInTheDocument()
  })

  it('tiene búsqueda por nombre y botón de filtro, en una sola fila', async () => {
    const { container } = montar()
    await screen.findByPlaceholderText(/nombre o correo/i, {}, ESPERA)

    expect(screen.getByRole('button', { name: /filtrar/i })).toBeInTheDocument()
    // Una fila: el formulario reparte los controles, no los apila.
    expect(container.querySelector('form.flex.flex-wrap')).toBeTruthy()
  })

  it('la búsqueda deja en la tabla solo a quien coincide', async () => {
    montar()
    const buscar = await screen.findByPlaceholderText(/nombre o correo/i, {}, ESPERA)
    // Al recargar, la tabla se desmonta y vuelve: hay que buscarla cada vez,
    // no guardar el nodo o se comprueba uno ya desconectado del documento.
    const filasAhora = () => [...screen.getByRole('table').querySelectorAll('tbody tr')]
    const antes = await waitFor(() => {
      const filas = filasAhora()
      expect(filas.length).toBeGreaterThan(1)
      return filas.length
    }, ESPERA)

    const alguien = filasAhora()[0].querySelector('td').textContent.trim()
    fireEvent.change(buscar, { target: { value: alguien } })
    fireEvent.click(screen.getByRole('button', { name: /filtrar/i }))

    await waitFor(() => {
      const filas = filasAhora()
      expect(filas.length).toBeLessThan(antes)
      expect(filas.every((f) => f.textContent.includes(alguien))).toBe(true)
    }, ESPERA)
  })

  it('"Limpiar" devuelve la lista entera, no solo el estado', async () => {
    montar()
    const buscar = await screen.findByPlaceholderText(/nombre o correo/i, {}, ESPERA)
    const filasAhora = () => [...screen.getByRole('table').querySelectorAll('tbody tr')]
    const antes = await waitFor(() => {
      const filas = filasAhora()
      expect(filas.length).toBeGreaterThan(1)
      return filas.length
    }, ESPERA)

    fireEvent.change(buscar, { target: { value: filasAhora()[0].querySelector('td').textContent.trim() } })
    fireEvent.click(screen.getByRole('button', { name: /filtrar/i }))
    await waitFor(() => expect(filasAhora().length).toBeLessThan(antes), ESPERA)

    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }))
    await waitFor(() => expect(filasAhora().length).toBe(antes), ESPERA)
    expect(screen.getByPlaceholderText(/nombre o correo/i).value).toBe('')
  })

  it('ya no hay una pestaña "Alumnos" dentro de Usuarios', async () => {
    montar()
    await screen.findByRole('table', {}, ESPERA)
    expect(screen.queryByRole('tab', { name: /alumnos/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /cuentas/i })).not.toBeInTheDocument()
  })
})
