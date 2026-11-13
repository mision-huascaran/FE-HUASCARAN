// La clase base más lo que espera en la cola (D123). Datos inventados.
import { describe, expect, it } from 'vitest'
import { fusionarConPendientes, pendientesDeLaClase } from '../pendientesDeAsistencia'
import { fusionarMarca } from '../useAutoguardado'

const ADICIONAL = 'Clase adicional'
const CLASE = { idColegio: '1', idGrado: '2', idSeccion: '7', fecha: '2026-11-12' }

const alumno = (id, extra = {}) => ({ id_alumno: id, nombre: `Alumno ${id}`, estado: null, observacion: null, version: 1, ...extra })
const base = () => ({ clase: { id_clase: 5 }, alumnos: [alumno(1), alumno(2, { estado: 'presente' }), alumno(3)] })

/** Un envío pendiente como lo deja `useAutoguardado` en la cola. */
const pendiente = (registro, clase = CLASE, extra = {}) => ({
  tipo: 'asistencia',
  payload: { ...clase, ...extra, registros: [{ realizado_en: '2026-11-12T13:00:00.000Z', ...registro }] },
})

/** Un día sin clase programada, como lo responde el servidor. */
const sinClase = () => ({
  ...base(),
  clase: { id_clase: null, tipo: null, etiqueta: null, aviso: 'No hay una clase programada para esta fecha.' },
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

  describe('clase adicional pendiente', () => {
    it('la copia sin clase sale como "Clase adicional" con todas sus marcas', () => {
      const datos = fusionarConPendientes(
        sinClase(),
        [
          pendiente({ id_alumno: 1, estado: 'presente' }, CLASE, { adicional: true }),
          pendiente({ id_alumno: 3, estado: 'ausente' }, CLASE, { adicional: true }),
        ],
        CLASE,
      )
      expect(datos.clase).toEqual(
        expect.objectContaining({ etiqueta: ADICIONAL, tipo: 'adicional', aviso: null, adicional_pendiente: true }),
      )
      expect(estadoDe(datos, 1).estado).toBe('presente')
      expect(estadoDe(datos, 3).estado).toBe('ausente')
    })

    it('basta con que UNA marca pendiente lleve la adicional', () => {
      const datos = fusionarConPendientes(
        sinClase(),
        [pendiente({ id_alumno: 1, estado: 'presente' }), pendiente({ id_alumno: 3, estado: 'tardanza' }, CLASE, { adicional: true })],
        CLASE,
      )
      expect(datos.clase.etiqueta).toBe(ADICIONAL)
    })

    it('si el servidor ya tiene la clase, se respeta la suya', () => {
      const conClase = { ...base(), clase: { id_clase: 5, tipo: 'adicional', etiqueta: ADICIONAL, aviso: null } }
      const datos = fusionarConPendientes(conClase, [pendiente({ id_alumno: 1, estado: 'presente' }, CLASE, { adicional: true })], CLASE)
      expect(datos.clase).toEqual(conClase.clase)
    })

    it('sin `adicional` pendiente, un día sin clase sigue sin clase', () => {
      const datos = fusionarConPendientes(sinClase(), [pendiente({ id_alumno: 1, estado: 'presente' })], CLASE)
      expect(datos.clase.etiqueta).toBeNull()
    })

    it('la adicional pendiente de otra fecha no crea clase en esta', () => {
      const otra = { ...CLASE, fecha: '2026-11-11' }
      const datos = fusionarConPendientes(sinClase(), [pendiente({ id_alumno: 1, estado: 'presente' }, otra, { adicional: true })], CLASE)
      expect(datos.clase.etiqueta).toBeNull()
    })

    it('corregir una marca que creaba la adicional no le quita el aviso', () => {
      const anterior = pendiente({ id_alumno: 1, estado: 'presente' }, CLASE, { adicional: true }).payload
      const nuevo = pendiente({ id_alumno: 1, estado: 'ausente', realizado_en: '2026-11-12T13:09:00.000Z' }).payload
      const fusionado = fusionarMarca(anterior, { ...nuevo, adicional: false })
      expect(fusionado.adicional).toBe(true)
      expect(fusionado.registros).toEqual([expect.objectContaining({ id_alumno: 1, estado: 'ausente' })])
    })
  })

  it('pendientesDeLaClase cuenta solo los envíos de esa clase', () => {
    const otra = { ...CLASE, idSeccion: '8' }
    expect(pendientesDeLaClase([pendiente({ id_alumno: 1 }), pendiente({ id_alumno: 2 }, otra)], CLASE)).toBe(1)
    expect(pendientesDeLaClase([], CLASE)).toBe(0)
  })
})
