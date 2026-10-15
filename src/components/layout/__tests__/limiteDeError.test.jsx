// Un fallo al pintar no puede dejar la aplicación entera en blanco.
//
// Con los contratos del backend todavía moviéndose, ya pasó dos veces: un
// `.join` sobre un campo renombrado y un objeto puesto donde React espera
// texto. En los dos casos React desmontó el árbol y no quedó ni el menú.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LimiteDeError from '../LimiteDeError'

function Revienta() {
  throw new Error('campo inesperado')
}

describe('Límite de error', () => {
  it('muestra un aviso en vez de una pantalla vacía', () => {
    // React escribe el error en consola aunque se capture: se silencia para
    // que el resultado del test se lea.
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <LimiteDeError claveReinicio="/alumnos">
        <Revienta />
      </LimiteDeError>,
    )

    expect(screen.getByText('No se pudo mostrar esta pantalla')).toBeInTheDocument()
    // Y dice cómo seguir trabajando, que es lo que importa en el aula.
    expect(screen.getByText(/puede seguir usando el resto de la aplicación/i)).toBeInTheDocument()
    consola.mockRestore()
  })

  it('deja pasar el contenido cuando no hay error', () => {
    render(
      <LimiteDeError claveReinicio="/alumnos">
        <p>Contenido normal</p>
      </LimiteDeError>,
    )
    expect(screen.getByText('Contenido normal')).toBeInTheDocument()
  })
})
