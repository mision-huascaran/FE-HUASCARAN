// Traducción entre el contrato del backend y la forma que usan las pantallas
// (resources/administracion.js), y los servicios de administración en modo mock.
import { describe, expect, it } from 'vitest'
import {
  actualizarColegio,
  activarUsuario,
  crearColegio,
  filtrarAlumnos,
  filtrarUsuariosPorColegio,
  listarAuditoria,
  listarGradosAdmin,
  listarProgramasAdmin,
  listarUbicaciones,
  normalizarAlumno,
  normalizarAsignacion,
  normalizarPaginado,
} from '../resources/administracion'

describe('normalizarPaginado', () => {
  it('un array suelto del mock se vuelve una sola página', () => {
    expect(normalizarPaginado([{ id: 1 }, { id: 2 }])).toEqual({ items: [{ id: 1 }, { id: 2 }], total: 2, pagina: 1, paginas: 1, por_pagina: 2 })
  })

  it('un array vacío conserva el tamaño de página pedido', () => {
    expect(normalizarPaginado([], 25).por_pagina).toBe(25)
  })

  it('traduce la envoltura del backend {page, page_size, total_pages}', () => {
    expect(normalizarPaginado({ items: [{ id: 1 }], total: 31, page: 2, page_size: 10, total_pages: 4 })).toEqual({
      items: [{ id: 1 }],
      total: 31,
      pagina: 2,
      paginas: 4,
      por_pagina: 10,
    })
  })

  it('sin total de páginas lo calcula, y con respuesta vacía no rompe', () => {
    expect(normalizarPaginado({ items: [], total: 21 }).paginas).toBe(3)
    expect(normalizarPaginado(null)).toEqual({ items: [], total: 0, pagina: 1, paginas: 1, por_pagina: 10 })
  })
})

describe('normalizarAlumno', () => {
  it('saca los ids de los objetos {id, nombre} del backend y deja texto en los campos de solo lectura', () => {
    const fila = normalizarAlumno({
      id: 7,
      nombres: 'Lucía',
      apellidos: 'Quispe Rojas',
      colegio: { id: 2, nombre: 'I.E. 86021' },
      grado: { id: 3, nombre: '3.°' },
      subprograma: { id: 1, nombre: 'Alfabetización' },
      seccion: { id: 1, nombre: 'A' },
      ciclo: { id: 2, nombre: 'IV' },
    })
    expect(fila).toMatchObject({ id_alumno: 7, id_colegio: 2, id_grado: 3, id_programa: 1, seccion: 'A', ciclo: 'IV', nombre: 'Quispe Rojas, Lucía', anonimo: false })
  })

  it('sin nombre dice quién es por su id en vez de salir en blanco', () => {
    expect(normalizarAlumno({ id_alumno: 9, colegio: null })).toMatchObject({ nombre: 'Estudiante n.º 9', anonimo: true, id_colegio: null })
  })

  it('respeta los ids sueltos del mock y el programa actual', () => {
    expect(normalizarAlumno({ id_alumno: 1, nombre: 'Ana', id_colegio: 4, id_grado: 1, id_programa_actual: 2 })).toMatchObject({ id_colegio: 4, id_programa: 2 })
  })
})

describe('filtrarAlumnos', () => {
  const FILAS = [
    { nombre: 'Ana Ríos', codigo: 'EST-1', id_colegio: 1, id_grado: 1, id_programa: 1, id_ciclo_nominal: 1, activo: true },
    { nombre: 'Beto Luna', codigo: 'EST-2', id_colegio: 2, id_grado: 4, id_programa: 2, ciclo: { nombre: 'IV' }, activo: true },
    { nombre: 'Carla Paz', codigo: 'EST-3', id_colegio: 2, id_grado: 5, id_programa: 2, ciclo: 'V', activo: false },
  ]
  const nombres = (filas) => filas.map((f) => f.nombre)

  it('sin filtros devuelve todos, activos e inactivos', () => {
    expect(nombres(filtrarAlumnos(FILAS))).toEqual(['Ana Ríos', 'Beto Luna', 'Carla Paz'])
  })

  it('filtra por colegio, grado y programa con los nombres de la pantalla o del backend', () => {
    expect(nombres(filtrarAlumnos(FILAS, { colegio: '2', grado: '4' }))).toEqual(['Beto Luna'])
    expect(nombres(filtrarAlumnos(FILAS, { id_colegio: 2, subprograma: 2, estado: 'activo' }))).toEqual(['Beto Luna'])
  })

  it('reconoce el ciclo por id, por objeto o por su etiqueta romana', () => {
    expect(nombres(filtrarAlumnos(FILAS, { ciclo: 1 }))).toEqual(['Ana Ríos'])
    expect(nombres(filtrarAlumnos(FILAS, { id_ciclo: '2' }))).toEqual(['Beto Luna'])
    expect(nombres(filtrarAlumnos(FILAS, { ciclo: 3 }))).toEqual(['Carla Paz'])
  })

  it('busca por nombre o código sin distinguir mayúsculas, y respeta el estado', () => {
    expect(nombres(filtrarAlumnos(FILAS, { q: ' est-3 ' }))).toEqual(['Carla Paz'])
    expect(nombres(filtrarAlumnos(FILAS, { estado: 'inactivo' }))).toEqual(['Carla Paz'])
  })
})

