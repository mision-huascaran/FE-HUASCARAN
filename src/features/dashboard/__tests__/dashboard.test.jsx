// El Dashboard de punta a punta contra el simulador (CU033, CU034 y CU035).
//
// Lo que estas pruebas sujetan es justo lo que se rompe al "mejorar" la
// pantalla: que la carga inicial ocurra sola con los filtros del servidor, que
// tocar un filtro NO recargue los resultados sino que avise, que cada rol vea
// sus bloques y nada más, y que un hueco de información no se pinte como cero.
//
// SE ESPERA AL CONTENIDO, NO A `isFetching() === 0`. Las consultas de los
// bloques arrancan cuando los filtros se aplican, que es después del primer
// render, así que un contador de peticiones en cero puede significar "todavía
// no han empezado". Con `findBy*` la espera es por lo que se quiere ver, y la
// prueba no depende de la carga de la máquina.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ROLES } from '../../../auth/roles'
import { renderConProveedores } from '../../../test/renderConProveedores'
import { CAMBIOS_SIN_APLICAR } from '../estados'
import DashboardPage from '../DashboardPage'
import LibrosPage from '../LibrosPage'

const ESPERA = { timeout: 15000 }
/** Los títulos de las cuatro tarjetas son los del menú, y en su orden. */
const MODULOS = ['Asistencias', 'Seguimiento de Lectura', 'Rúbrica', 'Registro de Vuelo']
const ASISTENCIA = 'Asistencias'

const montar = (rol = ROLES.SUPERVISOR, ruta = '/dashboard') => renderConProveedores(null, { ruta, rol })

