// La clase base más lo que espera en la cola (D123). Datos inventados.
import { describe, expect, it } from 'vitest'
import { fusionarConPendientes } from '../pendientesDeAsistencia'

const CLASE = { idColegio: '1', idGrado: '2', idSeccion: '7', fecha: '2026-11-12' }

const alumno = (id, extra = {}) => ({ id_alumno: id, nombre: `Alumno ${id}`, estado: null, observacion: null, version: 1, ...extra })
const base = () => ({ clase: { id_clase: 5 }, alumnos: [alumno(1), alumno(2, { estado: 'presente' }), alumno(3)] })

/** Un envío pendiente como lo deja `useAutoguardado` en la cola. */
const pendiente = (registro, clase = CLASE) => ({
  tipo: 'asistencia',
  payload: { ...clase, registros: [{ realizado_en: '2026-11-12T13:00:00.000Z', ...registro }] },
})

const estadoDe = (datos, id) => datos.alumnos.find((a) => a.id_alumno === id)

describe('fusionarConPendientes', () => {
  it('sin pendientes devuelve la clase tal cual', () => {
    const datos = base()
    expect(fusionarConPendientes(datos, [], CLASE)).toBe(datos)
  })

  it('aplica las marcas pendientes de la clase, incluido Ausente', () => {
    const datos = fusionarConPendientes(
      base(),
      [pendiente({ id_alumno: 1, estado: 'tardanza' }), pendiente({ id_alumno: 3, estado: 'ausente' })],
      CLASE,
    )
    expect(estadoDe(datos, 1).estado).toBe('tardanza')
    expect(estadoDe(datos, 3).estado).toBe('ausente')
    // El que no tiene pendiente conserva lo del servidor.
    expect(estadoDe(datos, 2).estado).toBe('presente')
  })

  it('varias marcas al mismo alumno: gana la más reciente', () => {
    const datos = fusionarConPendientes(
      base(),
      [
        pendiente({ id_alumno: 1, estado: 'ausente', realizado_en: '2026-11-12T13:05:00.000Z' }),
        pendiente({ id_alumno: 1, estado: 'presente', realizado_en: '2026-11-12T13:01:00.000Z' }),
      ],
      CLASE,
    )
    expect(estadoDe(datos, 1).estado).toBe('ausente')
  })

  it('una observación pendiente no borra la marca, y viceversa', () => {
    const datos = fusionarConPendientes(
      base(),
      [
        pendiente({ id_alumno: 2, observacion: 'Llegó con su mamá', realizado_en: '2026-11-12T13:02:00.000Z' }),
        pendiente({ id_alumno: 3, estado: 'ausente', realizado_en: '2026-11-12T13:01:00.000Z' }),
        pendiente({ id_alumno: 3, observacion: 'Faltó por lluvia', realizado_en: '2026-11-12T13:03:00.000Z' }),
      ],
      CLASE,
    )
    expect(estadoDe(datos, 2)).toEqual(expect.objectContaining({ estado: 'presente', observacion: 'Llegó con su mamá' }))
    expect(estadoDe(datos, 3)).toEqual(expect.objectContaining({ estado: 'ausente', observacion: 'Faltó por lluvia' }))
  })

  it('una observación vacía pendiente la borra', () => {
    const conNota = { ...base(), alumnos: [alumno(1, { observacion: 'Vieja' })] }
    const datos = fusionarConPendientes(conNota, [pendiente({ id_alumno: 1, observacion: null })], CLASE)
    expect(estadoDe(datos, 1).observacion).toBeNull()
  })

  it('ignora lo pendiente de otra fecha, sección o colegio', () => {
    const datos = fusionarConPendientes(
      base(),
      [
        pendiente({ id_alumno: 1, estado: 'ausente' }, { ...CLASE, fecha: '2026-11-11' }),
        pendiente({ id_alumno: 1, estado: 'ausente' }, { ...CLASE, idSeccion: '8' }),
        pendiente({ id_alumno: 1, estado: 'ausente' }, { ...CLASE, idColegio: '9' }),
      ],
      CLASE,
    )
    expect(estadoDe(datos, 1).estado).toBeNull()
  })

  it('un alumno pendiente que no está en la lista no se agrega', () => {
    const datos = fusionarConPendientes(base(), [pendiente({ id_alumno: 99, estado: 'presente' })], CLASE)
    expect(datos.alumnos.map((a) => a.id_alumno)).toEqual([1, 2, 3])
  })
})
