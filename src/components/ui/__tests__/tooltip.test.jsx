// El Tooltip se abre por toque (clic) en su botón, no solo por hover: CU015
// pide los íconos de información consultables "mediante clic o toque".
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Tooltip from '../Tooltip'

const BOTON = { name: 'Qué incluye' }
const TEXTO = 'Solo cuentan las clases registradas como dictadas.'

const montar = (onClick) =>
  render(
    <Tooltip content={TEXTO}>
      <button type="button" aria-label="Qué incluye" onClick={onClick}>
        i
      </button>
    </Tooltip>,
  )

describe('Tooltip', () => {
  it('un clic en el botón lo abre y otro lo cierra, sin perder el clic del botón', () => {
    const onClick = vi.fn()
    montar(onClick)
    const boton = screen.getByRole('button', BOTON)

    fireEvent.click(boton)
    expect(screen.getByRole('tooltip')).toHaveTextContent(TEXTO)
    expect(onClick).toHaveBeenCalledTimes(1)

    fireEvent.click(boton)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('Escape lo cierra', () => {
    montar()
    const boton = screen.getByRole('button', BOTON)
    fireEvent.click(boton)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.keyDown(boton, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('también se abre por foco y por hover', () => {
    montar()
    const boton = screen.getByRole('button', BOTON)
    fireEvent.focus(boton)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.blur(boton)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.mouseEnter(boton.parentElement.parentElement)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
