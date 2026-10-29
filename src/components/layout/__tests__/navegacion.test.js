// El menú lateral sale de una sola constante (§5). `ROLES` tiene alias que valen
// el mismo número (DIRECTIVOS y DIRECTIVO son 3), así que escribir dos bloques
// para el mismo rol hace que el segundo pise al primero sin ningún error: así
// desapareció "Cuentas" del menú del Directivo.
import { describe, expect, it } from 'vitest'
import { NAV_BY_ROLE, navegacionDe } from '../navegacion'
import { ROLES } from '../../../auth/roles'
import { ACCION, puede } from '../../../auth/permisos'
import { RUTAS_PROTEGIDAS } from '../../../rutas'

const ROLES_REALES = [ROLES.DOCENTE, ROLES.SUPERVISOR, ROLES.DIRECTIVO]

describe('NAV_BY_ROLE', () => {
  it('tiene exactamente un bloque por rol', () => {
    expect(Object.keys(NAV_BY_ROLE)).toHaveLength(ROLES_REALES.length)
  })

  it('cada rol tiene menú', () => {
    ROLES_REALES.forEach((idRol) => expect(navegacionDe(idRol).length).toBeGreaterThan(0))
  })

  it('el Directivo tiene Inicio y Dashboard (CU012 y CU035)', () => {
    /**
     * Sigue sin gestionar cuentas. Lo que cambió es el Dashboard: estaba
     * fuera porque el del mockup viejo llevaba un buscador de alumnos por
     * nombre y RN-033/RN-034 le prohíben ver datos de estudiantes. El de
     * CU035 no tiene ningún listado nominal —sus cinco endpoints con nombres
     * le responden 403— y el propio caso de uso dice que accede "desde el
     * sidebar".
     *
     * Que no vea nombres no se da por supuesto: lo comprueba
     * `features/__tests__/directivoSinNombres.test.jsx`, que recorre TODAS sus
     * rutas y busca en el documento el nombre y el código de cada alumno del
     * simulador.
     */
    expect(navegacionDe(ROLES.DIRECTIVO).map((i) => i.to)).toEqual(['/inicio', '/dashboard'])
  })

  it('el Supervisor también tiene los cuatro módulos académicos (CP-ROL-03, D49)', () => {
    /**
     * Antes no los tenía: se leyó CU022 como que su acceso era "derivado
     * desde el CU021" y se dejaron fuera del menú. Eso era D49.
     *
     * La matriz de permisos del backend y los casos de uso actualizados
     * coinciden en que el Supervisor CONSULTA los cuatro en solo lectura, y un
     * acceso que no está en el menú es un acceso que nadie encuentra.
     */
    const rutas = navegacionDe(ROLES.SUPERVISOR).map((i) => i.to)
    expect([...rutas].sort()).toEqual(
      [
        '/inicio',
        // CU033: el Supervisor accede al Dashboard desde el sidebar.
        '/dashboard',
        '/colegios',
        '/alumnos',
        '/usuarios',
        '/seguimiento',
        '/asistencia',
        '/seguimiento-lectura',
        '/rubrica',
        '/registro-vuelo',
      ].sort(),
    )
  })

  it('el Supervisor los consulta, pero no puede escribir en ellos', () => {
    // Entrar por el menú no le da permisos nuevos: sigue sin EDITAR, y el
    // servidor le responde 403 en cualquier escritura.
    for (const seccion of ['asistencia', 'lectura', 'rubrica', 'vuelo']) {
      expect(puede(seccion, ROLES.SUPERVISOR, ACCION.VER)).toBe(true)
      expect(puede(seccion, ROLES.SUPERVISOR, ACCION.EDITAR)).toBe(false)
    }
  })

  it('el Docente ve sus secciones, con Asistencia (CU022 paso 1)', () => {
    // Asistencia estaba fuera porque RF-046 no la listaba (D08). CU022 dice
    // literalmente que el Docente entra "desde el sidebar", y es posterior.
    const rutas = navegacionDe(ROLES.DOCENTE).map((i) => i.to)
    expect([...rutas].sort()).toEqual(
      ['/inicio', '/alumnos', '/asistencia', '/rubrica', '/seguimiento-lectura', '/registro-vuelo', '/sesiones'].sort(),
    )
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
