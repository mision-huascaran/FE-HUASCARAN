// D77 y D78 — Revocar un permiso de corrección (CU028).
//
// Antes la revocación vivía DENTRO de "Ver permiso", así que revocar era un
// efecto secundario de consultar. CU028 lo separa: la columna Acciones tiene
// "Ver permiso" y, para los programados o vigentes, "Revocar".
//
// Y los modales que recogen datos no se cierran con un clic fuera: un descuido
// no puede tirar un formulario a medio llenar.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import ModalRevocarPermiso, { MOTIVO_REVOCACION_VACIO } from '../ModalRevocarPermiso'

const PERMISO = {
  id: 3,
  estado: 'vigente',
  anio_escolar: { id: 2, nombre: '2026' },
  colegio: { id: 1, nombre: 'I.E. Amashca' },
  grado: { id: 2, nombre: '2.°' },
  periodo_academico: { id: 6, nombre: 'PA2' },
  modulo: 'asistencias',
  inicio: '2026-10-01T13:00:00Z',
  fin: '2026-10-31T13:00:00Z',
}

const DOCENTE = { id_usuario: 9, nombre: 'Rosa Quispe' }

function montar(extra = {}) {
  const onRevocar = vi.fn()
  const onCerrar = vi.fn()
  render(
    <ModalRevocarPermiso
      permiso={PERMISO}
      docente={DOCENTE}
      onRevocar={onRevocar}
      onCerrar={onCerrar}
      {...extra}
    />,
  )
  return { onRevocar, onCerrar }
}

const dialogo = () => screen.getByRole('dialog')
const boton = (nombre) => within(dialogo()).getByRole('button', { name: nombre })

beforeEach(() => vi.clearAllMocks())

describe('El modal de revocación (D77)', () => {
  it('muestra el alcance del permiso en solo lectura', () => {
    // Revocar sin ver qué se está revocando es decidir a ciegas.
    montar()
    const en = within(dialogo())

    expect(en.getByText('Rosa Quispe')).toBeInTheDocument()
    expect(en.getByText('I.E. Amashca')).toBeInTheDocument()
    expect(en.getByText('2.°')).toBeInTheDocument()
    expect(en.getByText('PA2')).toBeInTheDocument()
  })

  it('avisa de que NO deshace las correcciones ya hechas', () => {
    /**
     * Es lo importante y lo que un Supervisor podría suponer al revés: la
     * revocación corta las operaciones NUEVAS desde que el servidor la
     * confirma, no revierte el trabajo del Docente.
     */
    montar()
    expect(
      within(dialogo()).getByText(
        'La revocación impedirá nuevas operaciones con este permiso desde el momento en que sea confirmada por el servidor. Las correcciones realizadas anteriormente conservarán su historial.',
      ),
    ).toBeInTheDocument()
  })

  it('el motivo es obligatorio: sin él no se puede confirmar', () => {
    montar()
    expect(boton('Confirmar revocación')).toBeDisabled()

    fireEvent.change(within(dialogo()).getByLabelText(/motivo de revocación/i), {
      target: { value: 'Se otorgó por error' },
    })
    expect(boton('Confirmar revocación')).toBeEnabled()
  })

  it('motivo vacío o solo espacios: lo dice con el texto de CU028 (D77)', () => {
    montar()
    const campo = within(dialogo()).getAllByRole('textbox')[0]
    fireEvent.change(campo, { target: { value: '   ' } })
    fireEvent.blur(campo)
    expect(within(dialogo()).getByText(MOTIVO_REVOCACION_VACIO)).toBeInTheDocument()
  })

  it('manda el motivo recortado', () => {
    const { onRevocar } = montar()
    fireEvent.change(within(dialogo()).getByLabelText(/motivo de revocación/i), {
      target: { value: '  Se otorgó por error  ' },
    })
    fireEvent.click(boton('Confirmar revocación'))
    expect(onRevocar).toHaveBeenCalledWith('Se otorgó por error')
  })

  it('el error del motivo sale DEBAJO de su campo', () => {
    montar({ error: 'Ingresa el motivo de la revocación.' })
    expect(within(dialogo()).getByText('Ingresa el motivo de la revocación.')).toBeInTheDocument()
  })

  it('mientras procesa no se puede confirmar dos veces', () => {
    montar({ revocando: true })
    expect(boton('Confirmar revocación')).toBeDisabled()
    expect(boton('Cancelar')).toBeDisabled()
  })
})

describe('Cómo se cierra (D78)', () => {
  it('sin datos escritos, Cancelar cierra directo', () => {
    // Preguntar por un formulario intacto es un estorbo.
    const { onCerrar } = montar()
    fireEvent.click(boton('Cancelar'))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('con el motivo escrito, Cancelar PREGUNTA dentro del mismo modal', () => {
    const { onCerrar } = montar()
    fireEvent.change(within(dialogo()).getByLabelText(/motivo de revocación/i), { target: { value: 'Algo' } })
    fireEvent.click(boton('Cancelar'))

    expect(within(dialogo()).getByText('Tienes datos sin guardar. ¿Deseas descartarlos?')).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('"Continuar completando" devuelve el formulario con lo escrito', () => {
    montar()
    const campo = within(dialogo()).getByLabelText(/motivo de revocación/i)
    fireEvent.change(campo, { target: { value: 'Se otorgó por error' } })
    fireEvent.click(boton('Cancelar'))
    fireEvent.click(boton('Continuar completando'))

    expect(within(dialogo()).getByLabelText(/motivo de revocación/i)).toHaveValue('Se otorgó por error')
  })

  it('"Descartar datos" cierra de verdad', () => {
    const { onCerrar } = montar()
    fireEvent.change(within(dialogo()).getByLabelText(/motivo de revocación/i), { target: { value: 'Algo' } })
    fireEvent.click(boton('Cancelar'))
    fireEvent.click(boton('Descartar datos'))

    expect(onCerrar).toHaveBeenCalled()
  })

  it('pulsar FUERA del modal no lo cierra', () => {
    /**
     * El fondo oscuro ya no es un botón cuando `cierreExterior` es false: no
     * existe el control, así que no hay nada que pulsar por error.
     */
    const { onCerrar } = montar()
    const cierres = screen.queryAllByRole('button', { name: 'Cerrar' })
    // Solo la X de la cabecera, que se comporta como "Cancelar".
    expect(cierres.length).toBeLessThanOrEqual(1)
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
