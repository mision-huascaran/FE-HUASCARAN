// Ficha del estudiante (P11): datos académicos, variación entre cortes,
// gráficos y exportación según el rol. Cubre RF-011, RN-004, RN-012 y RN-019.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { renderConProveedores } from '../../../test/renderConProveedores'

const ID = 1

async function abrirFicha({ rol = ROLES.SUPERVISOR, alumno, historial } = {}) {
  if (alumno) {
    const original = await handlers.alumnos.detalle(ID)
    vi.spyOn(handlers.alumnos, 'detalle').mockResolvedValue({ ...original, ...alumno })
  }
  if (historial) vi.spyOn(handlers.alumnos, 'historial').mockResolvedValue(historial)
  renderConProveedores(null, { ruta: `/estudiantes/${ID}`, rol })
  return screen.findByRole('heading', { level: 1 }, { timeout: 8000 })
}

/** La tarjeta de indicador completa (valor y detalle), buscándola por su rótulo. */
const tarjeta = (rotulo) => screen.getByText(rotulo).closest('.shadow-card')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Ficha del estudiante', () => {
  it('muestra nombre, código y datos académicos, y los dos gráficos con datos', async () => {
    const titulo = await abrirFicha()
    const original = await handlers.alumnos.detalle(ID)
    expect(titulo).toHaveTextContent(original.nombre)
    expect(screen.getByText(new RegExp(original.codigo))).toBeInTheDocument()
    // Con historial real no aparece ningún estado vacío de los gráficos.
    expect(await screen.findByText('Evolución entre evaluaciones diagnósticas')).toBeInTheDocument()
    expect(screen.queryByText('Sin evaluaciones registradas')).not.toBeInTheDocument()
  })

  it('un estudiante inexistente o fuera de su alcance lo dice y ofrece volver', async () => {
    vi.spyOn(handlers.alumnos, 'detalle').mockRejectedValue(errorHttp(404, { detail: 'No existe' }))
    renderConProveedores(null, { ruta: '/estudiantes/9999', rol: ROLES.DOCENTE })
    expect(await screen.findByText('No se encontró al estudiante', {}, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a estudiantes' })).toBeInTheDocument()
  })

  it.each([
    [{ orden_anterior: 3, orden_actual: 5, anterior: 'C', actual: 'E' }, '+2', 'C → E'],
    [{ orden_anterior: 5, orden_actual: 4, anterior: 'E', actual: 'D' }, '-1', 'E → D'],
    [{ orden_anterior: 4, orden_actual: 4, anterior: 'D', actual: null }, '0', 'D → —'],
    [{ orden_anterior: null, orden_actual: 4 }, '—', 'Sin periodo anterior'],
  ])('variación %o → "%s" (%s)', async (variacion, valor, detalle) => {
    await abrirFicha({ alumno: { variacion } })
    const indicador = tarjeta('Variación')
    expect(within(indicador).getByText(valor)).toBeInTheDocument()
    expect(within(indicador).getByText(detalle)).toBeInTheDocument()
  })

  it('sin datos del mes muestra ceros y 0 % en vez de NaN', async () => {
    await abrirFicha({ alumno: { mes_actual: null, aula: null, nivel_actual: null } })
    expect(within(tarjeta('Asistencia del mes')).getByText('0%')).toBeInTheDocument()
    expect(within(tarjeta('Libros del mes')).getByText('0 de subir de nivel · 0 de sala de lectura')).toBeInTheDocument()
    expect(screen.queryByText(/^Aula /)).not.toBeInTheDocument()
  })

  it('sin historial, los dos gráficos muestran su estado vacío', async () => {
    await abrirFicha({ historial: { evolucion: [], rubrica_mensual: [], libros: [], evaluaciones: [] } })
    expect(await screen.findByText('Sin evaluaciones registradas')).toBeInTheDocument()
    expect(await screen.findByText('Sin rúbricas este mes')).toBeInTheDocument()
  })

  it('la Supervisora puede exportar la ficha a PDF', async () => {
    window.print = vi.fn()
    await abrirFicha({ rol: ROLES.SUPERVISOR })
    await userEvent.click(screen.getByRole('button', { name: 'Exportar ficha' }))
    expect(window.print).toHaveBeenCalled()
  })

  it('el Docente no ve la exportación', async () => {
    await abrirFicha({ rol: ROLES.DOCENTE })
    expect(screen.queryByRole('button', { name: 'Exportar ficha' })).not.toBeInTheDocument()
  })
})
