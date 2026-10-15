// Virtual Scrolling de la lista de asistencia (CU022, paso 5).
//
// Lo que se comprueba no es que "funcione el scroll", sino lo único que podría
// romperse sin verse: que la lista NO monte las 400 filas de golpe y que, pese
// a eso, la barra de desplazamiento siga midiendo lo que mediría la lista
// entera. Si los espaciadores fallaran, arrastrar la barra saltaría.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ListaAsistencia from '../ListaAsistencia'

const ALTO_FILA = 56

const alumnos = Array.from({ length: 400 }, (_, i) => ({
  id_alumno: i + 1,
  nombres: `Alumno ${i + 1}`,
  apellidos: 'Prueba',
  activo: true,
  en_aula: true,
  estado: null,
  observacion: null,
}))

const montar = (props = {}) =>
  render(
    <ListaAsistencia
      alumnos={alumnos}
      marcaDe={() => ({ estado: null, observacion: null })}
      soloLectura={false}
      onMarcar={() => {}}
      onObservar={() => {}}
      {...props}
    />,
  )

const filasPintadas = () =>
  [...screen.getByRole('table').querySelectorAll('tbody tr')].filter((f) => f.getAttribute('role') !== 'presentation')

describe('Virtual Scrolling de la lista', () => {
  it('con 400 alumnos monta solo un puñado de filas', () => {
    montar()
    const filas = filasPintadas()
    expect(filas.length).toBeGreaterThan(0)
    expect(filas.length).toBeLessThan(40)
  })

  it('el alto total se conserva: la barra mide la lista entera', () => {
    const { container } = montar()
    const espaciadores = [...container.querySelectorAll('tbody tr[role="presentation"] td')]
    const reservado = espaciadores.reduce((suma, td) => suma + parseInt(td.style.height || '0', 10), 0)
    const montadas = filasPintadas().length

    expect(reservado + montadas * ALTO_FILA).toBe(alumnos.length * ALTO_FILA)
  })

  it('al desplazarse aparecen los alumnos de más abajo', () => {
    // El nombre va partido en dos `span` ("Apellidos" y ", Nombres") para poder
    // dar más peso al apellido, que es por donde ordena el servidor.
    const enPantalla = (nombre) => screen.queryByText(`, ${nombre}`)

    const { container } = montar()
    expect(enPantalla('Alumno 200')).not.toBeInTheDocument()

    const vista = container.firstChild
    fireEvent.scroll(vista, { target: { scrollTop: 199 * ALTO_FILA } })

    expect(enPantalla('Alumno 200')).toBeInTheDocument()
    expect(enPantalla('Alumno 1')).not.toBeInTheDocument()
  })

  it('marca a los alumnos dados de baja que constan ese día', () => {
    montar({ alumnos: [{ ...alumnos[0], activo: false }] })
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })
})
