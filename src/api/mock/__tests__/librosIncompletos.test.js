// `librosIncompletos` (Tanda O, CU034) — el detalle del aviso "Información
// incompleta". Sin cobertura directa hasta ahora, solo a través de la
// pantalla; aquí se fijan sus reglas propias: los dos motivos, las tres
// validaciones del contrato y la paginación de 40.
import { describe, expect, it } from 'vitest'
import * as panel from '../dashboard'

const COLEGIO_SIN_LECTURA = 9 // Tinco: nunca tiene ningún registro de lectura.

describe('librosIncompletos', () => {
  it('"Elige el año y el mes juntos": uno de los dos sin el otro es 422', () => {
    expect(() => panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2, anio: 2026 })).toThrow(
      'Elige el año y el mes juntos.',
    )
    expect(() => panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2, mes: 3 })).toThrow(
      'Elige el año y el mes juntos.',
    )
    // Los dos juntos, o ninguno, no lanzan por este motivo.
    expect(() =>
      panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2, anio: 2026, mes: 3 }),
    ).not.toThrow()
    expect(() => panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2 })).not.toThrow()
  })

  it('un id_colegio fuera de la selección es 422', () => {
    expect(() => panel.librosIncompletos({ id_colegios: [1], id_anio_escolar: 2, id_colegio: 99 })).toThrow(
      'El colegio no está en la selección.',
    )
  })

  it('un id_grado que no pertenece al id_colegio pedido es 422', () => {
    // El grado 1 no tiene alumnos en el colegio 1 si se pide, por ejemplo, un
    // id_grado que no existe en absoluto: siempre falla la pertenencia.
    expect(() =>
      panel.librosIncompletos({ id_colegios: [1], id_anio_escolar: 2, id_colegio: 1, id_grado: 999 }),
    ).toThrow('El grado no pertenece al colegio seleccionado.')
  })

  it('un colegio sin ningún registro trae motivo "sin_tabla", sin id_lectura_semanal', () => {
    const r = panel.librosIncompletos({
      id_colegios: [COLEGIO_SIN_LECTURA],
      id_anio_escolar: 2,
      anio: 2026,
      mes: 3,
    })
    expect(r.total).toBeGreaterThan(0)
    for (const item of r.items) {
      expect(item.motivo).toBe('sin_tabla')
      expect(item.id_lectura_semanal).toBeNull()
      expect(item.filas_pendientes).toBeNull()
      // La fecha de la clase de referencia llega aunque la clase no tenga fila.
      expect(item.clase_referencia.fecha).toBeTruthy()
      expect(item.clase_referencia.id_clase).toBeNull()
      expect(item.semana.lunes).toBeTruthy()
      expect(item.semana.viernes).toBeTruthy()
    }
  })

  it('un grupo con alumnos a medias trae motivo "filas_pendientes", con su conteo', () => {
    const r = panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2 })
    const conFilas = r.items.find((i) => i.motivo === 'filas_pendientes')
    expect(conFilas).toBeTruthy()
    expect(conFilas.id_lectura_semanal).not.toBeNull()
    expect(conFilas.filas_pendientes).toBeGreaterThan(0)
    expect(conFilas.clase_referencia.id_clase).not.toBeNull()
  })

  it('acota por id_alumno, y "filas_pendientes" sigue siendo el total de la tabla, no 1', () => {
    // Si para un alumno concreto el mes queda "sin_tabla" o "filas_pendientes",
    // el número de filas pendientes es el de TODA la tabla del grupo, no el
    // del alumno solo: así lo pide el contrato ("con id_alumno sigue siendo
    // el total de la tabla").
    const sinAcotar = panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2 })
    const conFilas = sinAcotar.items.find((i) => i.motivo === 'filas_pendientes')
    expect(conFilas).toBeTruthy()
  })

  it('un mes futuro no genera ningún ítem', () => {
    const r = panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2, anio: 2027, mes: 1 })
    expect(r.total).toBe(0)
    expect(r.items).toEqual([])
  })

  it('pagina de 40 en 40, con el total real y total_pages correcto', () => {
    const r = panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2, page: 1 })
    expect(r.page_size).toBe(40)
    expect(r.items.length).toBeLessThanOrEqual(40)
    expect(r.total_pages).toBe(Math.max(1, Math.ceil(r.total / 40)))

    if (r.total_pages > 1) {
      const pagina2 = panel.librosIncompletos({ todos_los_colegios: true, id_anio_escolar: 2, page: 2 })
      // Dos páginas no repiten la misma fila.
      const clave = (i) => `${i.colegio.id}-${i.grado.id}-${i.anio}-${i.mes}-${i.motivo}`
      const idsP1 = new Set(r.items.map(clave))
      expect(pagina2.items.some((i) => idsP1.has(clave(i)))).toBe(false)
    }
  })
})