describe('Dashboard del Supervisor', () => {
  it('carga sola con la selección inicial del servidor y pinta una tarjeta por módulo', async () => {
    montar()

    // La carga inicial es automática porque `seleccion_inicial` llega completa
    // y válida: nadie tuvo que pulsar "Aplicar".
    expect(await screen.findByRole('heading', { name: MODULOS[0] }, ESPERA)).toBeInTheDocument()
    MODULOS.slice(1).forEach((modulo) =>
      expect(screen.getByRole('heading', { name: modulo })).toBeInTheDocument(),
    )

    // El periodo se nombra por su nombre visible, nunca "PA3".
    expect(screen.getAllByText(/Tercer periodo/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/PA3/)
  })

  /**
   * LO QUE EL DASHBOARD VIEJO NO HACÍA: llevar al módulo.
   *
   * Se miraban nueve bloques de indicadores y para actuar sobre lo que
   * mostraban había que ir al menú, entrar al módulo y volver a montar los
   * filtros a mano.
   */
  it('cada tarjeta lleva a su módulo, con el colegio de la consulta', async () => {
    montar()
    await screen.findByRole('heading', { name: MODULOS[0] }, ESPERA)

    const destinos = {
      'Ver en Asistencias': '/asistencia',
      'Ver en Seguimiento de Lectura': '/seguimiento-lectura',
      'Ver en Rúbrica': '/rubrica',
      'Ver en Registro de Vuelo': '/registro-vuelo',
    }
    Object.entries(destinos).forEach(([texto, ruta]) =>
      expect(screen.getByRole('link', { name: texto })).toHaveAttribute('href', ruta),
    )
  })

  it('tocar un filtro avisa "Cambios sin aplicar" y no cambia los resultados', async () => {
    montar()
    // Se cuenta con TODAS las tarjetas cargadas: el contexto de cada gráfica
    // lleva el alcance y aparece cuando llegan sus datos.
    await screen.findAllByText(/en todos los colegios/, {}, ESPERA)
    await waitFor(() => expect(document.querySelectorAll('.animate-pulse')).toHaveLength(0), ESPERA)
    const antes = screen.getAllByText(/en todos los colegios/).length

    // "Colegios" es un desplegable: hay que abrirlo antes de desmarcar.
    await userEvent.click(screen.getByRole('button', { name: /Colegios Todos los colegios/ }))
    // Se desmarca "Todos los colegios": el borrador cambia, la consulta no.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Todos los colegios' }))

    expect(screen.getAllByText(CAMBIOS_SIN_APLICAR).length).toBeGreaterThan(0)
    // Las tarjetas siguen rotuladas con el alcance de SU consulta.
    expect(screen.getAllByText(/en todos los colegios/).length).toBe(antes)
    // Y "Aplicar" queda deshabilitado: una selección vacía no es "todos".
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
  })

  it('un colegio sin información va aparte y no como 0 alumnos', async () => {
    montar()

    // El simulador deja a Yanama con el periodo sin iniciar.
    expect(await screen.findByText(/Todavía no empezaron el periodo seleccionado/, ESPERA)).toBeInTheDocument()
  })

  it('el consolidado de libros hereda el año y los colegios de la consulta', async () => {
    montar()

    const enlace = await screen.findByRole('link', { name: 'Consolidado por meses' }, ESPERA)
    // Lleva el año y "todos", y NO el periodo académico: el consolidado se
    // organiza por meses del año escolar.
    expect(enlace.getAttribute('href')).toContain('anio=2')
    expect(enlace.getAttribute('href')).toContain('todos=1')
    expect(enlace.getAttribute('href')).not.toMatch(/periodo/)
  })
})

describe('Consolidado de libros leídos (CU034)', () => {
  const RUTA = '/dashboard/libros?anio=2&todos=1'

  it('hereda los filtros de CU033 por la URL y carga sin pedir periodo', async () => {
    montar(ROLES.SUPERVISOR, RUTA)

    expect(
      await screen.findByRole('heading', { name: /Consolidado de libros leídos en todos los colegios/ }, ESPERA),
    ).toBeInTheDocument()
    // Su barra de filtros no tiene periodo académico.
    expect(screen.queryByLabelText(/Periodo académico/)).not.toBeInTheDocument()
  })

  it('un colegio sin registros queda sin promedio y sin posición, no en cero', async () => {
    montar(ROLES.SUPERVISOR, RUTA)

    // Tinco no tiene ningún registro de lectura en el simulador.
    const aviso = await screen.findByText(/sin posición/, ESPERA)
    expect(aviso.textContent).toMatch(/Tinco/)
    expect(aviso.textContent).toMatch(/no es lo mismo que tener cero libros/)
  })

  it('del colegio baja a los grados y de una cantidad al desglose', async () => {
    montar(ROLES.SUPERVISOR, RUTA)

    const [primero] = await screen.findAllByRole('button', { name: /Ver grados/ }, ESPERA)
    await userEvent.click(primero)

    /**
     * Los grados llegan plegados y se abren de uno en uno. Se buscan DENTRO
     * del detalle: el menú de la barra lateral también es un `aria-expanded`,
     * y fuera del `within` se abriría ese.
     */
    const detalle = (await screen.findByRole('heading', { name: /Libros leídos en/ }, ESPERA)).closest('section')
    const [grado] = await within(detalle).findAllByRole('button', { expanded: false }, ESPERA)
    await userEvent.click(grado)
    expect(await screen.findByText('Nombres y apellidos', ESPERA)).toBeInTheDocument()
    expect(screen.getByText('Total por alumno')).toBeInTheDocument()

    // Una cantidad mensual se abre y enseña de qué registros sale.
    const [celda] = screen.getAllByRole('button').filter((b) => /^\d+$/.test(b.textContent ?? ''))
    await userEvent.click(celda)
    expect(await screen.findByText('Clase de referencia', ESPERA)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Ver registro' }).length).toBeGreaterThan(0)
  })

  it('el filtro por grado del detalle nombra el grado y el colegio en la tarjeta y el gráfico', async () => {
    montar(ROLES.SUPERVISOR, RUTA)

    const [primero] = await screen.findAllByRole('button', { name: /Ver grados/ }, ESPERA)
    await userEvent.click(primero)
    const titulo = await screen.findByRole('heading', { name: /Libros leídos en/ }, ESPERA)
    const colegio = titulo.textContent.replace('Libros leídos en ', '')

    // El título del bloque aparece antes que los datos: se espera al selector.
    const selector = await screen.findByRole('combobox', { name: 'Grado' }, ESPERA)
    expect(within(selector).getByRole('option', { name: 'Todos los grados' })).toBeInTheDocument()
    await userEvent.selectOptions(selector, '3')

    const enElGrado = `3.° de ${colegio}`
    const tarjeta = screen.getByText((texto) => texto.endsWith(` en ${enElGrado}`) && texto.startsWith('Total'))
    expect(tarjeta).toBeInTheDocument()
    expect(screen.getAllByText(`Libros leídos por mes en ${enElGrado}`).length).toBeGreaterThan(0)
    // Solo queda el grupo del grado elegido.
    const detalle = titulo.closest('section')
    expect(within(detalle).getAllByRole('button', { expanded: false })).toHaveLength(1)

    await userEvent.selectOptions(selector, '')
    expect(screen.getAllByText(`Libros leídos por mes en ${colegio}`).length).toBeGreaterThan(0)
  })
})

/**
 * El detalle de "Información incompleta" (Tanda O, CU034) — antes el aviso
 * era una palabra sin salida: decía que algo faltaba, no QUÉ ni DÓNDE.
 *
 * Se entra por el detalle de un colegio, no por la tabla consolidada: ahí la
 * "—" es por ALUMNO (`libroDeAlumno`), así que un mes YA PASADO sin registro
 * aparece con certeza. En la tabla consolidada la "—" es por COLEGIO ENTERO
 * —todos sus alumnos sin dato el mismo mes—, algo que con decenas de alumnos
 * por colegio el simulador casi nunca produce fuera de los meses futuros.
 */
describe('El detalle de "Información incompleta" del consolidado de libros (Tanda O)', () => {
  const RUTA = '/dashboard/libros?anio=2&todos=1'

  it('una celda "—" de un alumno abre el detalle acotado, y "Volver" regresa al colegio', async () => {
    montar(ROLES.SUPERVISOR, RUTA)

    const [verGrados] = await screen.findAllByRole('button', { name: /Ver grados/ }, ESPERA)
    await userEvent.click(verGrados)
    const detalle = (await screen.findByRole('heading', { name: /Libros leídos en/ }, ESPERA)).closest('section')
    const [grado] = await within(detalle).findAllByRole('button', { expanded: false }, ESPERA)
    await userEvent.click(grado)
    await screen.findByText('Nombres y apellidos', {}, ESPERA)

    // El accesible de un botón es su texto visible ("—"); el motivo largo va
    // en `title`, así que se busca por ese atributo y no por el nombre.
    const celdas = screen.getAllByTitle('Sin información — ver qué falta')
    expect(celdas.length).toBeGreaterThan(0)
    await userEvent.click(celdas[0])

    expect(
      await screen.findByRole('heading', { name: 'Información incompleta del consolidado de libros' }, ESPERA),
    ).toBeInTheDocument()
    // La tabla depende de la consulta, que llega DESPUÉS del encabezado: se
    // espera a su contenido, no se comprueba en frío justo tras el título.
    expect(await screen.findAllByText('Sin tabla', {}, ESPERA)).not.toHaveLength(0)
    expect(screen.getByRole('columnheader', { name: 'Semana' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Qué falta' })).toBeInTheDocument()

    // Vuelve al DETALLE DEL COLEGIO del que salió, no al consolidado entero.
    await userEvent.click(screen.getByRole('button', { name: 'Volver al consolidado' }))
    expect(await screen.findByRole('heading', { name: /Libros leídos en/ }, ESPERA)).toBeInTheDocument()
  })
})

describe('Dashboard del Directivo', () => {
  it('ve las MISMAS cuatro tarjetas, con los mismos títulos', async () => {
    montar(ROLES.DIRECTIVO)

    expect(await screen.findByRole('heading', { name: MODULOS[0] }, ESPERA)).toBeInTheDocument()
    MODULOS.slice(1).forEach((modulo) =>
      expect(screen.getByRole('heading', { name: modulo })).toBeInTheDocument(),
    )
  })

  /**
   * Las tarjetas informan, pero no le abren puerta: los cuatro módulos son
   * `[DIRECTIVO]: null` en la matriz de permisos, y el consolidado de libros
   * es nominal. Ofrecerle el enlace sería mandarlo a su propia guarda.
   */
  it('no le ofrece entrar a los módulos ni al consolidado nominal', async () => {
    montar(ROLES.DIRECTIVO)
    await screen.findByRole('heading', { name: MODULOS[0] }, ESPERA)

    expect(screen.queryByRole('link', { name: /^Ver en / })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Consolidado por meses' })).not.toBeInTheDocument()
  })
})

/**
 * CU033, CU034 y CU035 — el rol dejó de permitir la consulta.
 *
 * La ruta ya impide ENTRAR; esto cubre el caso que describen los CU: estar
 * dentro y perder el rol. No basta con dejar de pedir datos —hay que retirar
 * lo que ya se ve—, porque si no quedan en pantalla indicadores de un alcance
 * que el usuario ya no tiene.
 */
describe('El rol dejó de permitir la consulta', () => {
  /*
   * Se monta la PANTALLA, no la ruta: por la ruta no se llega: la guarda del
   * enrutador redirige antes y el mensaje no se vería nunca. Lo que se
   * comprueba aquí es la red de seguridad de la propia pantalla, para el caso
   * en que el rol cambie con ella ya montada.
   */
  it('el Docente no ve el dashboard, y se le dice por qué', async () => {
    renderConProveedores(<DashboardPage />, { rol: ROLES.DOCENTE })

    expect(
      await screen.findByText('Tu rol actual no permite consultar este dashboard.', {}, ESPERA),
    ).toBeInTheDocument()
    // Y no queda ningún bloque de indicadores colgando.
    expect(screen.queryByText(ASISTENCIA)).not.toBeInTheDocument()
  })

  it('el consolidado de libros es solo del Supervisor', async () => {
    renderConProveedores(<LibrosPage />, { rol: ROLES.DIRECTIVO })

    expect(
      await screen.findByText('Tu rol actual no permite consultar este consolidado.', {}, ESPERA),
    ).toBeInTheDocument()
  })
})
