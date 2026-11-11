// Seguimiento de Lectura: EL MES MANDA SOBRE LA SEMANA.
//
// Con una semana de noviembre elegida no se podía ir a octubre: la tabla se
// seguía pidiendo con esa semana, el servidor devolvía la de noviembre (la
// devuelve aunque el mes no coincida) y la pantalla devolvía el filtro a
// noviembre. Ahora cambiar de mes descarta la semana y elige una del mes nuevo,
// y una URL con un mes y una semana que no coinciden respeta el mes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import LecturaPage from '../LecturaPage'
import useSessionStore from '../../../store/sessionStore'
import useActividadStore from '../../../store/actividadStore'
import { ROLES } from '../../../auth/roles'

const ESPERA = { timeout: 8000 }
const RUTA = '/seguimiento-lectura'
const GRUPO = 'colegio=1&grado=2&seccion=2&subprograma=2'
const GUARDADO = `sicedu.filtros.grupo:${RUTA}`

const semana = (id, inicio, fin) => ({ id, id_semana: id, numero_semana: id, fecha_inicio: inicio, fecha_fin: fin })

/** Las semanas con clase del grupo, por mes, como `GET /semanas`. Hoy es el martes 10/11/2026. */
const SEMANAS = new Map([
  [9, [semana(37, '2026-09-07', '2026-09-11'), semana(38, '2026-09-14', '2026-09-18'), semana(40, '2026-09-28', '2026-10-02')]],
  [10, [semana(41, '2026-10-05', '2026-10-09'), semana(43, '2026-10-19', '2026-10-23'), semana(44, '2026-10-26', '2026-10-30')]],
  // La 47 todavía no empieza: "(próxima)", no se propone.
  [11, [semana(45, '2026-11-02', '2026-11-06'), semana(46, '2026-11-09', '2026-11-13'), semana(47, '2026-11-16', '2026-11-20')]],
])
const MES_DE_SEMANA = new Map([...SEMANAS].flatMap(([mes, lista]) => lista.map((s) => [String(s.id_semana), mes])))

vi.mock('idb-keyval', () => ({ get: vi.fn(async () => undefined), set: vi.fn(async () => {}), del: vi.fn(async () => {}) }))

/** Como el servidor: la tabla es la de la SEMANA pedida, con SU mes, mande el mes que mande. */
const obtenerTabla = vi.fn(async (filtros) => ({
  id: Number(filtros.idSemana),
  version: 1,
  estado: 'normal',
  motivo_no_realizada: null,
  mes: MES_DE_SEMANA.get(String(filtros.idSemana)),
  id_semana: Number(filtros.idSemana),
  clase_referencia: { id_clase: 1, fecha: '2026-10-01', tipo: 'habitual', reprogramada: false },
  filas: [],
  declaraciones: [],
  escritura: { permitida: true, motivo: null, id_permiso: null, aviso_permiso: null },
}))
vi.mock('../../../api/resources/lectura', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerTabla: (...a) => obtenerTabla(...a),
}))

vi.mock('../../../api/resources/catalogos', async (importOriginal) => ({
  ...(await importOriginal()),
  obtenerSemanas: vi.fn(async ({ mes }) => SEMANAS.get(Number(mes)) ?? []),
}))

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarMisAsignaciones: vi.fn(async () => [
    {
      id_colegio: 1,
      colegio: 'I.E. 1234',
      grados: [{ id_grado: 2, nombre: '2.° grado' }],
      detalle_grados: [{ id_grado: 2, subprogramas: ['Comprensión Lectora'] }],
    },
  ]),
  obtenerColegio: vi.fn(async () => ({
    id_colegio: 1,
    nombre: 'I.E. 1234',
    grados: [{ id_grado: 2, nombre: '2.° grado', secciones: [{ id: 2, nombre: 'Única' }] }],
    programas: [{ id_programa: 2, nombre: 'Comprensión Lectora' }],
  })),
  listarAniosEscolares: vi.fn(async () => [{ id: 2, nombre: '2026', vigente: true }]),
  anioVigente: (anios = []) => anios.find((a) => a.vigente) ?? anios[0] ?? null,
}))

/** `busqueda` vacía: se entra desde el menú, sin parámetros. */
function montar(busqueda = '') {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: ROLES.PROFESOR, id_docente: 1, nombres: 'Prueba' },
    cargando: false,
  })
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <MemoryRouter initialEntries={[busqueda ? `${RUTA}?${busqueda}` : RUTA]}>
          <LecturaPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const mes = () => screen.getByLabelText('Mes')
