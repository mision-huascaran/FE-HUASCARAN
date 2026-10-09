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

describe('Filtros de Asistencia (T30)', () => {
  it('arranca con colegio y grado elegidos de verdad, no solo pintados', async () => {
    montar()
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)
    await waitFor(() => expect(colegio.value).not.toBe(''), ESPERA)
    expect((await screen.findByLabelText('Grado', {}, ESPERA)).value).not.toBe('')

    // Con los tres datos puestos, la grilla deja de pedirlos.
    await waitFor(
      () => expect(screen.queryByText('Elija colegio, grado y fecha')).not.toBeInTheDocument(),
      ESPERA,
    )
  })

  it('ya no ofrece filtro de Sección: dejó de ser una entidad', async () => {
    // El backend lo decidió así: la sección es un atributo del colegio
    // (`colegio.seccion`, "Única" por defecto) y el alumno la hereda. Antes
    // este filtro pedía `/secciones`, que ya no existe.
    montar()
    await abrirFiltros()

    await screen.findByLabelText('Colegio', {}, ESPERA)
    expect(screen.queryByLabelText('Sección')).not.toBeInTheDocument()
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
