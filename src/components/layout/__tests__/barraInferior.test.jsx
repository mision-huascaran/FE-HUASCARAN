// La barra inferior del móvil.
//
// Lo que hay que sujetar no es el aspecto, es la REGLA: caben cuatro secciones
// y el resto se llega por "Más". Si alguien añade una sección al menú y nadie
// mira esto, la quinta empuja a las demás y las etiquetas se parten.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BarraInferior from '../BarraInferior'
import { navegacionDe } from '../navegacion'
import { ROLES } from '../../../auth/roles'

// La barra solo necesita el rol, así que se evita montar todo el AuthProvider.
vi.mock('../../../auth/AuthProvider', () => ({
  useAuth: () => ({ usuario: { id_usuario: 1, id_rol: rolActual } }),
}))

let rolActual = ROLES.DOCENTE

const MAS = 'Más secciones'

function montar(idRol) {
  rolActual = idRol
  return render(
    <MemoryRouter initialEntries={['/inicio']}>
      <BarraInferior onMas={alPulsarMas} />
    </MemoryRouter>,
  )
}

const alPulsarMas = vi.fn()

describe('BarraInferior', () => {
  it('el Docente ve cuatro secciones y "Más": tiene siete y no caben', () => {
    montar(ROLES.DOCENTE)

    const enlaces = screen.getAllByRole('link')
    expect(enlaces).toHaveLength(4)
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      '/inicio',
      '/alumnos',
      '/asistencia',
      // Lectura antes que Rúbrica: es el orden del menú, que es el orden en
      // que se trabaja.
      '/seguimiento-lectura',
    ])
    expect(screen.getByRole('button', { name: MAS })).toBeInTheDocument()
  })

  it('"Más" abre el menú completo, no navega a ningún sitio', async () => {
    montar(ROLES.DOCENTE)

    await userEvent.click(screen.getByRole('button', { name: MAS }))
    expect(alPulsarMas).toHaveBeenCalled()
  })

  it('el Directivo tiene dos secciones: las dos salen y no hay "Más"', () => {
    montar(ROLES.DIRECTIVO)

    expect(screen.getAllByRole('link')).toHaveLength(navegacionDe(ROLES.DIRECTIVO).length)
    expect(screen.queryByRole('button', { name: MAS })).not.toBeInTheDocument()
  })

  it('cada icono dice a dónde lleva aunque la etiqueta vaya recortada', () => {
    // "Lectura" se lee de un vistazo; un lector de pantalla necesita el nombre
    // completo de la sección.
    montar(ROLES.DOCENTE)

    expect(screen.getByRole('link', { name: 'Seguimiento de Lectura' })).toBeInTheDocument()
    expect(screen.getByText('Lectura')).toBeInTheDocument()
  })
})
