// Un nombre largo no desarma la pantalla: se corta y queda entero en el title.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import NombreLargo from '../NombreLargo'

describe('NombreLargo', () => {
  it('con 10 000 caracteres sin espacios: corta en 2 líneas, parte la palabra y guarda el nombre entero en el title', () => {
    const nombre = 'x'.repeat(10000)
    render(<NombreLargo className="max-w-[18rem]">{nombre}</NombreLargo>)
    const el = screen.getByTitle(nombre)
    expect(el).toHaveClass('line-clamp-2', '[overflow-wrap:anywhere]', 'max-w-[18rem]')
    expect(el.textContent).toBe(nombre)
  })

  it('el texto se muestra como texto, sin interpretar HTML', () => {
    const { container } = render(<NombreLargo>{'<img src=x onerror="alert(1)">'}</NombreLargo>)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument()
  })

  it('puede ser un título de una línea', () => {
    render(<NombreLargo as="h1" lineas={1}>Rosa Huamán</NombreLargo>)
    expect(screen.getByRole('heading', { name: 'Rosa Huamán' })).toHaveClass('line-clamp-1')
  })
})
