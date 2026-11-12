// Importar nómina de alumnos (CU014, semana 14) — exclusivo del Supervisor.
//
// Se cubre el flujo completo: elegir archivo → vista previa → confirmar, y
// los dos motivos de error que cambian el paso (desactualizada, sin
// alumnos listos), sin depender de un backend real ni de leer un .xlsx de
// verdad (eso lo decide `vistaPreviaImportacion`, aquí espiada).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AlumnosPage from '../AlumnosPage'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
}))

const escribirArchivo = vi.fn()
vi.mock('xlsx', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, writeFile: (...a) => escribirArchivo(...a) }
})

const vistaPrevia = vi.fn()
const confirmar = vi.fn()
const consultar = vi.fn()
vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    vistaPreviaImportacion: (...a) => vistaPrevia(...a),
    confirmarImportacion: (...a) => confirmar(...a),
    consultarImportacion: (...a) => consultar(...a),
  }
})

const ESPERA = { timeout: 8000 }
const ARCHIVO = new File(['contenido'], 'nomina.xlsx', {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
})

const PREVIA = {
  listos: 2,
  con_advertencia: 1,
  no_importadas: 1,
  huella: 'huella-1',
  observaciones: [
    { hoja: 'PLAYWRIGHT', fila: 7, tipo: 'advertencia', motivo: 'grado_no_reconocido', detalle: 'Grado no reconocido. Se importará sin grado.' },
    { hoja: 'OTRO COLEGIO', fila: 2, tipo: 'rechazo', motivo: 'colegio_no_registrado', detalle: 'Colegio no registrado.' },
  ],
}

function montar(idRol = ROLES.SUPERVISOR) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: idRol === ROLES.DOCENTE ? 1 : null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <AlumnosPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

/** Abre el modal y elige el archivo de prueba, hasta que llegue la vista previa. */
async function abrirYElegirArchivo() {
  fireEvent.click(await screen.findByRole('button', { name: /^importar nómina$/i }, ESPERA))
  const dialogo = await screen.findByRole('dialog', {}, ESPERA)
  const input = dialogo.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [ARCHIVO] } })
  await waitFor(() => expect(vistaPrevia).toHaveBeenCalledWith(ARCHIVO, 'nomina.xlsx'), ESPERA)
  return dialogo
}

beforeEach(() => {
  vistaPrevia.mockReset().mockResolvedValue(PREVIA)
  confirmar.mockReset()
  consultar.mockReset()
  escribirArchivo.mockReset()
})

afterEach(() => useSessionStore.setState({ token: null, usuario: null }))

describe('Importar nómina — quién la ve', () => {
  it('el Supervisor tiene el botón; el Docente no', async () => {
    montar(ROLES.SUPERVISOR)
    expect(await screen.findByRole('button', { name: /^importar nómina$/i }, ESPERA)).toBeInTheDocument()
  })

  it('el Docente no ve "Importar nómina"', async () => {
    montar(ROLES.DOCENTE)
    await screen.findByRole('button', { name: /^agregar$/i }, ESPERA)
    expect(screen.queryByRole('button', { name: /^importar nómina$/i })).not.toBeInTheDocument()
  })
})

describe('Importar nómina — plantilla', () => {
  it('"Descargar plantilla" genera un .xlsx con las 4 columnas que el import lee', async () => {
    montar(ROLES.SUPERVISOR)
    fireEvent.click(await screen.findByRole('button', { name: /^importar nómina$/i }, ESPERA))
    const dialogo = await screen.findByRole('dialog', {}, ESPERA)

    fireEvent.click(within(dialogo).getByRole('button', { name: /descargar plantilla/i }))

    expect(escribirArchivo).toHaveBeenCalledTimes(1)
    const [libro, nombre] = escribirArchivo.mock.calls[0]
    expect(nombre).toBe('plantilla_nomina.xlsx')
    const hoja = libro.Sheets[libro.SheetNames[0]]
    expect(hoja.A1.v).toBe('II.EE')
    expect(hoja.B1.v).toBe('GRADO')
    expect(hoja.C1.v).toBe('NOMBRES Y APELLIDOS')
    expect(hoja.D1.v).toBe('DNI')
  })
})

describe('Importar nómina — flujo', () => {
  it('al elegir el archivo, pide la vista previa y muestra los conteos y las observaciones', async () => {
    montar()
    const dialogo = await abrirYElegirArchivo()

    expect(await screen.findByText('2 alumnos listos para importar', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('1 filas con advertencia')).toBeInTheDocument()
    expect(screen.getByText('1 filas que no se importarán')).toBeInTheDocument()
    expect(screen.getByText('Colegio no registrado.')).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /^confirmar importación$/i })).toBeEnabled()
  })

  it('"Confirmar importación" manda el mismo archivo y la huella de la vista previa', async () => {
    confirmar.mockResolvedValue({ id_importacion: 'x', importados: 2, no_importadas: 1, con_advertencia: 1 })
    montar()
    const dialogo = await abrirYElegirArchivo()

    fireEvent.click(within(dialogo).getByRole('button', { name: /^confirmar importación$/i }))

    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(1), ESPERA)
    const [archivoEnviado, datos] = confirmar.mock.calls[0]
    expect(archivoEnviado).toBe(ARCHIVO)
    expect(datos.huella).toBe('huella-1')
    expect(datos.nombreArchivo).toBe('nomina.xlsx')
    expect(typeof datos.idImportacion).toBe('string')

    // Éxito: el aviso lo dice y el modal se cierra (vuelve a "Seleccionar archivo").
    expect(await screen.findByText(/Alumnos importados: 2\. Filas no importadas: 1\./, {}, ESPERA)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), ESPERA)
  })

  it('sin alumnos listos, "Confirmar importación" queda deshabilitado', async () => {
    vistaPrevia.mockResolvedValue({ ...PREVIA, listos: 0, con_advertencia: 0, no_importadas: 3 })
    montar()
    const dialogo = await abrirYElegirArchivo()

    expect(await screen.findByText('No hay alumnos para importar en este archivo.', {}, ESPERA)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /^confirmar importación$/i })).toBeDisabled()
  })

  it('409 importacion_desactualizada vuelve a pedir el archivo', async () => {
    const error = new Error('cambiaron')
    error.response = { status: 409, data: { detail: 'Los datos cambiaron desde la vista previa. Carga el archivo nuevamente.', motivo: 'importacion_desactualizada' } }
    confirmar.mockRejectedValue(error)
    montar()
    const dialogo = await abrirYElegirArchivo()

    fireEvent.click(within(dialogo).getByRole('button', { name: /^confirmar importación$/i }))

    expect(await screen.findByText('Los datos cambiaron desde la vista previa. Carga el archivo nuevamente.', {}, ESPERA)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: /^seleccionar archivo$/i })).toBeInTheDocument()
  })

  it('"Cancelar" cierra sin confirmar nada', async () => {
    montar()
    const dialogo = await abrirYElegirArchivo()

    fireEvent.click(within(dialogo).getByRole('button', { name: /^cancelar$/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), ESPERA)
    expect(confirmar).not.toHaveBeenCalled()
  })
})
