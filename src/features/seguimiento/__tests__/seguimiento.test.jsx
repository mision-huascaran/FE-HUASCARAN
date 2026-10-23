// CU020 y CU021 — Seguimiento del equipo de docentes.
//
// Lo que se fija aquí son las reglas del caso de uso que es fácil romper sin
// darse cuenta: que el orden lo manda el servidor, que "nunca conectado" se
// diga con palabras, que los atajos abran lo que ESA JORNADA tocó -y no lo que
// pasó ese día-, y que sin conexión no se tire de la memoria local.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { QueryClient } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../../components/ui'
import SeguimientoPage from '../SeguimientoPage'

const ESPERA = { timeout: 8000 }

const listar = vi.fn()
const actividadesDe = vi.fn()

const registrosDe = vi.fn()

vi.mock('../../../api/resources/seguimiento', async (importOriginal) => ({
  ...(await importOriginal()),
  listarSeguimiento: (...a) => listar(...a),
  listarActividadesDe: (...a) => actividadesDe(...a),
  listarRegistrosDeActividad: (...a) => registrosDe(...a),
  obtenerDocenteSeguimiento: vi.fn(),
}))

vi.mock('../../../api/resources/administracion', async (importOriginal) => ({
  ...(await importOriginal()),
  listarColegiosAdmin: async () => ({ items: [{ id_colegio: 1, nombre: 'I.E. 86021 Ranrahirca' }] }),
}))

const FILA = {
  id_docente: 7,
  nombres: 'Rosa',
  apellidos: 'Camones',
  activo: true,
  colegios: [{ id: 1, nombre: 'I.E. 86021 Ranrahirca' }, { id: 2, nombre: 'I.E. 86024 Mancos' }],
  ultima_conexion: null,
  sincronizacion: 'pendiente',
  registros_pendientes: 3,
}

const pagina = (items) => ({ items, total: items.length, pagina: 1, paginas: 1, por_pagina: 10 })

function definirConexion(enLinea) {
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })
}

function montar({ sinReintentos = false } = {}) {
  // El cliente real reintenta 3 veces con espera creciente. Para el caso de
  // error eso haría que el test agotara su tiempo esperando reintentos.
  const cliente = sinReintentos
    ? new QueryClient({ defaultOptions: { queries: { retry: false } } })
    : crearQueryClient()

  // Con Router: el atajo "Ver Asistencias" navega a /asistencia con la fecha
  // de la jornada, así que la pantalla necesita contexto de rutas (CU021).
  return render(
    <QueryClientProvider client={cliente}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/seguimiento']}>
          <SeguimientoPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  definirConexion(true)
  listar.mockReset().mockResolvedValue(pagina([FILA]))
  actividadesDe.mockReset().mockResolvedValue(pagina([]))
  // Sin reiniciarlo, `mock.calls[0]` guardaba la llamada de la prueba
  // ANTERIOR y la asercion comprobaba el atajo equivocado.
  registrosDe.mockReset().mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 })
})

