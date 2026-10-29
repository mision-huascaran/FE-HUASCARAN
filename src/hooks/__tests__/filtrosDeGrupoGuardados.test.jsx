// D105 — CP-INI-07. Rúbrica no conservaba el Subprograma al volver al módulo:
// los filtros viven en la URL y el menú la abre vacía, así que se volvía a
// proponer el primero (Alfabetización).
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { clienteDePrueba } from '../../test/renderConProveedores'
import useFiltrosDeGrupo from '../useFiltrosDeGrupo'

const CLAVE = 'sicedu.filtros.grupo:/rubrica'

function montar(ruta) {
  const cliente = clienteDePrueba()
  const envoltorio = ({ children }) => (
    <QueryClientProvider client={cliente}>
      <MemoryRouter initialEntries={[ruta]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return renderHook(() => useFiltrosDeGrupo({ esDocente: false, idAnioEscolar: 2, conSemana: false }), {
    wrapper: envoltorio,
  })
}

beforeEach(() => localStorage.clear())

describe('Filtros de grupo al volver al módulo (D105)', () => {
  it('entrar sin parámetros recupera la última búsqueda del módulo', () => {
    localStorage.setItem(CLAVE, 'colegio=1&grado=2&seccion=3&subprograma=2&mes=10')
    const { result } = montar('/rubrica')
    expect(result.current.filtros).toMatchObject({ idColegio: '1', idPrograma: '2', mes: '10' })
  })

  it('lo que se elige queda guardado para la próxima vez', () => {
    const { result } = montar('/rubrica')
    act(() => result.current.cambiar('subprograma', '2'))
    expect(new URLSearchParams(localStorage.getItem(CLAVE)).get('subprograma')).toBe('2')
  })

  it('una URL con parámetros manda sobre lo guardado', () => {
    localStorage.setItem(CLAVE, 'colegio=1&subprograma=2')
    const { result } = montar('/rubrica?colegio=4&subprograma=1')
    expect(result.current.filtros).toMatchObject({ idColegio: '4', idPrograma: '1' })
  })
})
