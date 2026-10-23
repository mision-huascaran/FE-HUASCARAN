// Detalle del alumno (CU015): cabecera y las cuatro pestañas con la forma
// nueva de los endpoints (P4 y P5): asistencia como objeto, nivel colocado del
// Registro de Vuelo, lectura por tabla semanal, rúbrica mensual y los 4 PA.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

const ID = 1

async function abrirFicha({ rol = ROLES.SUPERVISOR } = {}) {
  renderConProveedores(null, { ruta: `/estudiantes/${ID}`, rol })
  return screen.findByRole('heading', { level: 1 }, { timeout: 8000 })
}

const NIVEL = 'Nivel colocado'
const ASISTENCIA = 'Asistencia'

const tarjeta = (rotulo) => screen.getByText(rotulo).closest('.shadow-card')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Detalle del alumno (CU015)', () => {
  it('muestra el nombre y abre en Resumen con el nivel colocado y la asistencia como objeto', async () => {
    const original = await handlers.alumnos.detalle(ID)
    expect(await abrirFicha()).toHaveTextContent(original.nombre)

    expect(await screen.findByText(NIVEL)).toBeInTheDocument()
    expect(within(tarjeta(NIVEL)).getByText('J')).toBeInTheDocument()
    expect(within(tarjeta(NIVEL)).getByText('Logrado')).toBeInTheDocument()
    expect(within(tarjeta(ASISTENCIA)).getByText('92.5%')).toBeInTheDocument()
    expect(within(tarjeta(ASISTENCIA)).getByText(/37 de 40 clases/)).toBeInTheDocument()
  })

  it('sin asistencias dice "Sin datos de asistencia", no 0 %', async () => {
    vi.spyOn(handlers.administracion, 'resumenAlumno').mockResolvedValue({
      nivel_colocado: null,
      libros_leidos_anio: 0,
      asistencia: { porcentaje: null, asistidas: 0, contabilizadas: 0 },
    })
    await abrirFicha()
    expect(await screen.findByText('Sin datos de asistencia')).toBeInTheDocument()
    expect(screen.getByText('Sin evaluar')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('Seguimiento de Lectura lista sus filas semanales y marca la tabla no realizada', async () => {
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Seguimiento de Lectura' }))
    expect(await screen.findByText('El zorro (0/5)')).toBeInTheDocument()
    expect(screen.getByText('Completada')).toBeInTheDocument()
    expect(screen.getByText('No realizada')).toBeInTheDocument()
  })

  it('Rúbrica distingue "Sin evaluar" de un nivel y muestra el resultado con un decimal', async () => {
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Rúbrica' }))
    expect(await screen.findByText('1.6')).toBeInTheDocument()
    expect(screen.getByText('Sin evaluar')).toBeInTheDocument()
    expect(screen.getByText('Incompleta')).toBeInTheDocument()
  })

  it('Registro de Vuelo muestra siempre los 4 PA, con "Pendiente del periodo anterior" y "Sin registrar"', async () => {
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Registro de Vuelo' }))
    expect(await screen.findByText('PA4')).toBeInTheDocument()
    ;['PA1', 'PA2', 'PA3'].forEach((pa) => expect(screen.getByText(pa)).toBeInTheDocument())
    expect(screen.getByText('Pendiente del periodo anterior')).toBeInTheDocument()
    expect(screen.getAllByText('Sin registrar')).toHaveLength(2)
  })

  it('un error de una pestaña muestra el detail del servidor', async () => {
    vi.spyOn(handlers.administracion, 'rubricaAlumno').mockRejectedValue(
      errorHttp(403, { detail: 'El alumno no está en tu alcance.' }),
    )
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Rúbrica' }))
    expect(await screen.findByText('El alumno no está en tu alcance.')).toBeInTheDocument()
  })

  it('un alumno inexistente lo dice y ofrece volver a Alumnos', async () => {
    vi.spyOn(handlers.alumnos, 'detalle').mockRejectedValue(errorHttp(404, { detail: 'No existe' }))
    renderConProveedores(null, { ruta: '/estudiantes/9999', rol: ROLES.DOCENTE })
    expect(await screen.findByText('No se encontró al alumno', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a alumnos' })).toBeInTheDocument()
  })
})
