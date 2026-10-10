// Libros de subir de nivel de una fila del reporte semanal (RF-015, RN-006):
// título, aciertos y total en campos separados, con su validación.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DrawerLibros from '../DrawerLibros'

const FILA = { nombre: 'Quispe Rojas, Lucía', libros: [{ id_libro: 7, titulo: 'El zorro', aciertos: 4, total: 5 }] }

function montar(props = {}) {
  const onGuardar = vi.fn()
  const onCerrar = vi.fn()
  render(<DrawerLibros abierto fila={FILA} onGuardar={onGuardar} onCerrar={onCerrar} {...props} />)
  return { onGuardar, onCerrar, panel: screen.getByRole('dialog', { name: 'Libros de subir de nivel' }) }
}

/** Los tres campos del libro n (0-based), por su etiqueta. */
const campos = (panel, n) => ({
  titulo: within(panel).getAllByLabelText('Título del libro')[n],
  aciertos: within(panel).getAllByLabelText('Aciertos')[n],
  total: within(panel).getAllByLabelText('Total')[n],
})

async function agregarLibro(panel, { titulo = '', aciertos = '', total = '' } = {}) {
  await userEvent.click(within(panel).getByRole('button', { name: 'Agregar libro' }))
  const n = within(panel).getAllByLabelText('Título del libro').length - 1
  const { titulo: t, aciertos: a, total: tot } = campos(panel, n)
  if (titulo) await userEvent.type(t, titulo)
  if (aciertos !== '') await userEvent.type(a, String(aciertos))
  if (total !== '') await userEvent.type(tot, String(total))
}

describe('DrawerLibros', () => {
  it('sin libros muestra que cero es un valor válido (RN-006)', () => {
    montar({ fila: { nombre: 'X', libros: [] } })
    expect(screen.getByText('Sin libros esta semana')).toBeInTheDocument()
  })

  it('precarga los libros de la fila con sus campos separados (RF-015)', () => {
    const { panel } = montar()
    const { titulo, aciertos, total } = campos(panel, 0)
    expect(titulo).toHaveValue('El zorro')
    expect(aciertos).toHaveValue(4)
    expect(total).toHaveValue(5)
  })

  it.each([
    [{ total: 5, aciertos: 3 }, 'Falta el título'],
    [{ titulo: 'La luna', aciertos: 3 }, 'Indique de cuántas preguntas'],
    [{ titulo: 'La luna', total: 0, aciertos: 0 }, 'Indique de cuántas preguntas'],
    [{ titulo: 'La luna', total: 5 }, 'Indique los aciertos'],
    [{ titulo: 'La luna', total: 3, aciertos: 4 }, 'Los aciertos no pueden superar el total'],
  ])('un libro %o no se guarda: "%s"', async (libro, error) => {
    const { panel, onGuardar } = montar()
    await agregarLibro(panel, libro)
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar libros' }))

    expect(within(panel).getByText(error)).toBeInTheDocument()
    expect(onGuardar).not.toHaveBeenCalled()
    expect(within(panel).getByRole('button', { name: 'Guardar libros' })).toBeDisabled()
  })

  it('un número de aciertos negativo también se rechaza', async () => {
    const { panel, onGuardar } = montar()
    await agregarLibro(panel, { titulo: 'La luna', total: 5 })
    const { aciertos } = campos(panel, 1)
    await userEvent.type(aciertos, '-1')
    expect(aciertos).toHaveValue(-1)
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar libros' }))
    expect(within(panel).getByText('Indique los aciertos')).toBeInTheDocument()
    expect(onGuardar).not.toHaveBeenCalled()
  })

  it('guarda los libros con números y títulos sin espacios sobrantes, y cierra', async () => {
    const { panel, onGuardar, onCerrar } = montar()
    await agregarLibro(panel, { titulo: '  La luna  ', aciertos: 2, total: 4 })
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar libros' }))

    expect(onGuardar).toHaveBeenCalledWith([
      { id_libro: 7, titulo: 'El zorro', aciertos: 4, total: 5 },
      { id_libro: undefined, titulo: 'La luna', aciertos: 2, total: 4 },
    ])
    expect(onCerrar).toHaveBeenCalled()
  })

  it('quitar un libro lo saca de lo que se guarda', async () => {
    const { panel, onGuardar } = montar()
    await userEvent.click(within(panel).getByRole('button', { name: 'Quitar El zorro' }))
    expect(screen.getByText('Sin libros esta semana')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Guardar libros' }))
    expect(onGuardar).toHaveBeenCalledWith([])
  })

  it('un libro nuevo sin título se ofrece quitar como "libro"', async () => {
    const { panel } = montar()
    await agregarLibro(panel)
    expect(within(panel).getByRole('button', { name: 'Quitar libro' })).toBeInTheDocument()
  })

  it('en solo lectura no deja editar, agregar, quitar ni guardar', () => {
    const { panel } = montar({ soloLectura: true })
    expect(campos(panel, 0).titulo).toBeDisabled()
    expect(within(panel).queryByRole('button', { name: 'Guardar libros' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Agregar libro' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument()
  })

  it('cancelar cierra sin guardar', async () => {
    const { panel, onGuardar, onCerrar } = montar()
    await userEvent.click(within(panel).getByRole('button', { name: 'Cancelar' }))
    expect(onCerrar).toHaveBeenCalled()
    expect(onGuardar).not.toHaveBeenCalled()
  })
})
