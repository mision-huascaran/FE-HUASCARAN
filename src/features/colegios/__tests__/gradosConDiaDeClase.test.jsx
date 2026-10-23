// CU013 — los grados del colegio, cada uno con su día de clase y sus secciones.
// El día solo aparece para un grado marcado y es obligatorio; los colegios
// antiguos llegan con `dia_clase: null` y no se les inventa un día.
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import GradosConDiaDeClase from '../GradosConDiaDeClase'

const CAMPO = {
  nombre: 'grados',
  etiqueta: 'Grados que ofrece',
  requerido: true,
  opciones: [
    { value: '1', label: '1.º' },
    { value: '2', label: '2.º' },
    { value: '3', label: '3.º' },
  ],
}
const SECCION = 'Nombre de la sección'
const ANADIR = 'Añadir sección'

/** Lo monta como lo usa el formulario: el valor vive afuera y vuelve por props. */
function montar({ inicial = [], modo = 'editar', error } = {}) {
  const cambios = vi.fn()
  function Formulario() {
    const [valor, setValor] = useState(inicial)
    return (
      <GradosConDiaDeClase
        campo={CAMPO}
        valor={valor}
        modo={modo}
        error={error}
        onCambio={(nombre, siguiente) => {
          cambios(nombre, siguiente)
          setValor(siguiente)
        }}
      />
    )
  }
  render(<Formulario />)
  return { ultimo: () => cambios.mock.calls.at(-1)?.[1], cambios }
}

const tarjeta = (grado) => screen.getByLabelText(grado).closest('div.rounded-lg')

describe('GradosConDiaDeClase', () => {
  it('marcar un grado pide su día; respeta el orden de las opciones, no el del clic', () => {
    const { ultimo } = montar()

    fireEvent.click(screen.getByLabelText('3.º'))
    fireEvent.click(screen.getByLabelText('1.º'))
    expect(ultimo()).toEqual([
      expect.objectContaining({ id_grado: 1, dia_clase: null }),
      expect.objectContaining({ id_grado: 3, dia_clase: null }),
    ])
    // Sin día elegido el campo queda marcado como obligatorio.
    expect(within(tarjeta('1.º')).getByText('Obligatorio')).toBeInTheDocument()

    fireEvent.change(within(tarjeta('1.º')).getByLabelText(/Día de clase/), { target: { value: '2' } })
    expect(ultimo()[0]).toEqual(expect.objectContaining({ id_grado: 1, dia_clase: 2 }))

    // Desmarcar lo quita; el día de los demás se conserva.
    fireEvent.click(screen.getByLabelText('3.º'))
    expect(ultimo()).toEqual([expect.objectContaining({ id_grado: 1, dia_clase: 2 })])
  })

  it('un colegio antiguo trae el día en null y no se le inventa uno', () => {
    montar({ inicial: [{ id_grado: 2, dia_clase: null }] })
    const select = within(tarjeta('2.º')).getByLabelText(/Día de clase/)

    expect(select.value).toBe('')
    expect(within(tarjeta('2.º')).getByText('Obligatorio')).toBeInTheDocument()
  })

  it('añade secciones sin repetir (mayúsculas y espacios dan igual) y solo quita las nuevas', () => {
    const { ultimo } = montar({ inicial: [{ id_grado: 1, dia_clase: 1, secciones: [{ id: 101, nombre: 'Única' }] }] })
    const caja = tarjeta('1.º')
    const nombre = within(caja).getByLabelText(SECCION)

    expect(within(caja).getByRole('button', { name: ANADIR })).toBeDisabled()
    fireEvent.change(nombre, { target: { value: ' A ' } })
    fireEvent.click(within(caja).getByRole('button', { name: ANADIR }))
    expect(ultimo()[0].secciones).toEqual([
      { id: 101, nombre: 'Única' },
      { id: null, nombre: 'A' },
    ])

    // Enter también añade, y "a" es la misma sección que "A".
    fireEvent.change(nombre, { target: { value: 'a' } })
    fireEvent.keyDown(nombre, { key: 'Enter' })
    expect(ultimo()[0].secciones).toHaveLength(2)
    expect(nombre.value).toBe('')

    // Otra tecla no hace nada.
    fireEvent.change(nombre, { target: { value: 'B' } })
    fireEvent.keyDown(nombre, { key: 'Tab' })
    expect(ultimo()[0].secciones).toHaveLength(2)

    // La ya creada (con id) no se puede quitar; la recién escrita sí.
    expect(within(caja).queryByRole('button', { name: 'Quitar Única' })).not.toBeInTheDocument()
    fireEvent.click(within(caja).getByRole('button', { name: 'Quitar A' }))
    expect(ultimo()[0].secciones).toEqual([{ id: 101, nombre: 'Única' }])
  })

  it('un grado marcado sin secciones lo dice', () => {
    montar({ inicial: [{ id_grado: 3, dia_clase: 4 }] })
    expect(within(tarjeta('3.º')).getByText('Ninguna todavía')).toBeInTheDocument()
  })

  it('muestra el error del formulario', () => {
    montar({ error: 'Elija al menos un grado' })
    expect(screen.getByText('Elija al menos un grado')).toBeInTheDocument()
  })

  it('en solo lectura enseña grado, día y secciones, sin controles', () => {
    montar({
      modo: 'ver',
      inicial: [
        { id_grado: 1, dia_clase: 3, secciones: [{ id: 101, nombre: 'Única' }] },
        { id_grado: 2, dia_clase: null },
      ],
    })

    expect(screen.getByText('1.º')).toBeInTheDocument()
    expect(screen.getByText('Miércoles')).toBeInTheDocument()
    expect(screen.getByText('· Única')).toBeInTheDocument()
    expect(screen.getByText('sin día de clase')).toBeInTheDocument()
    expect(screen.getByText('· sin secciones')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('en solo lectura y sin grados muestra un guion', () => {
    montar({ modo: 'ver' })
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
