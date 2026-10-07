// Regresión del aviso "No tiene permisos" al iniciar sesión.
//
// Al cerrar sesión, `ProtectedRoute` guarda la ruta donde estaba el usuario
// anterior para volver a ella tras entrar. Si la siguiente persona entra con
// otro rol y se la devuelve a ciegas, `RoleRoute` la manda a /403 aunque sus
// credenciales sean correctas: era exactamente el error que se veía al pasar de
// Supervisor a Docente.
import { describe, expect, it } from 'vitest'
import { destinoTrasLogin, rolPuedeEntrar } from '../../rutas'
import { ROLES } from '../roles'

describe('rolPuedeEntrar', () => {
  it('reconoce las rutas de cada rol', () => {
    expect(rolPuedeEntrar('/dashboard', ROLES.SUPERVISOR)).toBe(true)
    expect(rolPuedeEntrar('/dashboard', ROLES.DOCENTE)).toBe(false)
    expect(rolPuedeEntrar('/inicio', ROLES.DOCENTE)).toBe(true)
    expect(rolPuedeEntrar('/dashboard', ROLES.DIRECTIVO)).toBe(true)
    // El Directivo ya no gestiona cuentas (D2 del sprint de cierre).
    expect(rolPuedeEntrar('/usuarios', ROLES.DIRECTIVO)).toBe(false)
  })

  it('resuelve rutas con parámetros y con query', () => {
    expect(rolPuedeEntrar('/estudiantes/12', ROLES.DOCENTE)).toBe(true)
    expect(rolPuedeEntrar('/reporte-semanal?colegio=3', ROLES.DOCENTE)).toBe(true)
    expect(rolPuedeEntrar('/reporte-semanal?colegio=3', ROLES.DIRECTIVO)).toBe(false)
  })

  it('no da por buena una ruta desconocida', () => {
    expect(rolPuedeEntrar('/ruta-que-no-existe', ROLES.SUPERVISOR)).toBe(false)
    expect(rolPuedeEntrar(undefined, ROLES.SUPERVISOR)).toBe(false)
  })
})

describe('destinoTrasLogin', () => {
  it('manda al inicio de su rol cuando la ruta anterior era de otro rol', () => {
    // Supervisor cierra sesión en /dashboard y entra un Docente.
    expect(destinoTrasLogin('/dashboard', ROLES.DOCENTE)).toBe('/inicio')
    // Docente cierra sesión en /rubrica y entra un Directivo.
    expect(destinoTrasLogin('/rubrica', ROLES.DIRECTIVO)).toBe('/inicio')
  })

  it('respeta la ruta pedida cuando el rol sí puede entrar', () => {
    expect(destinoTrasLogin('/estudiantes', ROLES.DOCENTE)).toBe('/estudiantes')
    expect(destinoTrasLogin('/consolidados', ROLES.SUPERVISOR)).toBe('/consolidados')
  })

  it('sin ruta previa los tres roles aterrizan en Inicio', () => {
    // La matriz del sprint da la sección Inicio a los tres, con contenido
    // distinto por rol; ya no hay una ruta de aterrizaje por cada uno.
    expect(destinoTrasLogin(undefined, ROLES.DOCENTE)).toBe('/inicio')
    expect(destinoTrasLogin(undefined, ROLES.SUPERVISOR)).toBe('/inicio')
    expect(destinoTrasLogin(undefined, ROLES.DIRECTIVO)).toBe('/inicio')
  })
})
