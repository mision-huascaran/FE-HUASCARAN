// D69 — Una operación rechazada sigue en "Error" después de recargar (CP-PER-10).
//
// La operación ya salió de la cola cuando el servidor la rechazó: si el rechazo
// vivía solo en memoria, recargar la página lo borraba y el docente dejaba de
// ver que su dato no subió.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rechazo = {
  clave: 'asistencia:12-2026-10-28-4',
  modulo: 'asistencias',
  nombre: 'Ana Torres',
  idOperacion: 'op-1',
  motivo: 'actividad_requerida',
  detail: 'Debes iniciar una actividad de trabajo para registrar o modificar información.',
  registro: null,
}

/** Un almacén recién cargado, como tras un F5. */
async function recargar() {
  vi.resetModules()
  return (await import('../rechazosStore')).default
}

beforeEach(() => localStorage.clear())

describe('Rechazos tras recargar (D69)', () => {
  it('un rechazo anotado sigue ahí después de recargar', async () => {
    const antes = await recargar()
    antes.getState().agregar(rechazo)

    const despues = await recargar()
    expect(despues.getState().rechazos).toEqual([rechazo])
  })

  it('descartarlo también sobrevive a la recarga', async () => {
    const antes = await recargar()
    antes.getState().agregar(rechazo)
    antes.getState().quitar(rechazo.clave)

    const despues = await recargar()
    expect(despues.getState().rechazos).toEqual([])
  })

  it('el cierre de sesión no los deja para la siguiente persona', async () => {
    const antes = await recargar()
    antes.getState().agregar(rechazo)
    antes.getState().limpiar()

    expect(localStorage.getItem('sicedu.rechazos')).toBeNull()
  })
})
