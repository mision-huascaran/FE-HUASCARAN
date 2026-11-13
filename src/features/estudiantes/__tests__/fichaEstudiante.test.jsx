// Detalle del alumno (CU015): cabecera y las CINCO pestañas con la forma
// nueva de los endpoints (P4 y P5): asistencia como objeto, nivel colocado del
// Registro de Vuelo, lectura por tabla semanal, rúbrica mensual, los 4 PA y el
// Historial de cambios, que es la única pestaña que exige conexión.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import handlers from '../../../api/mock/handlers'
import { ROLES } from '../../../auth/roles'
import { errorHttp } from '../../../test/fabricas'
import { clienteDePrueba, renderConProveedores } from '../../../test/renderConProveedores'
import { enlaceAlModulo } from '../FichaEstudiantePage'

const ID = 1

async function abrirFicha({ rol = ROLES.SUPERVISOR } = {}) {
  renderConProveedores(null, { ruta: `/estudiantes/${ID}`, rol })
  return screen.findByRole('heading', { level: 1 }, { timeout: 8000 })
}

const NIVEL = 'Nivel colocado'
const ASISTENCIA = 'Asistencia'

const tarjeta = (rotulo) => screen.getByText(rotulo).closest('.shadow-card')

/** `useConexion` lee `navigator.onLine`, y jsdom lo da como `true`. */
const conConexion = (enLinea) =>
  Object.defineProperty(window.navigator, 'onLine', { value: enLinea, configurable: true })

beforeEach(() => conConexion(true))

