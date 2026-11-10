// CU028 — El filtro "Periodo académico" de Permisos de corrección depende del
// AÑO, no del colegio: un PA es "el PA n del año" para todos los colegios, así
// que con Colegio en "Todos" también se filtra por periodo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import PermisosDeCorreccion, { etiquetaDePeriodo } from '../PermisosDeCorreccion'
import handlers from '../../../api/mock/handlers'
import { ROLES } from '../../../auth/roles'
import { renderConProveedores } from '../../../test/renderConProveedores'

const DOCENTE = { id_usuario: 9, nombre: 'Rosa Quispe', activo: true }
const COLEGIOS = [{ id_colegio: 1, nombre: 'I.E. 86021 Ranrahirca' }]
const ESPERA = { timeout: 8000 }
const PRIMERO = 'Primer periodo'
const PERIODOS = [PRIMERO, 'Segundo periodo', 'Tercer periodo', 'Cuarto periodo']

const montar = () =>
  renderConProveedores(<PermisosDeCorreccion docente={DOCENTE} colegios={COLEGIOS} />, { rol: ROLES.SUPERVISOR })

const periodo = () => screen.getByLabelText('Periodo académico')
const anio = () => screen.getByLabelText('Año escolar')
const colegio = () => screen.getByLabelText('Colegio')
/** Las opciones que se pueden elegir, sin el «Todos». */
const opcionesDePeriodo = () =>
  within(periodo())
    .getAllByRole('option')
    .map((o) => o.textContent)
    .filter((t) => t !== 'Todos')

/** Espera a que el año vigente quede puesto y lleguen los cuatro PA. */
async function conPeriodosCargados() {
  await waitFor(() => expect(anio()).not.toHaveValue(''), ESPERA)
  await waitFor(() => expect(opcionesDePeriodo()).toHaveLength(4), ESPERA)
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('Periodo académico en Permisos de corrección', () => {
  it('con Colegio en "Todos" se habilita con los cuatro PA del año y filtra en todos los colegios', async () => {
    const listar = vi.spyOn(handlers.permisos, 'listar')
    montar()
    await conPeriodosCargados()

    expect(periodo()).toBeEnabled()
    expect(colegio()).toHaveValue('')
    expect(opcionesDePeriodo()).toEqual(PERIODOS)

    fireEvent.change(periodo(), { target: { value: '33' } })
    fireEvent.click(screen.getByRole('button', { name: /^filtrar$/i }))
    await waitFor(
      () => expect(listar).toHaveBeenLastCalledWith(9, expect.objectContaining({ id_periodo_academico: '33', id_colegio: '' })),
      ESPERA,
    )
  })

  it('con un colegio, cada PA lleva las fechas de su calendario', async () => {
    montar()
    await conPeriodosCargados()
    fireEvent.change(colegio(), { target: { value: '1' } })

    await waitFor(() => expect(opcionesDePeriodo()[0]).toBe('Primer periodo · 02/03–15/05'), ESPERA)
  })

  it('sin año escolar no hay periodos que ofrecer, y el elegido se limpia', async () => {
    montar()
    await conPeriodosCargados()
    fireEvent.change(periodo(), { target: { value: '33' } })

    fireEvent.change(anio(), { target: { value: '' } })
    expect(periodo()).toBeDisabled()
    expect(periodo()).toHaveDisplayValue('Primero selecciona un año escolar')

    fireEvent.change(anio(), { target: { value: '2' } })
    await waitFor(() => expect(periodo()).toBeEnabled(), ESPERA)
    expect(periodo()).toHaveValue('')
  })

  it('"Limpiar" deja la barra como al entrar: año vigente y periodo en "Todos"', async () => {
    montar()
    await conPeriodosCargados()
    const vigente = anio().value
    fireEvent.change(colegio(), { target: { value: '1' } })
    fireEvent.change(periodo(), { target: { value: '33' } })

    fireEvent.click(screen.getByRole('button', { name: /^limpiar$/i }))

    expect(anio()).toHaveValue(vigente)
    expect(colegio()).toHaveValue('')
    expect(periodo()).toBeEnabled()
    expect(periodo()).toHaveValue('')
  })
})

describe('etiquetaDePeriodo', () => {
  const PA1 = { nombre: PRIMERO, fecha_inicio: '2026-03-02', fecha_fin: '2026-05-15' }

  it('sin colegio, solo el nombre: las fechas cambian de un colegio a otro', () => {
    expect(etiquetaDePeriodo(PA1, false)).toBe(PRIMERO)
  })

  it('con colegio, el nombre y las fechas de su calendario', () => {
    expect(etiquetaDePeriodo(PA1, true)).toBe('Primer periodo · 02/03–15/05')
  })

  it('sin calendario configurado (fechas null), solo el nombre', () => {
    expect(etiquetaDePeriodo({ nombre: PRIMERO, fecha_inicio: null, fecha_fin: null }, true)).toBe(PRIMERO)
  })
})
