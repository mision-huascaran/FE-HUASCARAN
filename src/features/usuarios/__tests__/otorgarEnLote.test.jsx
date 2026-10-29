// Otorgar varios permisos de una vez (CU028 + tanda I).
//
// Lo que se comprueba es lo que distingue este modal del anterior:
//
//   · Sigue saliendo UN permiso por combinación de grado y módulo, que es lo
//     que CU028 exige ("cada permiso autoriza un solo módulo"). Lo que cambia
//     es que se piden juntos.
//   · Los colegios y grados del Docente se AGRUPAN, no se filtran: CU028
//     prohíbe limitarlos, porque el Supervisor puede autorizarlo para
//     sustituir a otro Docente.
//   · El lote es TODO O NADA, y cuando falla hay que señalar CADA combinación
//     rechazada, no solo la primera.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import ModalOtorgarPermiso from '../ModalOtorgarPermiso'

const ESPERA = { timeout: 8000 }

const DOCENTE = { id_usuario: 9, nombre: 'Antonio TEST 5' }

/** Trece colegios, como en producción: los suyos hay que poder encontrarlos. */
const COLEGIOS = [
  { id_colegio: 1, nombre: 'Amashca' },
  { id_colegio: 2, nombre: 'Canchapampa' },
  { id_colegio: 7, nombre: 'Pariacaca' },
  { id_colegio: 9, nombre: 'Shilla' },
]

/** Un Docente con DOS colegios, cada uno con grados distintos. */
const ASIGNADOS = [
  { id_colegio: '7', nombre: 'Pariacaca', grados: ['3', '5', '6'] },
  { id_colegio: '9', nombre: 'Shilla', grados: ['1'] },
]

const otorgarPermisosEnLote = vi.fn()

vi.mock('../../../api/resources/permisos', async (importOriginal) => ({
  ...(await importOriginal()),
  otorgarPermisosEnLote: (...a) => otorgarPermisosEnLote(...a),
  opcionesDePermiso: vi.fn(async () => ({
    // Solo los PA cuyo plazo ordinario ya terminó: PA4 está en curso y por eso
    // el servidor no lo ofrece.
    periodos: [
      { id: 1, nombre: 'PA1' },
      { id: 2, nombre: 'PA2' },
      { id: 3, nombre: 'PA3' },
    ],
    grados: [
      { id: 1, nombre: '1.º' },
      { id: 3, nombre: '3.º' },
      { id: 5, nombre: '5.º' },
      { id: 6, nombre: '6.º' },
    ],
  })),
}))

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarAniosEscolares: vi.fn(async () => [{ id: 2, nombre: '2026', vigente: true }]),
}))

function montar(extra = {}) {
  const onOtorgado = vi.fn()
  render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <ModalOtorgarPermiso
          abierto
          idUsuario={9}
          docente={DOCENTE}
          colegios={COLEGIOS}
          asignados={ASIGNADOS}
          idAnioEscolar="2"
          onCerrar={vi.fn()}
          onOtorgado={onOtorgado}
          {...extra}
        />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onOtorgado }
}

const dialogo = () => screen.getByRole('dialog')
const grupo = (nombre) => within(dialogo()).getByRole('group', { name: new RegExp(nombre, 'i') })

/** Deja el formulario listo salvo lo que cada prueba quiera cambiar. */
async function rellenar() {
  fireEvent.change(within(dialogo()).getByLabelText(/^Colegio/), { target: { value: '7' } })
  // Los grados llegan con las opciones del colegio.
  await screen.findByRole('checkbox', { name: '3.º' }, ESPERA)
  fireEvent.change(within(dialogo()).getByLabelText(/fin de vigencia/i), { target: { value: '2027-10-28T14:00' } })
  fireEvent.change(within(dialogo()).getByLabelText(/motivo de la autorizaci/i), {
    target: { value: 'Regularizar PA3' },
  })
}

beforeEach(() => {
  otorgarPermisosEnLote.mockReset()
  otorgarPermisosEnLote.mockResolvedValue([{ id: 1 }, { id: 2 }])
})

describe('Los colegios y grados del Docente se agrupan, no se filtran (CU028)', () => {
  it('siguen estando TODOS los colegios, con los suyos marcados y primero', async () => {
    /**
     * Esconder los demás rompería el caso que da sentido al permiso: autorizar
     * a un Docente a sustituir a otro en un aula que no es suya.
     */
    montar()
    const colegio = await within(dialogo()).findByLabelText(/^Colegio/, {}, ESPERA)
    const opciones = within(colegio)
      .getAllByRole('option')
      .map((o) => o.textContent)
      .filter((t) => t !== 'Seleccione')

    expect(opciones).toHaveLength(4)
    // Los suyos van delante y se distinguen.
    expect(opciones[0]).toMatch(/Pariacaca · asignado/)
    expect(opciones[1]).toMatch(/Shilla · asignado/)
    expect(opciones).toEqual(expect.arrayContaining([expect.stringMatching(/^Amashca$/)]))
  })

  it('los grados suyos EN ESE COLEGIO van en su propio grupo', async () => {
    // Un Docente puede tener 3.º, 5.º y 6.º en un colegio y 1.º en otro: el
    // grupo se recalcula al cambiar de colegio.
    montar()
    fireEvent.change(within(dialogo()).getByLabelText(/^Colegio/), { target: { value: '7' } })

    await screen.findByText('Asignados en este colegio', {}, ESPERA)
    expect(await screen.findByText('Otros grados', {}, ESPERA)).toBeInTheDocument()
    // Y el 1.º, que es de Shilla, no cuenta como suyo aquí.
    expect(within(grupo('Grados')).getByRole('checkbox', { name: '1.º' })).toBeInTheDocument()
  })

  it('con VARIOS colegios asignados no se preselecciona ninguno', async () => {
    // Elegir por él sería adivinar, y adivinar mal es autorizar el colegio
    // equivocado.
    montar()
    const colegio = await within(dialogo()).findByLabelText(/^Colegio/, {}, ESPERA)
    expect(colegio).toHaveValue('')
  })
})