const semanaSelect = () => screen.getByLabelText('Semana')
/** Las semanas con las que se pidió la tabla. */
const semanasPedidas = () => obtenerTabla.mock.calls.map(([f]) => String(f.idSemana))
/** Lo que quedó guardado para volver al módulo (D105). */
const guardado = () => Object.fromEntries(new URLSearchParams(localStorage.getItem(GUARDADO) ?? ''))

/** Los filtros arrancan plegados en jsdom (RNF-002): hay que abrirlos. */
const abrirFiltros = () => fireEvent.click(screen.getByRole('button', { name: /filtros/i }))

async function conTablaDe(idSemana) {
  await waitFor(() => expect(semanasPedidas().at(-1)).toBe(String(idSemana)), ESPERA)
}

beforeEach(() => {
  // Solo el reloj de pared: hoy es el martes 10/11/2026 (semana 46).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-10T10:00:00-05:00') })
  localStorage.clear()
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  onlineManager.setOnline(true)
  obtenerTabla.mockClear()
  useActividadStore.getState().iniciar({ idDocente: 1 })
})

afterEach(() => {
  useActividadStore.getState().limpiar()
  vi.useRealTimers()
})

describe('Seguimiento de Lectura: el mes manda sobre la semana', () => {
  it('con una semana de noviembre elegida, elegir Octubre se queda en Octubre y carga su última semana', async () => {
    montar(`${GRUPO}&mes=11&semana=46`)
    await conTablaDe(46)
    abrirFiltros()

    fireEvent.change(mes(), { target: { value: '10' } })

    await conTablaDe(44)
    expect(mes()).toHaveValue('10')
    expect(semanaSelect()).toHaveValue('44')
    // Con el mes nuevo, la tabla solo se pidió con una semana de ese mes.
    expect(obtenerTabla.mock.calls.filter(([f]) => String(f.mes) === '10').map(([f]) => String(f.idSemana))).toEqual(['44'])
    expect(guardado()).toMatchObject({ mes: '10', semana: '44' })
  })

  it('la semana se reinicia a una del mes nuevo: Septiembre, y de vuelta al mes en curso, la de hoy', async () => {
    montar(`${GRUPO}&mes=10&semana=43`)
    await conTablaDe(43)
    abrirFiltros()

    fireEvent.change(mes(), { target: { value: '9' } })
    // La última ya empezada de septiembre, aunque termine en octubre.
    await conTablaDe(40)
    expect(mes()).toHaveValue('9')
    expect(guardado()).toMatchObject({ mes: '9', semana: '40' })

    fireEvent.change(mes(), { target: { value: '11' } })
    // El mes en curso propone la semana de HOY, no la próxima.
    await conTablaDe(46)
    expect(mes()).toHaveValue('11')
    expect(semanaSelect()).toHaveValue('46')
    expect(semanasPedidas()).not.toContain('47')
  })

  it('cambiar de semana no cambia el mes', async () => {
    montar(`${GRUPO}&mes=10&semana=44`)
    await conTablaDe(44)
    abrirFiltros()

    fireEvent.change(semanaSelect(), { target: { value: '41' } })

    await conTablaDe(41)
    expect(mes()).toHaveValue('10')
    expect(guardado()).toMatchObject({ mes: '10', semana: '41' })
  })

  it('una URL con una semana que no es del mes respeta el mes y recalcula la semana', async () => {
    montar(`${GRUPO}&mes=10&semana=46`)

    await conTablaDe(44)
    abrirFiltros()
    expect(mes()).toHaveValue('10')
    expect(semanaSelect()).toHaveValue('44')
    // La semana 46 (de noviembre) nunca llegó a pedirse.
    expect(semanasPedidas()).not.toContain('46')
    expect(guardado()).toMatchObject({ mes: '10', semana: '44' })
  })

  it('lo mismo al volver al módulo con una búsqueda guardada que no coincide', async () => {
    localStorage.setItem(GUARDADO, `${GRUPO}&mes=9&semana=45`)
    montar()

    await conTablaDe(40)
    abrirFiltros()
    expect(mes()).toHaveValue('9')
    expect(semanasPedidas()).not.toContain('45')
  })
})
