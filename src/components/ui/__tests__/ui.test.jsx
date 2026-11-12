import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from '../Button'
import DataTable from '../DataTable'
import LevelChip from '../LevelChip'
import RoleGate from '../RoleGate'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

describe('Button', () => {
  it('no dispara onClick mientras está en estado de carga', async () => {
    const alHacerClic = vi.fn()
    render(
      <Button loading onClick={alHacerClic}>
        Guardar
      </Button>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(alHacerClic).not.toHaveBeenCalled()
  })
})

describe('LevelChip', () => {
  it('pinta el nivel con el token de color correspondiente', () => {
    render(<LevelChip nivel="Logrado" />)
    expect(screen.getByText('Logrado').className).toContain('text-lvl-logrado')
  })

  it('colorea la letra Raz-Kids por `orden` y no por la letra (RN-012)', () => {
    render(
      <>
        <LevelChip letra="aa" orden={1} totalNiveles={27} />
        <LevelChip letra="Z" orden={27} totalNiveles={27} />
      </>,
    )
    // "aa" ordena después de "Z" como texto, pero su `orden` es menor.
    expect(screen.getByText('aa').className).toContain('text-lvl-preinicio')
    expect(screen.getByText('Z').className).toContain('text-lvl-destacado')
  })
})

describe('DataTable', () => {
  const columnas = [
    { key: 'nombre', header: 'Estudiante', sortable: true },
    { key: 'libros', header: 'Libros', align: 'right', sortable: true },
  ]
  const filas = [
    { id: 1, nombre: 'Rosa', libros: 4 },
    { id: 2, nombre: 'Julio', libros: 2 },
  ]

  it('informa el rango mostrado', () => {
    render(<DataTable columns={columnas} rows={filas} />)
    expect(screen.getByText(/Mostrando/)).toBeInTheDocument()
  })

  it('muestra el estado vacío cuando no hay filas', () => {
    render(<DataTable columns={columnas} rows={[]} />)
    expect(screen.getByText('Sin registros')).toBeInTheDocument()
  })
})

describe('RoleGate', () => {
  it('oculta los hijos si el rol activo no está permitido', () => {
    useSessionStore.setState({ usuario: { id_rol: ROLES.DIRECTIVOS } })
    render(
      <RoleGate allow={[ROLES.PROFESOR]}>
        <span>Registrar</span>
      </RoleGate>,
    )
    expect(screen.queryByText('Registrar')).not.toBeInTheDocument()
  })

  it('muestra los hijos si el rol activo está permitido', () => {
    useSessionStore.setState({ usuario: { id_rol: ROLES.PROFESOR } })
    render(
      <RoleGate allow={[ROLES.PROFESOR, ROLES.JEFA]}>
        <span>Registrar</span>
      </RoleGate>,
    )
    expect(screen.getByText('Registrar')).toBeInTheDocument()
  })
})

/** D008 del reporte de UX (11/11): tablas ordenables. */
describe('DataTable — orden (D008)', () => {
  const columnas = [
    { key: 'nombre', header: 'Estudiante', sortable: true },
    { key: 'libros', header: 'Libros', align: 'right', sortable: true },
  ]
  const filas = [
    { id: 1, nombre: 'Rosa', libros: 4 },
    { id: 2, nombre: 'Julio', libros: 2 },
    { id: 3, nombre: 'Ana', libros: 9 },
  ]
  const nombres = () => screen.getAllByRole('row').slice(1).map((f) => f.cells[0].textContent)
  const cabecera = (nombre) => screen.getByRole('button', { name: nombre })

  afterEach(() => window.sessionStorage.clear())

  it('ascendente, descendente y, al tercer clic, el orden del servidor', () => {
    render(<DataTable columns={columnas} rows={filas} />)
    fireEvent.click(cabecera('Estudiante'))
    expect(nombres()).toEqual(['Ana', 'Julio', 'Rosa'])
    fireEvent.click(cabecera('Estudiante'))
    expect(nombres()).toEqual(['Rosa', 'Julio', 'Ana'])
    fireEvent.click(cabecera('Estudiante'))
    expect(nombres()).toEqual(['Rosa', 'Julio', 'Ana'])
    expect(screen.getByRole('columnheader', { name: /Estudiante/ })).not.toHaveAttribute('aria-sort')
  })

  it('una sola columna manda: elegir otra quita el orden de la anterior', () => {
    render(<DataTable columns={columnas} rows={filas} />)
    fireEvent.click(cabecera('Estudiante'))
    fireEvent.click(cabecera('Libros'))
    expect(screen.getByRole('columnheader', { name: /Estudiante/ })).not.toHaveAttribute('aria-sort')
    expect(screen.getByRole('columnheader', { name: /Libros/ })).toHaveAttribute('aria-sort', 'ascending')
    expect(nombres()).toEqual(['Julio', 'Rosa', 'Ana'])
  })

  it('la cabecera ordenable va en mayúsculas como las demás (N003)', () => {
    // El reset de Tailwind quita `uppercase` a los botones; el botón lo repite.
    render(<DataTable columns={columnas} rows={filas} />)
    expect(cabecera('Estudiante').className).toMatch(/\buppercase\b/)
  })

  it('la cabecera dice qué hace el próximo clic', () => {
    render(<DataTable columns={columnas} rows={filas} />)
    expect(cabecera('Estudiante')).toHaveAttribute('title', 'Ordenar por estudiante')
    fireEvent.click(cabecera('Estudiante'))
    expect(cabecera('Estudiante')).toHaveAttribute('title', expect.stringMatching(/ascendente/))
  })

  it('con persistirOrden, el orden sobrevive a salir y volver a la pantalla', () => {
    const { unmount } = render(<DataTable columns={columnas} rows={filas} persistirOrden="prueba" />)
    fireEvent.click(cabecera('Libros'))
    fireEvent.click(cabecera('Libros'))
    unmount()

    render(<DataTable columns={columnas} rows={filas} persistirOrden="prueba" />)
    expect(screen.getByRole('columnheader', { name: /Libros/ })).toHaveAttribute('aria-sort', 'descending')
    expect(nombres()).toEqual(['Ana', 'Rosa', 'Julio'])
  })

  it('sin persistirOrden, cada tabla empieza en el orden del servidor', () => {
    const { unmount } = render(<DataTable columns={columnas} rows={filas} />)
    fireEvent.click(cabecera('Libros'))
    unmount()
    render(<DataTable columns={columnas} rows={filas} />)
    expect(nombres()).toEqual(['Rosa', 'Julio', 'Ana'])
  })
})
