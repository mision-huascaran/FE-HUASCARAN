// CU022 (versión 2) — una clase NO tiene subprograma.
//
// Es colegio × año escolar × grado × sección × fecha efectiva, y reúne a los
// alumnos de Alfabetización y de Comprensión Lectora que estén en esa aula.
// Cada alumno tiene UN solo registro de asistencia por clase: estuvo o no
// estuvo, y eso no depende de qué está leyendo.
//
// De ahí la regla que esto protege: "cambiar el filtro conserva las
// asistencias ya registradas y no genera registros adicionales para un mismo
// alumno".
import { describe, expect, it } from 'vitest'
import { claveDeMarca } from '../../../hooks/useOfflineQueue'

describe('La clave de una marca de asistencia', () => {
  it('es la CLASE y el alumno, sin subprograma', () => {
    /**
     * Si el subprograma entrara en la clave, cambiar ese filtro generaría un
     * segundo envío para la misma persona y el mismo día, y el servidor
     * acabaría con dos asistencias contradictorias de un alumno que solo
     * estuvo una vez.
     */
    const enAlfabetizacion = claveDeMarca(7, '2026-10-05', 12)
    const enComprension = claveDeMarca(7, '2026-10-05', 12)
    expect(enAlfabetizacion).toBe(enComprension)
  })

  it('distingue aulas distintas el mismo día', () => {
    // Dos secciones del mismo grado son dos clases: son aulas distintas.
    expect(claveDeMarca(7, '2026-10-05', 12)).not.toBe(claveDeMarca(7, '2026-10-05', 13))
  })

  it('distingue días distintos de la misma aula', () => {
    expect(claveDeMarca(7, '2026-10-05', 12)).not.toBe(claveDeMarca(7, '2026-10-06', 12))
  })

  it('distingue alumnos', () => {
    expect(claveDeMarca(7, '2026-10-05', 12)).not.toBe(claveDeMarca(8, '2026-10-05', 12))
  })
})
