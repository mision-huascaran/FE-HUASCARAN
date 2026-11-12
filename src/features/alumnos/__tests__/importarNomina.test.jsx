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
import * as XLSX from 'xlsx'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import AlumnosPage from '../AlumnosPage'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'
import { hoy } from '../../../lib/relojServidor'

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

const COLEGIO = { id: 1, nombre: 'I.E. Amashca' }

/** Como llega una fila del listado real. */
const fila = (id, nombres, apellidos) => ({
  id_alumno: id,
  id,
  nombre: `${apellidos}, ${nombres}`,
  dni: '1000000' + id,
  activo: true,
  pertenencia_pendiente: false,
  id_colegio: COLEGIO.id,
  colegio: COLEGIO,
  id_grado: 1,
  grado: { id: 1, nombre: '1.º' },
  id_programa: 1,
  programa: { id: 1, nombre: 'Alfabetización' },
  id_seccion: 7,
  seccion: 'Única',
})

const ALUMNOS = [fila(1, 'Juan', 'Quispe'), fila(2, 'Ana', 'Rojas')]

const vistaPrevia = vi.fn()
const confirmar = vi.fn()
const consultar = vi.fn()
const listarAlumnos = vi.fn(async () => ({ items: ALUMNOS, total: 2, pagina: 1, paginas: 1, por_pagina: 40 }))
vi.mock('../../../api/resources/administracion', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    vistaPreviaImportacion: (...a) => vistaPrevia(...a),
    confirmarImportacion: (...a) => confirmar(...a),
    consultarImportacion: (...a) => consultar(...a),
    listarAlumnosAdmin: (...a) => listarAlumnos(...a),
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

describe('Alumnos — plantilla y exportar', () => {
  /**
   * "Descargar plantilla" va JUNTO a "Importar nómina", no dentro del modal:
   * ahí adentro confundía ("entro a importar... ¿para qué descargar?").
   */
  it('"Descargar plantilla" (al lado de "Importar nómina") genera un .xlsx con las 4 columnas que el import lee', async () => {
    montar(ROLES.SUPERVISOR)
    await screen.findByRole('button', { name: /^importar nómina$/i }, ESPERA)

    fireEvent.click(screen.getByRole('button', { name: /descargar plantilla/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(escribirArchivo).toHaveBeenCalledTimes(1)
    const [libro, nombre] = escribirArchivo.mock.calls[0]
    expect(nombre).toBe('plantilla_nomina.xlsx')
    const hoja = libro.Sheets[libro.SheetNames[0]]
    expect(hoja.A1.v).toBe('II.EE')
    expect(hoja.B1.v).toBe('GRADO')
    expect(hoja.C1.v).toBe('NOMBRES Y APELLIDOS')
    expect(hoja.D1.v).toBe('DNI')
  })

  /**
   * "Exportar" es harina de otro costal: no es la plantilla vacía, es la
   * data que la tabla YA tiene cargada —con los filtros puestos—, no un solo
   * alumno de ejemplo (bug reportado: "solo sale un alumno").
   */
  it('"Exportar" descarga los alumnos que la tabla tiene cargados, todos, no uno solo', async () => {
    montar(ROLES.SUPERVISOR)
    expect(await screen.findByText('Quispe, Juan', {}, ESPERA)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^exportar$/i }))

    expect(escribirArchivo).toHaveBeenCalledTimes(1)
    const [libro, nombre] = escribirArchivo.mock.calls[0]
    expect(nombre).toBe(`alumnos_${hoy()}.xlsx`)
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]])
    expect(filas).toHaveLength(2)
    expect(filas.map((f) => f.Alumno)).toEqual(['Quispe, Juan', 'Rojas, Ana'])
    expect(filas[0].Colegio).toBe('I.E. Amashca')
  })

  it('el Docente también puede exportar, aunque no vea "Importar nómina" ni "Descargar plantilla"', async () => {
    montar(ROLES.DOCENTE)
    await screen.findByRole('button', { name: /^agregar$/i }, ESPERA)

    expect(screen.queryByRole('button', { name: /descargar plantilla/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^exportar$/i })).toBeInTheDocument()
  })
})

describe('Importar nómina — arrastrar y soltar', () => {
  it('soltar el archivo sobre la zona hace lo mismo que elegirlo por clic', async () => {
    montar(ROLES.SUPERVISOR)
    fireEvent.click(await screen.findByRole('button', { name: /^importar nómina$/i }, ESPERA))
    const zona = await screen.findByRole('button', { name: /seleccionar archivo/i }, ESPERA)

    fireEvent.drop(zona, { dataTransfer: { files: [ARCHIVO] } })

    await waitFor(() => expect(vistaPrevia).toHaveBeenCalledWith(ARCHIVO, 'nomina.xlsx'), ESPERA)
    expect(await screen.findByText('2 alumnos listos para importar', {}, ESPERA)).toBeInTheDocument()
  })

  /**
   * "Importar nómina" ya sale deshabilitado sin conexión (no se llega a abrir
   * el modal), pero la zona se defiende igual por si acaso: soltar un archivo
   * mientras YA se está leyendo el anterior (`paso === 'cargando'`) no debe
   * disparar una segunda vista previa encima de la primera.
   */
  it('mientras se está leyendo un archivo, soltar otro encima no hace nada', async () => {
    vistaPrevia.mockImplementation(() => new Promise(() => {})) // nunca resuelve: se queda en "cargando"
    montar(ROLES.SUPERVISOR)
    fireEvent.click(await screen.findByRole('button', { name: /^importar nómina$/i }, ESPERA))
    const zona = await screen.findByRole('button', { name: /seleccionar archivo/i }, ESPERA)

    fireEvent.drop(zona, { dataTransfer: { files: [ARCHIVO] } })
    await waitFor(() => expect(vistaPrevia).toHaveBeenCalledTimes(1), ESPERA)
    await screen.findByText('Leyendo el archivo…', {}, ESPERA)

    fireEvent.drop(zona, { dataTransfer: { files: [ARCHIVO] } })

    expect(vistaPrevia).toHaveBeenCalledTimes(1)
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
