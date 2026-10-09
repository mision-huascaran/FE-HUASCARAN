// Regresión: el Inicio del Docente se quedaba EN BLANCO contra el backend real.
//
// La causa: el componente leía `data.colegios.join(...)`, pero `/inicio/docente`
// pasó a devolver `asignaciones` y `totales`. Con el simulador funcionaba y
// contra el servidor reventaba, que es el peor orden posible para enterarse.
//
// Por eso aquí se monta con la forma EXACTA del backend, y además con una
// respuesta incompleta: un campo que falte no puede tumbar la pantalla entera.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import ResumenesAccion from '../ResumenesAccion'
import useSessionStore from '../../../store/sessionStore'
import useSyncStore from '../../../store/syncStore'
import { ROLES } from '../../../auth/roles'

const respuesta = vi.fn()
vi.mock('../../../api/resources/inicio', () => ({
  obtenerInicioDocente: () => respuesta(),
  obtenerInicioSupervisor: vi.fn(),
  obtenerInicioDirectivo: vi.fn(),
  obtenerResumenDocente: vi.fn(),
  obtenerResumenSupervisor: vi.fn(),
}))

const ESPERA = { timeout: 8000 }

function montar() {
  useSessionStore.setState({
    token: 'mock.1.2026',
    usuario: { id_usuario: 1, id_rol: ROLES.DOCENTE, id_docente: 1, nombres: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ResumenesAccion />
    </QueryClientProvider>,
  )
}

describe('Resúmenes de Acción del Docente (CU010)', () => {
  it('pinta la forma que devuelve GET /inicio/docente', async () => {
    respuesta.mockResolvedValue({
      actividad_activa: null,
      puede_iniciar_actividad: true,
      asignaciones: [
        {
          colegio: { id: 1, nombre: 'I.E. 86021 Ranrahirca' },
          grados: [{ id: 1, nombre: '1.º', cantidad_alumnos: 20, ciclos: ['III'], subprogramas: ['Alfabetización'] }],
        },
      ],
      totales: { ciclos: ['III'], subprogramas: ['Alfabetización'], cantidad_alumnos: 20 },
    })

    montar()
    expect(await screen.findByText('I.E. 86021 Ranrahirca', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Alfabetización')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('una respuesta incompleta no deja la pantalla en blanco', async () => {
    // Esto es exactamente lo que pasó: un contrato que cambia y un campo que
    // desaparece. Debe degradar a guiones, nunca tumbar el árbol de React.
    respuesta.mockResolvedValue({ actividad_activa: null })

    montar()
    expect(await screen.findByText('Mis asignaciones', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText(/No tiene asignaciones académicas vigentes/)).toBeInTheDocument()
  })

  it('sin Resúmenes de Acción del servidor no inventa un "0 de 0"', async () => {
    // El backend todavía no los manda (§12). Decir "Has evaluado a 0 de 0"
    // sería afirmar algo falso sobre el trabajo del docente.
    respuesta.mockResolvedValue({ asignaciones: [], totales: {} })

    montar()
    await screen.findByText('Mis asignaciones', {}, ESPERA)
    expect(screen.queryByText(/Has evaluado/)).not.toBeInTheDocument()
  })

  it('pinta los Resúmenes de Acción cuando el backend los manda', async () => {
    respuesta.mockResolvedValue({
      asignaciones: [],
      totales: {},
      evaluados: 15,
      alumnos: 30,
    })

    montar()
    expect(await screen.findByText('Has evaluado a 15 de 30 alumnos.', {}, ESPERA)).toBeInTheDocument()
  })

  it('avisa de los cambios sin sincronizar, que sale de la cola local', async () => {
    // Importa especialmente sin red: es la única señal de que el trabajo del
    // aula no se ha perdido.
    useSyncStore.setState({ pendientes: 3 })
    respuesta.mockResolvedValue({ asignaciones: [], totales: {} })

    montar()
    expect(
      await screen.findByText('Tienes 3 registros offline pendientes de sincronizar.', {}, ESPERA),
    ).toBeInTheDocument()
    useSyncStore.setState({ pendientes: 0 })
  })

  it('con un solo pendiente lo dice en singular', async () => {
    useSyncStore.setState({ pendientes: 1 })
    respuesta.mockResolvedValue({ asignaciones: [], totales: {} })

    montar()
    expect(
      await screen.findByText('Tienes 1 registro offline pendiente de sincronizar.', {}, ESPERA),
    ).toBeInTheDocument()
    useSyncStore.setState({ pendientes: 0 })
  })

  it('agrupa los grados de varios colegios sin repetirlos', async () => {
    respuesta.mockResolvedValue({
      asignaciones: [
        { colegio: { id: 1, nombre: 'Colegio A' }, grados: [{ nombre: '1.º' }, { nombre: '2.º' }] },
        { colegio: { id: 2, nombre: 'Colegio B' }, grados: [{ nombre: '1.º' }] },
      ],
      totales: { subprogramas: ['Alfabetización'], cantidad_alumnos: 40 },
    })

    montar()
    expect(await screen.findByText('Colegio A, Colegio B', {}, ESPERA)).toBeInTheDocument()
    // "1.º" sale en los dos colegios y debe aparecer una sola vez.
    expect(screen.getByText('1.º, 2.º')).toBeInTheDocument()
  })
})
