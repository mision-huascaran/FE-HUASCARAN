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
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ROLES } from '../../../auth/roles'
import { renderConProveedores } from '../../../test/renderConProveedores'
import { CAMBIOS_SIN_APLICAR } from '../estados'

const ESPERA = { timeout: 15000 }

const montar = (rol = ROLES.SUPERVISOR, ruta = '/dashboard') => renderConProveedores(null, { ruta, rol })

describe('Dashboard del Supervisor (CU033)', () => {
  it('carga sola con la selección inicial del servidor y pinta sus bloques', async () => {
    montar()

    // La carga inicial es automática porque `seleccion_inicial` llega completa
    // y válida: nadie tuvo que pulsar "Aplicar".
    expect(
      await screen.findByRole('heading', { name: 'Distribución de alumnos por subprograma' }, ESPERA),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resultados de aprendizaje' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comparación de resultados de aprendizaje' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Asistencia de Alumnos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evolución de la cobertura de Alumnos' })).toBeInTheDocument()

    // El periodo se nombra por su nombre visible, nunca "PA3".
    expect(screen.getAllByText(/Tercer periodo/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/\bPA3\b/)
  })

  it('tocar un filtro avisa "Cambios sin aplicar" y no cambia los resultados', async () => {
    montar()
    const antes = (await screen.findAllByText(/en todos los colegios/, {}, ESPERA)).length

    // Se desmarca "Todos los colegios": el borrador cambia, la consulta no.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Todos los colegios' }))

    expect(screen.getAllByText(CAMBIOS_SIN_APLICAR).length).toBeGreaterThan(0)
    // Los bloques siguen rotulados con el alcance de SU consulta.
    expect(screen.getAllByText(/en todos los colegios/).length).toBe(antes)
    // Y "Aplicar" queda deshabilitado: una selección vacía no es "todos".
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled()
  })

  it('un colegio sin información va aparte y no como 0 alumnos', async () => {
    montar()

    // El simulador deja a Yanama con el periodo sin iniciar.
    expect(await screen.findByText(/Todavía no empezaron el periodo seleccionado/, ESPERA)).toBeInTheDocument()
  })

  it('ofrece el acceso a CU034 con el año y los colegios de la consulta', async () => {
    montar()

    const enlace = await screen.findByRole('link', { name: /Ver consolidado de libros leídos/ }, ESPERA)
    // Lleva el año y "todos", y NO el periodo académico: el consolidado se
    // organiza por meses del año escolar.
    expect(enlace.getAttribute('href')).toContain('anio=2')
    expect(enlace.getAttribute('href')).toContain('todos=1')
    expect(enlace.getAttribute('href')).not.toMatch(/periodo/)
  })
})

describe('Detalle de asistencia por clase (CU033, paso 8)', () => {
  it('separa las clases sin registro y abre CU022 con su aula precargada', async () => {
    montar()

    const [primero] = await screen.findAllByRole('button', { name: /Ver grados y clases/ }, ESPERA)
    await userEvent.click(primero)

    // Las programadas sin ninguna asistencia van aparte: no son 0 % ni
    // ausencias, simplemente nadie las registró.
    expect(await screen.findByText(/Clases programadas sin registro/, ESPERA)).toBeInTheDocument()
    expect(screen.getByText(/No se consideran dictadas ni generan ausencias/)).toBeInTheDocument()

    // El enlace a CU022 lleva colegio, grado, sección y fecha: sin eso, el
    // Supervisor aterrizaría en el aula que miró la última vez.
    const href = screen.getAllByRole('link', { name: 'Ver asistencia' })[0].getAttribute('href')
    expect(href).toMatch(/colegio=\d+/)
    expect(href).toMatch(/grado=\d+/)
    expect(href).toMatch(/seccion=\d+/)
    expect(href).toMatch(/fecha=\d{4}-\d{2}-\d{2}/)
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
})

describe('Dashboard del Directivo (CU035)', () => {
  it('ve su resumen anual y la comparación, sin los bloques nominales', async () => {
    montar(ROLES.DIRECTIVO)

    expect(await screen.findByRole('heading', { name: /Resumen anual de Primaria/ }, ESPERA)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comparación entre colegios' })).toBeInTheDocument()

    // Los tres bloques del Supervisor NO están: sus endpoints le dan 403.
    expect(screen.queryByRole('heading', { name: 'Distribución de alumnos por subprograma' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Comparación de resultados de aprendizaje' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ver consolidado de libros leídos/ })).not.toBeInTheDocument()
  })

  it('no le ofrece el detalle por clase, que es nominal', async () => {
    montar(ROLES.DIRECTIVO)

    const asistencia = (await screen.findByRole('heading', { name: 'Asistencia de Alumnos' }, ESPERA)).closest(
      'section',
    )
    expect(within(asistencia).queryByRole('button', { name: /Ver grados y clases/ })).not.toBeInTheDocument()
  })
})
