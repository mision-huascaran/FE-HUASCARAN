// RNF-004 / RN-033 / CU012: el Directivo solo ve métricas agregadas y NUNCA
// nombres de alumnos. La defensa más fuerte es que no entre a los módulos que
// los muestran: el Dashboard tenía un buscador "Estudiante (nombre o código)".
//
// Se recorre cada ruta a la que entra el Directivo con los datos del mock, se
// espera a que terminen TODAS sus consultas y se busca en el documento el
// nombre y el código de cada alumno.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { RUTAS_PROTEGIDAS } from '../../rutas'
import { ALUMNOS } from '../../api/mock/db'
import { ROLES } from '../../auth/roles'
import { MATRIZ } from '../../auth/permisos'
import { renderConProveedores } from '../../test/renderConProveedores'

const RUTAS_DEL_DIRECTIVO = RUTAS_PROTEGIDAS.filter((r) => r.allow.includes(ROLES.DIRECTIVO)).map((r) =>
  r.path.replace(':id', '1'),
)

/** Las dos formas en que una pantalla podría pintar a un alumno, y su código. */
const RASTROS_DE_ALUMNOS = ALUMNOS.flatMap((a) => [`${a.nombres} ${a.apellidos}`, `${a.apellidos}, ${a.nombres}`, a.codigo])

const rastrosEn = (texto) => RASTROS_DE_ALUMNOS.filter((rastro) => texto.includes(rastro))

async function montarYEsperar(ruta, rol = ROLES.DIRECTIVO) {
  const { cliente } = renderConProveedores(null, { ruta, rol })
  await waitFor(() => expect(screen.getByLabelText('ruta actual')).toHaveTextContent(ruta))
  // Espera a que no quede ninguna consulta en vuelo: lo que se vaya a pintar ya está.
  await waitFor(() => expect(cliente.isFetching()).toBe(0), { timeout: 8000 })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('El Directivo no ve nombres de alumnos (RNF-004)', () => {
  it('la matriz de permisos le da SOLO el Dashboard', () => {
    /**
     * Ya no tiene Inicio: sus tres indicadores institucionales los da el
     * Dashboard, con filtros de año, periodo y colegios que el Inicio no
     * tenía. Mantener los dos obligaba a sostener el mismo número en dos
     * pantallas.
     *
     * Que pueda entrar al Dashboard no significa que vea lo mismo que el
     * Supervisor: los cinco endpoints nominales —distribución, comparación de
     * resultados, detalle de clases y los dos de libros por alumno— le
     * responden 403, y sus tarjetas no ofrecen entrar a los módulos.
     *
     * Esta lista se construye con la matriz, así que el recorrido de abajo
     * —que busca nombres de alumnos en pantalla— cubre sola cualquier sección
     * que se le dé en el futuro.
     */
    expect(Object.values(MATRIZ).filter((s) => s[ROLES.DIRECTIVO]).map((s) => s.ruta)).toEqual(['/dashboard'])
    expect(RUTAS_DEL_DIRECTIVO).toEqual(['/dashboard'])
  })

  it('control: el mismo detector SÍ encuentra alumnos en /alumnos del Supervisor', async () => {
    // Sin este control, una pantalla en blanco haría pasar las pruebas de abajo.
    await montarYEsperar('/alumnos', ROLES.SUPERVISOR)
    await waitFor(() => expect(rastrosEn(document.body.textContent).length).toBeGreaterThan(0))
  })

  it.each(RUTAS_DEL_DIRECTIVO)('en %s no aparece ningún nombre ni código de alumno', async (ruta) => {
    await montarYEsperar(ruta)
    expect(rastrosEn(document.body.textContent)).toEqual([])
  })
})
