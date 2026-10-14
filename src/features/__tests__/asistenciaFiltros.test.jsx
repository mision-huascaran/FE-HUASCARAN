// Regresión: al entrar en Asistencia la pantalla PINTABA un colegio y un grado,
// pero el cuerpo seguía diciendo "Elija colegio, grado y fecha" y el desplegable
// de Sección salía vacío.
//
// La causa no era la carga de datos: un `<select>` sin marcador de posición
// muestra su primera opción aunque el estado valga cadena vacía. Así que la
// pantalla decía "I.E. 86021 Ranrahirca" mientras el filtro no tenía colegio, y
// sin colegio la consulta de secciones ni se lanzaba.
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import AsistenciaPage from '../asistencia/AsistenciaPage'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'

const ESPERA = { timeout: 8000 }

// En jsdom no hay ancho de pantalla: `FilterBar` colapsa los filtros (RNF-002).
async function abrirFiltros() {
  fireEvent.click(await screen.findByRole('button', { name: /^filtros$/i }, ESPERA))
}

function montar(idRol = ROLES.SUPERVISOR) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: null, nombres: 'Prueba' },
    cargando: false,
  })

  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AsistenciaPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => localStorage.clear())

describe('Filtros de Asistencia (CU022)', () => {
  it('arranca con colegio y grado elegidos de verdad, no solo pintados', async () => {
    montar()
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)
    await waitFor(() => expect(colegio.value).not.toBe(''), ESPERA)
    expect((await screen.findByLabelText('Grado', {}, ESPERA)).value).not.toBe('')

    // CU022 añade Sección y Subprograma, así que con colegio y grado todavía
    // faltan datos: lo que se comprueba aquí es que estén ELEGIDOS de verdad.
    expect((await screen.findByLabelText('Subprograma', {}, ESPERA)).value).not.toBe('')
  })

  it('la Sección vuelve a ser filtro, y es el aula del colegio y grado', async () => {
    // Se había quitado cuando el backend dejó de tratarla como entidad propia
    // (ya no existe `/secciones`). CU022 la pide otra vez como filtro
    // obligatorio, pero ahora se deduce de las aulas que ese colegio y ese
    // grado tienen de verdad, sin tabla aparte.
    montar()
    await abrirFiltros()

    await screen.findByLabelText('Colegio', {}, ESPERA)
    const seccion = await screen.findByLabelText('Sección', {}, ESPERA)
    await waitFor(() => expect(seccion.querySelectorAll('option').length).toBeGreaterThan(0), ESPERA)
  })

  it('unos filtros guardados por una versión anterior no dejan campos sin definir', async () => {
    // Forma vieja: sin `idDocente` ni `idSeccion`.
    localStorage.setItem('sicedu.filtros.asistencia', JSON.stringify({ idColegio: '', idGrado: '', fecha: '2026-10-07' }))

    montar()
    await abrirFiltros()

    const docente = await screen.findByLabelText('Docente', {}, ESPERA)
    // Si quedara `undefined`, React trataría el select como no controlado.
    expect(docente.value).toBe('')
    expect((await screen.findByLabelText('Fecha', {}, ESPERA)).value).toBe('2026-10-07')
  })
})