describe('Seguimiento de docentes (CU020)', () => {
  it('muestra las columnas del caso de uso y une los colegios con comas', async () => {
    montar()
    expect(await screen.findByText('Rosa Camones', {}, ESPERA)).toBeInTheDocument()
    expect(screen.getByText('I.E. 86021 Ranrahirca, I.E. 86024 Mancos')).toBeInTheDocument()
    // "Pendiente" sale también como opción del filtro: basta con que esté.
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0)
  })

  it('quien nunca entró lo dice con palabras, no con una celda vacía', async () => {
    // Y no "Nunca", que suena a dato comprobado: lo que consta es que no hay
    // registro de que haya iniciado sesión.
    montar()
    expect(await screen.findByText('Sin inicio de sesión registrado', {}, ESPERA)).toBeInTheDocument()
  })

  it('"sin información" no se pinta de verde, y un contador nulo no es cero', async () => {
    /**
     * El bug que esto cierra: el tono salía de `=== 'pendiente' ? warning :
     * success`, así que CUALQUIER otro valor era verde. Cuando el backend
     * añadió `error` y `sin_informacion`, ese atajo pasó de impreciso a falso:
     * un docente con un envío rechazado se veía en verde.
     *
     * Y `registros_pendientes` llega en `null` mientras el servidor no reciba
     * la cola offline. Un 0 ahí afirmaría que no hay nada pendiente, que es
     * justo lo que no se sabe.
     */
    listar.mockResolvedValue({
      items: [
        {
          id_docente: 9,
          nombres: 'Ana',
          apellidos: 'Quispe',
          colegios: [],
          ultima_conexion: null,
          sincronizacion: 'sin_informacion',
          registros_pendientes: null,
        },
      ],
      total: 1,
      page: 1,
      page_size: 40,
      total_pages: 1,
    })
    montar()

    // Dentro de la TABLA: "Sin información" también es una opción del filtro.
    const tabla = await screen.findByRole('table', {}, ESPERA)
    const etiqueta = await within(tabla).findByText('Sin información', {}, ESPERA)
    expect(etiqueta.className).not.toMatch(/success/)
    expect(within(tabla).getByText('No disponible')).toBeInTheDocument()
  })

  it('los filtros viajan al servidor al pulsar «Filtrar», no al elegirlos', async () => {
    montar()
    await screen.findByText('Rosa Camones', {}, ESPERA)
    listar.mockClear()

    // Elegir no consulta: con cuatro filtros serian cuatro peticiones y la
    // tabla parpadearia entre resultados intermedios.
    fireEvent.change(screen.getByLabelText('Sincronización'), { target: { value: 'pendiente' } })
    expect(listar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^filtrar$/i }))
    await waitFor(
      () => expect(listar).toHaveBeenCalledWith(expect.objectContaining({ sincronizacion: 'pendiente' })),
      ESPERA,
    )
  })

  it('sin conexión no consulta nada y lo explica', async () => {
    definirConexion(false)
    montar()

    expect(await screen.findByText(/no disponible sin conexión/i, {}, ESPERA)).toBeInTheDocument()
    expect(listar).not.toHaveBeenCalled()
  })

  it('avisa si el servidor falla, en vez de quedarse en blanco', async () => {
    listar.mockRejectedValue({ response: { status: 500, data: { detail: 'Se cayó' } } })
    montar({ sinReintentos: true })
    expect(await screen.findByText('No se pudo cargar el seguimiento', {}, ESPERA)).toBeInTheDocument()
  })
})

