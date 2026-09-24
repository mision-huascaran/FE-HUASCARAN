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
    expect(rolPuedeEntrar('/panel-ejecutivo', ROLES.DIRECTIVO)).toBe(true)
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
    // Docente cierra sesión en /reporte-semanal y entra un Directivo.
    expect(destinoTrasLogin('/reporte-semanal', ROLES.DIRECTIVO)).toBe('/panel-ejecutivo')
  })

  it('respeta la ruta pedida cuando el rol sí puede entrar', () => {
    expect(destinoTrasLogin('/estudiantes', ROLES.DOCENTE)).toBe('/estudiantes')
    expect(destinoTrasLogin('/consolidados', ROLES.SUPERVISOR)).toBe('/consolidados')
  })

  it('sin ruta previa lleva al inicio de cada rol', () => {
    expect(destinoTrasLogin(undefined, ROLES.DOCENTE)).toBe('/inicio')
    expect(destinoTrasLogin(undefined, ROLES.SUPERVISOR)).toBe('/dashboard')
    expect(destinoTrasLogin(undefined, ROLES.DIRECTIVO)).toBe('/panel-ejecutivo')
  })
})
