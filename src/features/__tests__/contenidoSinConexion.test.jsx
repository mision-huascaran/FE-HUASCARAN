// Sin conexión y sin copia, los modales dicen "Contenido no disponible sin
// conexión" en vez de un vacío que parece una respuesta (bug 6).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../App'
import ModalCambiarClase from '../lectura/ModalCambiarClase'
import PanelCriterios from '../rubrica/PanelCriterios'

const listarClases = vi.fn(async () => [])
vi.mock('../../api/resources/clases', async (importOriginal) => ({
  ...(await importOriginal()),
  listarClases: (...a) => listarClases(...a),
}))
const obtenerCriterios = vi.fn(async () => [])
vi.mock('../../api/resources/rubricaMensual', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerCriterios: (...a) => obtenerCriterios(...a),
}))

const NO_DISPONIBLE = 'Contenido no disponible sin conexión'
const conCliente = (ui) => render(<QueryClientProvider client={crearQueryClient()}>{ui}</QueryClientProvider>)

afterEach(() => onlineManager.setOnline(true))

describe('Sin conexión y sin copia', () => {
  it('"Cambiar clase" no dice "No hay otra clase esta semana"', async () => {
    onlineManager.setOnline(false)
    conCliente(
      <ModalCambiarClase
        open
        semana={{ fecha_inicio: '2026-06-15', fecha_fin: '2026-06-19' }}
        filtros={{ idColegio: '1', idGrado: '2', idSeccion: '2', idPrograma: '2' }}
        claseActual={{ id_clase: 41, fecha: '2026-06-15' }}
        onConfirmar={() => {}}
        onCerrar={() => {}}
      />,
    )
    expect(await screen.findByText(NO_DISPONIBLE)).toBeInTheDocument()
    expect(screen.queryByText('No hay otra clase esta semana')).not.toBeInTheDocument()
    expect(listarClases).not.toHaveBeenCalled()
  })

  it('el panel de criterios no dice "Sin criterios para esta combinación"', async () => {
    onlineManager.setOnline(false)
    conCliente(<PanelCriterios open idPrograma={1} idCiclo={1} ciclo="III" nombrePrograma="Alfabetización" onCerrar={() => {}} />)
    expect(await screen.findByText(NO_DISPONIBLE)).toBeInTheDocument()
    expect(screen.queryByText('Sin criterios para esta combinación')).not.toBeInTheDocument()
  })
})
