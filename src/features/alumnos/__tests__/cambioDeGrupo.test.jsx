// CU014 / T3 — mover a un alumno de grupo exige decir desde cuándo.
//
// El grupo son cuatro campos: colegio, grado, sección y subprograma. Tocar
// cualquiera abre un intervalo nuevo en su historial de pertenencia, y de ese
// historial depende quién aparece en cada tabla histórica de Lectura, Rúbrica
// y Registro de Vuelo. Corregirle una tilde al apellido, en cambio, no cambia
// dónde estuvo: por eso la fecha se pide solo cuando hace falta.
import { describe, expect, it } from 'vitest'
import { cambiaDeGrupo } from '../../../api/resources/administracion'

const ALUMNO = { id_colegio: 1, id_grado: 3, id_seccion: 7, id_programa: 2 }

describe('¿La edición mueve al alumno de grupo?', () => {
  it('corregir el nombre no lo mueve', () => {
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, nombres: 'Ana María' })).toBe(false)
  })

  it('cambiar cualquiera de los cuatro campos del grupo sí', () => {
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, id_colegio: 2 })).toBe(true)
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, id_grado: 4 })).toBe(true)
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, id_seccion: 8 })).toBe(true)
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, id_programa: 1 })).toBe(true)
  })

  it('no confunde el número con su texto', () => {
    // El formulario devuelve cadenas donde el registro trae números: sin
    // normalizar, abrir el popup y no tocar nada ya pediría la fecha.
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, id_grado: '3' })).toBe(false)
  })

  it('un campo que el formulario todavía no tocó no cuenta', () => {
    // Al abrir, el popup puede no tener aún todos los valores cargados.
    expect(cambiaDeGrupo(ALUMNO, { id_grado: '3' })).toBe(false)
    expect(cambiaDeGrupo(ALUMNO, { ...ALUMNO, id_seccion: '' })).toBe(false)
  })

  it('sin registro previo no hay nada que comparar', () => {
    // Es un alta: ahí se pide `pertenece_desde`, no `cambio_grupo_desde`.
    expect(cambiaDeGrupo(null, ALUMNO)).toBe(false)
  })
})