describe('filtrarUsuariosPorColegio', () => {
  const USUARIOS = [
    { nombre: 'Docente A', id_rol: 1, colegios_asignados: ['I.E. Tinco'] },
    { nombre: 'Docente B', id_rol: 1, colegios_asignados: ['I.E. Shilla'] },
    { nombre: 'Docente sin colegios', id_rol: 1 },
    { nombre: 'Supervisora', id_rol: 2, colegios_asignados: ['Global'] },
  ]

  it('sin colegio no filtra', () => {
    expect(filtrarUsuariosPorColegio(USUARIOS, '')).toBe(USUARIOS)
  })

  it('deja a los docentes de ese colegio y a los roles globales', () => {
    expect(filtrarUsuariosPorColegio(USUARIOS, 'I.E. Tinco').map((u) => u.nombre)).toEqual(['Docente A', 'Supervisora'])
  })
})

describe('normalizarAsignacion', () => {
  it('aplana la asignación anidada del backend', () => {
    const plana = normalizarAsignacion({
      colegio: { id: 7, nombre: 'I.E. Tinco' },
      grados: [{ id: 3, nombre: '3.°', cantidad_alumnos: 12 }, { grado: { id: 4, nombre: '4.°' } }],
    })
    expect(plana).toMatchObject({ id_colegio: 7, colegio: 'I.E. Tinco', grados: [3, 4] })
    expect(plana.detalle_grados).toEqual([
      expect.objectContaining({ id_grado: 3, cantidad_alumnos: 12 }),
      expect.objectContaining({ id_grado: 4, nombre: '4.°' }),
    ])
  })

  it('acepta la forma plana del mock y una asignación sin grados', () => {
    expect(normalizarAsignacion({ id_colegio: 1, colegio: 'I.E. Mancos', grados: [1, 2] })).toMatchObject({
      id_colegio: 1,
      colegio: 'I.E. Mancos',
      grados: [1, 2],
      detalle_grados: [{ id_grado: 1 }, { id_grado: 2 }],
    })
    expect(normalizarAsignacion({ colegio: null })).toMatchObject({ id_colegio: null, colegio: null, grados: [] })
  })
})

describe('Servicios de administración contra el mock', () => {
  it('los catálogos de grados y programas siempre traen su id con el nombre de la pantalla', async () => {
    expect((await listarGradosAdmin()).every((g) => g.id_grado != null)).toBe(true)
    expect((await listarProgramasAdmin()).every((p) => p.id_programa != null)).toBe(true)
  })

  it('ofrece departamentos y distritos para los filtros de colegios', async () => {
    const { departamentos, distritos } = await listarUbicaciones()
    expect(departamentos).toContain('Áncash')
    // Sin repetidos: cada valor sale una vez en el desplegable.
    expect(new Set(distritos).size).toBe(distritos.length)
  })

  it('crea y edita un colegio', async () => {
    const creado = await crearColegio({ nombre: 'I.E. Prueba de Calidad', zona: 'Carhuaz', departamento: 'Áncash', distrito: 'Carhuaz' })
    const editado = await actualizarColegio(creado.id_colegio, { distrito: 'Marcará' })
    expect(editado).toMatchObject({ id_colegio: creado.id_colegio, nombre: 'I.E. Prueba de Calidad', distrito: 'Marcará' })
  })

  it('la auditoría de colegios y usuarios se pide al mock; la del alumno usa su historial', async () => {
    const [delColegio] = await listarAuditoria('colegio', 1)
    const [delAlumno] = await listarAuditoria('alumno', 1)
    expect(delColegio.id_cambio).toMatch(/^colegio-1-/)
    expect(delAlumno.id_cambio).toMatch(/^alumno-1-/)
  })

  it('activar un usuario lo deja activo', async () => {
    expect(await activarUsuario(2)).toMatchObject({ id_usuario: 2, activo: true })
    await expect(activarUsuario(999)).rejects.toMatchObject({ response: { status: 404 } })
  })
})
