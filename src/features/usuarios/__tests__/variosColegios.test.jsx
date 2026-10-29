// D67 — Un Docente con VARIOS colegios (CU016, tanda G1).
//
// El formulario anterior admitía uno solo. Al editar a quien tenía dos, el
// segundo no se veía, y al guardar se lo quitaba sin que nadie lo pidiera:
// en la edición `colegios` es la lista COMPLETA del año, así que lo que no
// viene se libera.
//
// Y el inicio de asignación es POR COLEGIO, no del formulario: cada uno tiene
// su calendario, así que uno puede estar en un PA y otro en receso.
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import ColegiosDelDocente, { opcionesDeInicio } from '../ColegiosDelDocente'

const ETIQUETA = 'Colegios asignados'

const OPCIONES = [
  { value: '1', label: 'I.E. Amashca' },
  { value: '4', label: 'I.E. Lejano' },
  { value: '7', label: 'I.E. Shilla' },
]

const GRADOS = [
  { value: '1', label: '1.°' },
  { value: '2', label: '2.°' },
]

/** El colegio 4 está hoy en su PR2; el 7, en el PR4. */
const RECESOS = {
  4: { numero: 2, es_pr4: false, fecha_fin: '2026-07-31' },
  7: { numero: 4, es_pr4: true, fecha_fin: '2027-02-15' },
}

function montar(valor, modo = 'nuevo') {
  const cambios = []
  render(
    <ColegiosDelDocente
      modo={modo}
      valor={valor}
      onCambio={(nombre, siguiente) => cambios.push(siguiente)}
      campo={{
        nombre: 'colegios',
        etiqueta: ETIQUETA,
        requerido: true,
        opciones: OPCIONES,
        gradosDe: () => GRADOS,
        recesoDe: (id) => RECESOS[Number(id)] ?? null,
      }}
    />,
  )
  return cambios
}

describe('Las opciones de inicio de asignación', () => {
  it('en un PR normal se puede elegir Retroactivo o Próximo', () => {
    const opciones = opcionesDeInicio(RECESOS[4])
    expect(opciones.map((o) => o.value)).toEqual(['retroactivo', 'proximo'])
    expect(opciones.every((o) => !o.disabled)).toBe(true)
  })

  it('en el PR4 "Próximo" sale DESHABILITADO, no escondido', () => {
    /**
     * No hay un PA siguiente al que asignar: el backend responde 422 pidiendo
     * que se elija el año escolar que viene. Deshabilitarlo deja ver que la
     * opción existe y por qué no sirve aquí; esconderla haría pensar que el
     * sistema no la contempla.
     */
    const proximo = opcionesDeInicio(RECESOS[7]).find((o) => o.value === 'proximo')
    expect(proximo.disabled).toBe(true)
  })

  it('sin receso no hay nada que preguntar', () => {
    expect(opcionesDeInicio(null)).toEqual([])
  })
})