describe('Varias combinaciones en un solo lote', () => {
  it('cuenta los permisos ANTES de confirmar', async () => {
    // Dos grados por tres módulos son seis permisos, y seis no es lo que nadie
    // cree estar otorgando al marcar cinco casillas.
    montar()
    await rellenar()

    fireEvent.click(within(grupo('Grados')).getByRole('checkbox', { name: '3.º' }))
    fireEvent.click(within(grupo('Grados')).getByRole('checkbox', { name: '5.º' }))
    fireEvent.click(within(grupo('Módulos')).getByRole('checkbox', { name: 'Rúbrica' }))

    expect(await screen.findByText(/Se otorgarán/, {}, ESPERA)).toHaveTextContent(
      /2 permisos: 3\.º · Rúbrica · 5\.º · Rúbrica/,
    )
  })

  it('manda una combinación por cada cruce de grado y módulo', async () => {
    montar()
    await rellenar()

    fireEvent.click(within(grupo('Grados')).getByRole('checkbox', { name: '3.º' }))
    fireEvent.click(within(grupo('Módulos')).getByRole('checkbox', { name: 'Rúbrica' }))
    fireEvent.click(within(grupo('Módulos')).getByRole('checkbox', { name: 'Seguimiento de Lectura' }))

    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Otorgar permiso' }))

    await waitFor(() => expect(otorgarPermisosEnLote).toHaveBeenCalled(), ESPERA)
    const [, enviado] = otorgarPermisosEnLote.mock.calls[0]
    expect(enviado.combinaciones).toEqual([
      { id_grado: '3', modulo: 'rubrica' },
      { id_grado: '3', modulo: 'lectura' },
    ])
    // El alcance común viaja una sola vez.
    expect(enviado).toMatchObject({ id_colegio: '7', id_anio_escolar: '2', motivo: 'Regularizar PA3' })
  })

  it('sin grados o sin módulos no deja otorgar', async () => {
    montar()
    await rellenar()
    fireEvent.click(within(grupo('Grados')).getByRole('checkbox', { name: '3.º' }))
    // Falta el módulo.
    expect(within(dialogo()).getByRole('button', { name: 'Otorgar permiso' })).toBeDisabled()
  })
})

describe('El periodo académico', () => {
  it('propone el último que SÍ admite permiso', async () => {
    // PA3, el que acaba de cerrarse. PA4 está en curso y el servidor no lo
    // ofrece: es la regla, no un fallo.
    montar()
    fireEvent.change(within(dialogo()).getByLabelText(/^Colegio/), { target: { value: '7' } })

    const periodo = await within(dialogo()).findByLabelText(/periodo académico/i, {}, ESPERA)
    await waitFor(() => expect(periodo).toHaveValue('3'), ESPERA)
  })

  it('explica por qué no están los cuatro', async () => {
    montar()
    fireEvent.change(within(dialogo()).getByLabelText(/^Colegio/), { target: { value: '7' } })
    expect(
      await screen.findByText(/todavía admiten regularización ordinaria y no necesitan permiso/i, {}, ESPERA),
    ).toBeInTheDocument()
  })
})

describe('El lote es todo o nada', () => {
  it('señala CADA combinación rechazada, no solo la primera', async () => {
    /**
     * Con solo la primera, el Supervisor la corrige, reintenta y vuelve a
     * fallar por las otras. Y conviene decir que no se creó ninguno: un
     * permiso no se borra, se revoca.
     */
    const error = new Error('conflicto')
    error.response = {
      status: 409,
      data: {
        detail: 'Ya existe un permiso para este mismo alcance…',
        motivo: 'permiso_superpuesto',
        combinaciones_rechazadas: [
          { indice: 0, id_grado: 3, modulo: 'rubrica', motivo: 'permiso_superpuesto', detail: 'Ya existe uno.' },
          { indice: 1, id_grado: 5, modulo: 'rubrica', motivo: 'permiso_superpuesto', detail: 'Y otro más.' },
        ],
      },
    }
    otorgarPermisosEnLote.mockRejectedValue(error)

    montar()
    await rellenar()
    fireEvent.click(within(grupo('Grados')).getByRole('checkbox', { name: '3.º' }))
    fireEvent.click(within(grupo('Grados')).getByRole('checkbox', { name: '5.º' }))
    fireEvent.click(within(grupo('Módulos')).getByRole('checkbox', { name: 'Rúbrica' }))
    fireEvent.click(within(dialogo()).getByRole('button', { name: 'Otorgar permiso' }))

    expect(await screen.findByText('Ya existe uno.', { exact: false }, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Y otro más.', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/No se creó ninguno: el lote es todo o nada/)).toBeInTheDocument()
  })
})