describe('Bitácora de un docente (CU021)', () => {
  async function abrirDetalle() {
    montar()
    fireEvent.click(await screen.findByRole('button', { name: /ver detalle/i }, ESPERA))
  }

  it('abre el detalle ocultando la grilla general', async () => {
    await abrirDetalle()
    expect(await screen.findByRole('button', { name: /volver al seguimiento/i }, ESPERA)).toBeInTheDocument()
    expect(screen.queryByLabelText('Sincronización')).not.toBeInTheDocument()
  })

  it('la cabecera lleva avatar de iniciales y las etiquetas del docente', async () => {
    await abrirDetalle()
    await screen.findByRole('button', { name: /volver al seguimiento/i }, ESPERA)
    expect(screen.getByText('RC')).toBeInTheDocument()
    expect(screen.getByText('I.E. 86024 Mancos')).toBeInTheDocument()
  })

  it('sin sesiones lo dice, en vez de una tabla vacía sin explicación', async () => {
    await abrirDetalle()
    expect(await screen.findByText('Sin sesiones registradas', {}, ESPERA)).toBeInTheDocument()
  })

  it('el atajo abre lo que esa jornada tocó, no lo que pasó ese día', async () => {
    /**
     * ANTES ESTE ATAJO NO LLEVABA A NINGUNA PARTE: tres estaban deshabilitados
     * porque sus módulos no existían, y "Ver Asistencias" navegaba al módulo
     * con la FECHA de la sesión. Eso casi funcionaba, pero mentía: dos
     * actividades del mismo día tocaron cosas distintas y el filtro por fecha
     * las mezclaba.
     *
     * El endpoint de la tanda 10 responde desde la AUDITORÍA de la actividad,
     * así que se le pasa SU id y no una fecha.
     */
    actividadesDe.mockResolvedValue(
      pagina([
        {
          id: 'a1',
          fecha: '2026-10-08',
          inicio: '2026-10-08T13:00:00Z',
          fin: '2026-10-08T18:00:00Z',
          tipo_cierre: 'manual',
          productividad: [
            { modulo: 'asistencia', cantidad: 15 },
            { modulo: 'alumnos', cantidad: 3 },
          ],
          productividad_texto: '15 Asistencias, 3 Alumnos',
        },
      ]),
    )
    registrosDe.mockResolvedValue({
      items: [
        {
          modulo: 'asistencias',
          id: 12,
          colegio: { id: 1, nombre: 'I.E. 86021 Ranrahirca' },
          grado: { id: 2, nombre: '2.°' },
          seccion: { id: 2, nombre: 'Única' },
          fecha: '2026-10-08',
          cambios: 15,
        },
      ],
      total: 1,
      pagina: 1,
      paginas: 1,
    })

    await abrirDetalle()

    const atajo = await screen.findByRole('button', { name: /ver asistencias/i }, ESPERA)
    expect(atajo).toBeEnabled()
    fireEvent.click(atajo)

    await waitFor(() => expect(registrosDe).toHaveBeenCalled(), ESPERA)
    const [idDocente, idActividad, opciones] = registrosDe.mock.calls[0]
    expect(idDocente).toBe(7)
    expect(idActividad).toBe('a1')
    expect(opciones.modulo).toBe('asistencias')

    const dialogo = await screen.findByRole('dialog', { name: /asistencias de esta jornada/i }, ESPERA)
    expect(within(dialogo).getByText('15')).toBeInTheDocument()
  })

  it('traduce el nombre del módulo al de la lista cerrada del endpoint', async () => {
    /**
     * La productividad dice `asistencia` y `alumnos`; el endpoint solo acepta
     * `asistencias | lectura | rubrica | registro_vuelo | alumnos`, y
     * cualquier otra cosa responde 422. Mandar el nombre tal cual habría
     * convertido el atajo en un error garantizado.
     */
    actividadesDe.mockResolvedValue(
      pagina([
        {
          id: 'a1',
          fecha: '2026-10-08',
          inicio: '2026-10-08T13:00:00Z',
          fin: null,
          tipo_cierre: null,
          productividad: [{ modulo: 'alumnos', cantidad: 3 }],
          productividad_texto: '3 Alumnos',
        },
      ]),
    )
    registrosDe.mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 })

    await abrirDetalle()
    fireEvent.click(await screen.findByRole('button', { name: /ver alumnos/i }, ESPERA))

    await waitFor(() => expect(registrosDe).toHaveBeenCalled(), ESPERA)
    expect(registrosDe.mock.calls[0][2].modulo).toBe('alumnos')
  })

  it('un módulo que el endpoint no acepta no ofrece atajo', async () => {
    // Un botón que solo puede dar un 422 es peor que no tener botón.
    actividadesDe.mockResolvedValue(
      pagina([
        {
          id: 'a1',
          fecha: '2026-10-08',
          inicio: '2026-10-08T13:00:00Z',
          fin: null,
          tipo_cierre: null,
          productividad: [{ modulo: 'nivel_final', cantidad: 2 }],
          productividad_texto: '2 Niveles finales',
        },
      ]),
    )

    await abrirDetalle()

    await screen.findByText('2 Niveles finales', {}, ESPERA)
    expect(screen.queryByRole('button', { name: /^ver /i })).not.toBeInTheDocument()
    // Una sesión en curso dice "No aplica" en fin Y en tipo de cierre: son dos.
    expect(screen.getAllByText('No aplica')).toHaveLength(2)
  })

  it('si la jornada no tocó nada de ese módulo, lo dice', async () => {
    actividadesDe.mockResolvedValue(
      pagina([
        {
          id: 'a1',
          fecha: '2026-10-08',
          inicio: '2026-10-08T13:00:00Z',
          fin: null,
          tipo_cierre: null,
          productividad: [{ modulo: 'rubrica', cantidad: 0 }],
          productividad_texto: 'Sin registros',
        },
      ]),
    )
    registrosDe.mockResolvedValue({ items: [], total: 0, pagina: 1, paginas: 1 })

    await abrirDetalle()
    fireEvent.click(await screen.findByRole('button', { name: /ver rúbrica/i }, ESPERA))

    expect(await screen.findByText(/nada de este módulo en esta jornada/i, {}, ESPERA)).toBeInTheDocument()
  })

  it('se puede volver a la grilla general', async () => {
    await abrirDetalle()
    fireEvent.click(await screen.findByRole('button', { name: /volver al seguimiento/i }, ESPERA))
    expect(await screen.findByText('Rosa Camones', {}, ESPERA)).toBeInTheDocument()
  })
})