describe('El bloque de cada colegio', () => {
  it('solo pide "Inicio de asignación" en los colegios que están en receso', () => {
    // El 1 está en un PA: ahí no hay ambigüedad y el servidor lo ignora.
    montar([
      { id_colegio: '1', grados: [], inicio_asignacion: '' },
      { id_colegio: '4', grados: [], inicio_asignacion: '' },
    ])

    const inicios = screen.getAllByLabelText(/inicio de asignación/i)
    expect(inicios).toHaveLength(1)
  })

  /** D67 — CP-USR-09. CU016: un Radio Button por opción, con su texto de ayuda literal. */
  it('el inicio de asignación son radios con los textos de ayuda de CU016', () => {
    const cambios = []
    render(
      <ColegiosDelDocente
        modo="nuevo"
        valor={[{ id_colegio: '4', grados: [], inicio_asignacion: '' }]}
        onCambio={(_, valor) => cambios.push(valor)}
        campo={{
          nombre: 'colegios',
          etiqueta: ETIQUETA,
          opciones: OPCIONES,
          gradosDe: () => GRADOS,
          recesoDe: (id) => RECESOS[Number(id)] ?? null,
        }}
      />,
    )

    const grupo = screen.getByRole('radiogroup', { name: 'Inicio de asignación' })
    expect(within(grupo).getByRole('radio', { name: /Retroactivo/ })).toBeInTheDocument()
    expect(within(grupo).getByText('Aplica para el periodo culminado, permitiendo regularizar registros pasados.')).toBeInTheDocument()
    expect(within(grupo).getByText('Inicia estrictamente en el siguiente periodo académico.')).toBeInTheDocument()

    fireEvent.click(within(grupo).getByRole('radio', { name: /Próximo/ }))
    expect(cambios.at(-1)[0].inicio_asignacion).toBe('proximo')
  })

  it('el aviso del receso nombra el periodo y hasta cuándo dura', () => {
    montar([{ id_colegio: '4', grados: [], inicio_asignacion: '' }])
    expect(screen.getByText(/Este colegio está en receso \(PR2\) hasta el/)).toBeInTheDocument()
  })

  it('en el PR4 el aviso explica que hay que cambiar de año', () => {
    montar([{ id_colegio: '7', grados: [], inicio_asignacion: '' }])
    expect(screen.getByText(/Para asignarlo al año siguiente, cambia el año escolar/)).toBeInTheDocument()
  })

  it('un colegio ya elegido no se vuelve a ofrecer en los demás', () => {
    // Repetirlo es un 422 (`asignacion.colegios.{i}.id_colegio`).
    montar([
      { id_colegio: '1', grados: [], inicio_asignacion: '' },
      { id_colegio: '', grados: [], inicio_asignacion: '' },
    ])

    // Los dos desplegables de colegio, en orden.
    const selects = screen.getAllByRole('combobox')
    const segundo = selects[1]
    expect(within(segundo).queryByRole('option', { name: 'I.E. Amashca' })).not.toBeInTheDocument()
    expect(within(segundo).getByRole('option', { name: 'I.E. Lejano' })).toBeInTheDocument()
  })

  it('cada bloque tiene su propio botón de quitar', () => {
    montar([
      { id_colegio: '1', grados: [], inicio_asignacion: '' },
      { id_colegio: '4', grados: [], inicio_asignacion: '' },
    ])
    expect(screen.getByRole('button', { name: 'Quitar el colegio 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar el colegio 2' })).toBeInTheDocument()
  })

  it('sin colegios lo dice: un Docente necesita al menos uno', () => {
    // El backend lo exige (`asignacion_requerida`), así que el formulario no
    // puede dejar que parezca opcional.
    montar([])
    expect(screen.getByText('Un Docente necesita al menos un colegio asignado.')).toBeInTheDocument()
  })

  it('los errores por índice salen en el bloque de SU colegio', () => {
    /**
     * El backend los manda con el índice dentro:
     * `asignacion.colegios.1.inicio_asignacion`. Sin repartirlos, el
     * Supervisor vería un mensaje arriba sin saber cuál de los dos colegios
     * lo provocó.
     */
    render(
      <ColegiosDelDocente
        modo="nuevo"
        valor={[
          { id_colegio: '1', grados: [], inicio_asignacion: '' },
          { id_colegio: '4', grados: [], inicio_asignacion: '' },
        ]}
        onCambio={() => {}}
        campo={{
          nombre: 'colegios',
          etiqueta: ETIQUETA,
          opciones: OPCIONES,
          gradosDe: () => GRADOS,
          recesoDe: (id) => RECESOS[Number(id)] ?? null,
          erroresPorIndice: { '1.inicio_asignacion': 'Indica desde cuándo rige la asignación.' },
        }}
      />,
    )

    expect(screen.getByText('Indica desde cuándo rige la asignación.')).toBeInTheDocument()
  })
})
