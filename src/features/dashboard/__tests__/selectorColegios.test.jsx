// `SelectorColegios` — el desplegable de colegios del Dashboard (CU033,
// CU034, CU035).
//
// Lo que se sujeta aquí no es el aspecto: es que, CERRADO, es un control más
// de la fila de filtros (no un panel que desnivela todo lo demás), y que se
// comporta como cualquier desplegable — Escape y el clic fuera lo cierran,
// sin perder lo que ya estaba elegido.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelectorColegios from '../SelectorColegios'

const COLEGIOS = [
  { id_colegio: 1, nombre: 'I.E. 86021 Ranrahirca' },
  { id_colegio: 2, nombre: 'I.E. 86024 Mancos' },
  { id_colegio: 3, nombre: 'I.E. 86031 Shupluy' },
]

function montar(props = {}) {
  const onChange = vi.fn()
  const vista = render(
    <div>
      <button type="button">Fuera del selector</button>
      <SelectorColegios colegios={COLEGIOS} todos elegidos={[]} onChange={onChange} {...props} />
    </div>,
  )
  return { onChange, ...vista }
}

describe('SelectorColegios', () => {
  it('cerrado, no muestra el buscador ni las casillas: solo el resumen', () => {
    montar()

    expect(screen.getByRole('button', { name: /Colegios/ })).toHaveTextContent('Todos los colegios')
    expect(screen.queryByLabelText('Buscar colegio')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Todos los colegios' })).not.toBeInTheDocument()
  })

  it('un clic lo abre, y dentro aparecen el buscador y la lista', async () => {
    montar()

    await userEvent.click(screen.getByRole('button', { name: /Colegios/ }))

    expect(screen.getByLabelText('Buscar colegio')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Todos los colegios' })).toBeInTheDocument()
    COLEGIOS.forEach((c) => expect(screen.getByText(c.nombre)).toBeInTheDocument())
  })

  it('Escape lo cierra sin tocar la selección', async () => {
    const { onChange } = montar({ todos: false, elegidos: ['1'] })

    await userEvent.click(screen.getByRole('button', { name: /Colegios/ }))
    expect(screen.getByLabelText('Buscar colegio')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByLabelText('Buscar colegio')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('un clic fuera lo cierra', async () => {
    montar()

    await userEvent.click(screen.getByRole('button', { name: /Colegios/ }))
    expect(screen.getByLabelText('Buscar colegio')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Fuera del selector' }))

    expect(screen.queryByLabelText('Buscar colegio')).not.toBeInTheDocument()
  })

  it('el buscador filtra la lista, no la selección', async () => {
    montar({ todos: false, elegidos: ['1'] })

    await userEvent.click(screen.getByRole('button', { name: /Colegios/ }))
    await userEvent.type(screen.getByLabelText('Buscar colegio'), 'mancos')

    expect(screen.getByText('I.E. 86024 Mancos')).toBeInTheDocument()
    expect(screen.queryByText('I.E. 86021 Ranrahirca')).not.toBeInTheDocument()
    // El elegido sigue marcado aunque la búsqueda lo oculte de la lista.
    expect(screen.getByRole('button', { name: /Colegios/ })).toHaveTextContent('1 de 3')
  })

  it('marcar un colegio avisa con `todos: false` y la lista de elegidos', async () => {
    // Con "Todos" marcado las casillas se ven pero no deciden (están
    // deshabilitadas): hay que partir de una selección propia para poder
    // marcar una.
    const { onChange } = montar({ todos: false, elegidos: ['1'] })

    await userEvent.click(screen.getByRole('button', { name: /Colegios/ }))
    await userEvent.click(screen.getByText('I.E. 86024 Mancos'))

    expect(onChange).toHaveBeenCalledWith({ todos: false, elegidos: ['1', '2'] })
  })

  it('una selección vacía lo dice, y no equivale a "Todos"', () => {
    montar({ todos: false, elegidos: [] })

    expect(screen.getByText(/una selección vacía no equivale a/i)).toBeInTheDocument()
  })
})
