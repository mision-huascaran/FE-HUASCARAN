// Regresión: al entrar en Asistencia la pantalla PINTABA un colegio y un grado,
// pero el cuerpo seguía diciendo "Elija colegio, grado y fecha".
//
// La causa no era la carga de datos: un `<select>` sin marcador de posición
// muestra su primera opción aunque el estado valga cadena vacía. Así que la
// pantalla decía "I.E. 86021 Ranrahirca" mientras el filtro no tenía colegio.
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import { ToastProvider } from '../../components/ui'
import AsistenciaPage from '../asistencia/AsistenciaPage'
import useSessionStore from '../../store/sessionStore'
import * as db from '../../api/mock/db'
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

    // El grado y el subprograma los dice el COLEGIO, así que llegan después:
    // hay que esperarlos, no leerlos en el mismo tirón.
    const grado = await screen.findByLabelText('Grado', {}, ESPERA)
    await waitFor(() => expect(grado.value).not.toBe(''), ESPERA)

    /**
     * El Subprograma, en cambio, arranca VACÍO a propósito: es "Todos".
     *
     * Dejó de formar parte de la identidad de la clase (CU022 v2): una clase
     * reúne a los alumnos de Alfabetización y de Comprensión Lectora que estén
     * en esa aula, y el filtro solo recorta a quién se ve. Proponer uno
     * escondería a media clase sin que nadie lo hubiera pedido.
     */
    const subprograma = await screen.findByLabelText('Subprograma', {}, ESPERA)
    expect(subprograma.value).toBe('')
  })

  it('con una sola sección se elige sola, y la clase carga', async () => {
    /**
     * La sección ha pasado por tres formas en tres semanas: atributo del
     * colegio, retirada del todo, y con T3 entidad POR GRADO. Ahora
     * `GET /asistencias` la recibe como `id_seccion`, porque la clase es
     * colegio × grado × sección.
     *
     * Con una sola —lo que tienen hoy todos los colegios— se elige sola y no
     * hay nada que decidir. Lo que no puede pasar es que vuelva a bloquear la
     * pantalla, que es lo que hacía cuando el desplegable nacía vacío.
     */
    montar()
    await abrirFiltros()

    const seccion = await screen.findByLabelText('Sección', {}, ESPERA)
    await waitFor(() => expect(seccion.value).not.toBe(''), ESPERA)

    await waitFor(() => expect(screen.queryByText(/complete los filtros/i)).toBeNull(), ESPERA)
  })

  it('al Docente solo le ofrece sus aulas, y el subprograma del grado elegido', async () => {
    /**
     * El bug: el Docente tenía 3.º de Alfabetización y 4.º de Comprensión
     * Lectora, pero el desplegable de Subprograma ofrecía los dos en los dos
     * grados. Elegir 3.º + Comprensión Lectora no es ninguna de sus aulas, así
     * que el servidor respondía 403 `aula_fuera_de_alcance` y la pantalla se
     * quedaba sin alumnos "estando asignados".
     *
     * Ahora el colegio dice qué subprogramas tiene (con id) y la asignación
     * cuáles de ellos tienen alumnos EN ESE GRADO. Solo pasan los que cumplen
     * las dos cosas.
     */
    montar(ROLES.DOCENTE)
    await abrirFiltros()

    const colegio = await screen.findByLabelText('Colegio', {}, ESPERA)
    await waitFor(() => expect(colegio.value).not.toBe(''), ESPERA)

    const grado = await screen.findByLabelText('Grado', {}, ESPERA)
    await waitFor(() => expect(grado.value).not.toBe(''), ESPERA)

    // Lo que esa aula tiene DE VERDAD, según los alumnos del simulador.
    const conAlumnos = new Set(
      db
        .alumnosDe({ colegio: Number(colegio.value), grado: Number(grado.value) })
        .map((a) => db.PROGRAMAS.find((p) => p.id_programa === a.id_programa)?.nombre)
        .filter(Boolean),
    )
    expect(conAlumnos.size).toBeGreaterThan(0)

    const subprograma = await screen.findByLabelText('Subprograma', {}, ESPERA)
    await waitFor(() => {
      const ofrecidos = [...subprograma.querySelectorAll('option')].filter((o) => o.value)
      expect(ofrecidos.length).toBe(conAlumnos.size)
      expect(ofrecidos.every((o) => conAlumnos.has(o.textContent))).toBe(true)
    }, ESPERA)
  })

  it('unos filtros guardados por una versión anterior no dejan campos sin definir', async () => {
    // Forma vieja: sin `idDocente` ni `idPrograma`.
    localStorage.setItem('sicedu.filtros.asistencia', JSON.stringify({ idColegio: '', idGrado: '', fecha: '2026-10-07' }))

    montar()
    await abrirFiltros()

    const docente = await screen.findByLabelText('Docente', {}, ESPERA)
    // Si quedara `undefined`, React trataría el select como no controlado.
    expect(docente.value).toBe('')
    expect((await screen.findByLabelText('Fecha', {}, ESPERA)).value).toBe('2026-10-07')
  })
})
