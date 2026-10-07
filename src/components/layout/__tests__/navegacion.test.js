// El menú lateral sale de una sola constante (§5). `ROLES` tiene alias que valen
// el mismo número (DIRECTIVOS y DIRECTIVO son 3), así que escribir dos bloques
// para el mismo rol hace que el segundo pise al primero sin ningún error: así
// desapareció "Cuentas" del menú del Directivo.
import { describe, expect, it } from 'vitest'
import { NAV_BY_ROLE, navegacionDe } from '../navegacion'
import { ROLES } from '../../../auth/roles'
import { RUTAS_PROTEGIDAS } from '../../../rutas'

const ROLES_REALES = [ROLES.DOCENTE, ROLES.SUPERVISOR, ROLES.DIRECTIVO]

describe('NAV_BY_ROLE', () => {
  it('tiene exactamente un bloque por rol', () => {
    expect(Object.keys(NAV_BY_ROLE)).toHaveLength(ROLES_REALES.length)
  })

  it('cada rol tiene menú', () => {
    ROLES_REALES.forEach((idRol) => expect(navegacionDe(idRol).length).toBeGreaterThan(0))
  })

  it('el Directivo solo tiene Inicio y Dashboard (D2)', () => {
    // Deja de gestionar cuentas: la matriz no le da ninguna otra sección.
    expect(navegacionDe(ROLES.DIRECTIVO).map((i) => i.to)).toEqual(['/inicio', '/dashboard'])
  })

  it('el Supervisor gestiona usuarios y colegios', () => {
    const rutas = navegacionDe(ROLES.SUPERVISOR).map((i) => i.to)
    expect(rutas).toContain('/usuarios')
    expect(rutas).toContain('/colegios')
    // D1: los alumnos van dentro de Usuarios, no como sección propia.
    expect(rutas).not.toContain('/alumnos')
  })

  it('el Docente tiene las tres grillas del aula y sus alumnos', () => {
    const rutas = navegacionDe(ROLES.DOCENTE).map((i) => i.to)
    expect(rutas).toEqual(expect.arrayContaining(['/alumnos', '/rubrica', '/seguimiento-lectura', '/registro-vuelo', '/sesiones']))
    expect(rutas).not.toContain('/usuarios')
  })

  it('ningún menú enlaza una ruta que su rol no pueda abrir (RNF-004)', () => {
    ROLES_REALES.forEach((idRol) => {
      navegacionDe(idRol).forEach((item) => {
        const ruta = RUTAS_PROTEGIDAS.find((r) => r.path === item.to)
        expect(ruta, `${item.to} no existe en las rutas`).toBeDefined()
        expect(ruta.allow, `${item.to} no admite al rol ${idRol}`).toContain(idRol)
      })
    })
  })
})