afterEach(() => {
  conConexion(true)
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

    /**
     * La tabla nombra los periodos, NO los codifica (CU015): "Primer
     * periodo", no "PA1". El código solo significa algo para quien construye
     * el sistema, y esta ficha la lee un Docente. En el eje de la gráfica el
     * "PA1" sí se queda: ahí no cabe el nombre largo.
     */
    const tabla = within(await screen.findByRole('table'))
    ;['Primer periodo', 'Segundo periodo', 'Tercer periodo', 'Cuarto periodo'].forEach((nombre) =>
      expect(tabla.getByText(nombre)).toBeInTheDocument(),
    )
    expect(tabla.queryByText('PA1')).not.toBeInTheDocument()
    expect(tabla.getByText('Pendiente del periodo anterior')).toBeInTheDocument()
    expect(tabla.getAllByText('Sin registrar')).toHaveLength(2)
  })

  it('la gráfica usa los CUATRO NIVELES DESCRIPTIVOS, no las letras', async () => {
    /**
     * Es lo que pide CU015 y es lo correcto: una "J" no significa lo mismo en
     * 3.º que en 5.º, así que una línea de letras compararía al alumno consigo
     * mismo en una escala que se mueve con el grado. El nivel descriptivo lo
     * calcula el servidor y llega en `nivel_programa`.
     */
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Registro de Vuelo' }))

    const grafica = await screen.findByRole('img', { name: /Evolución del nivel por periodo/ })
    const ejeY = within(grafica)
    ;['Inicio', 'En proceso', 'Logrado', 'Avanzado'].forEach((nivel) =>
      expect(ejeY.getByText(nivel)).toBeInTheDocument(),
    )
    // Y los periodos sin decisión se nombran, en vez de desaparecer sin más.
    expect(screen.getByText('Sin decisión en PA3, PA4.')).toBeInTheDocument()
  })

  it('sin ninguna decisión en el año, la gráfica OCULTA LOS EJES y lo explica', async () => {
    // Unos ejes vacíos se leen como un error de carga.
    vi.spyOn(handlers.administracion, 'registroVueloAlumno').mockResolvedValue(
      [1, 2, 3, 4].map((numero) => ({ numero, nivel_colocado: null, nivel_programa: null })),
    )
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Registro de Vuelo' }))

    expect(
      await screen.findByText('Aún no hay datos suficientes para graficar el progreso'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Evolución del nivel/ })).not.toBeInTheDocument()
  })

  /**
   * D64 — CP-ALU-08. Seleccionar una fila de las mini-grillas abre SU módulo
   * con el grupo del alumno filtrado.
   */
  it('una fila de Rúbrica abre el módulo de Rúbrica', async () => {
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Rúbrica' }))
    await userEvent.click((await screen.findByText('1.6')).closest('tr'))
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/rubrica')
  })

  it('el enlace lleva el grupo del alumno y lo propio de la fila', () => {
    const alumno = {
      colegio: { id: 1, nombre: 'AMASHCA' },
      grado: { id: 2, nombre: '2.º' },
      seccion: { id: 3, nombre: 'Única' },
      programa: { id: 2, nombre: 'Comprensión Lectora' },
    }
    expect(enlaceAlModulo('/seguimiento-lectura', alumno, { mes: 6 })).toBe(
      '/seguimiento-lectura?colegio=1&grado=2&seccion=3&subprograma=2&mes=6',
    )
    // El simulador manda ids sueltos.
    expect(enlaceAlModulo('/registro-vuelo', { id_colegio: 4, id_grado: 1 })).toBe('/registro-vuelo?colegio=4&grado=1')
  })

  it('las pestañas van en el orden de CU015, con Historial al final', async () => {
    /**
     * No es decoración: Registro de Vuelo va antes que las demás porque es de
     * donde sale el Nivel colocado que el Resumen enseña, y el Historial va al
     * final porque no es un reporte operativo.
     */
    await abrirFicha()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Resumen',
      'Registro de Vuelo',
      'Rúbrica',
      'Seguimiento de Lectura',
      'Historial',
    ])
  })

  it('el Historial lista los eventos con el formato de CU015', async () => {
    await abrirFicha()
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))

    // `accion` llega como CÓDIGO ("editar") y se traduce al verbo de CU014,
    // que no es "editó al alumno" sino "editó la información del alumno".
    expect(await screen.findByText(/editó la información del alumno/)).toBeInTheDocument()
    expect(screen.getByText(/Docente de Prueba/)).toBeInTheDocument()
    // El detalle visual de una edición: "Grado: 1.º → 2.º".
    expect(screen.getByText('Grado:')).toBeInTheDocument()
    expect(screen.getByText('2.º')).toBeInTheDocument()
  })

  it('SIN CONEXIÓN el Historial lo dice y NO pide nada al servidor', async () => {
    /**
     * CU015 prohíbe guardar la auditoría en IndexedDB para no llenar la memoria
     * del dispositivo, así que sin señal no hay nada que enseñar. Lo que no
     * puede pasar es que la pestaña intente la petición y falle: eso daría un
     * error de red donde corresponde una explicación.
     */
    const auditoria = vi.spyOn(handlers.administracion, 'auditoria')
    await abrirFicha()
    conConexion(false)
    await userEvent.click(screen.getByRole('tab', { name: 'Historial' }))

    expect(await screen.findByText('Contenido no disponible sin conexión')).toBeInTheDocument()
    expect(
      screen.getByText('Conéctate a internet para visualizar el historial de cambios.'),
    ).toBeInTheDocument()
    expect(auditoria).not.toHaveBeenCalled()

    // Y las demás pestañas siguen navegables: la ficha no se bloquea.
    await userEvent.click(screen.getByRole('tab', { name: 'Rúbrica' }))
    expect(await screen.findByText('Incompleta')).toBeInTheDocument()
  })

  /**
   * D61 — CP-ALU-06 en QA (ronda 9): sin conexión, la lista de Alumnos se veía
   * pero el detalle decía "No se encontró al alumno". Sin red `GET /alumnos/{id}`
   * queda en pausa, sin datos ni error; la ficha usa la fila guardada en el equipo.
   */
  it('sin conexión abre la ficha con la fila guardada en el equipo y lo avisa', async () => {
    const cliente = clienteDePrueba()
    cliente.setQueryData(['alumnos', 'mantenimiento', { estado: 'activo' }, true, false], [
      { id_alumno: ID, nombres: 'Rosa Elena', apellidos: 'Cárdenas Villanueva', nombre: 'Cárdenas Villanueva, Rosa Elena', grado: '3.º', activo: true },
    ])
    // Sin red, TanStack Query deja `GET /alumnos/{id}` en pausa: nunca contesta.
    vi.spyOn(handlers.alumnos, 'detalle').mockReturnValue(new Promise(() => {}))
    conConexion(false)

    renderConProveedores(null, { ruta: `/estudiantes/${ID}`, rol: ROLES.PROFESOR, cliente })

    expect(await screen.findByRole('heading', { level: 1 }, { timeout: 8000 })).toHaveTextContent('Rosa Elena Cárdenas Villanueva')
    expect(screen.queryByText('No se encontró al alumno')).not.toBeInTheDocument()
    expect(screen.getByText(/Sin conexión\. Se muestra la última información guardada/)).toBeInTheDocument()
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
