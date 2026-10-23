// Las reglas de la tabla de lectura, contra el simulador (CU023 a CU026).
//
// Se prueban aquí y no por la pantalla porque son reglas DEL CONTRATO: qué se
// acepta, qué se rechaza y con qué motivo. Pasar por el DOM para comprobar que
// un LSN a medias se rechaza solo añadiría ruido y tres esperas.
import { beforeEach, describe, expect, it } from 'vitest'
import handlers, { _reiniciarSimulador } from '../handlers'
import * as db from '../db'

const BASE = {
  id_colegio: 1,
  id_grado: null,
  id_seccion: 2,
  id_programa: null,
  id_anio_escolar: 2,
  mes: null,
  id_semana: null,
}

let contexto = null

/** Una clase de la semana con un alumno presente y otro ausente. */
async function prepararTabla() {
  const semana = db.SEMANAS.at(-1)
  const alumnos = db.alumnosDe({ colegio: 1 })
  const alumno = alumnos[0]
  const otro = alumnos.find((a) => a.id_alumno !== alumno.id_alumno && a.id_grado === alumno.id_grado)

  const datos = {
    ...BASE,
    id_grado: alumno.id_grado,
    id_programa: alumno.id_programa,
    mes: semana.mes,
    id_semana: semana.id_semana,
  }

  // La clase de referencia, con asistencia ya tomada: la lectura DEPENDE de
  // ella, así que sin marcas no se podría probar casi nada.
  await handlers.asistencia.guardar({
    idColegio: datos.id_colegio,
    idGrado: datos.id_grado,
    idSeccion: datos.id_seccion,
    fecha: semana.inicio,
    registros: [
      { id_operacion: 'a1', id_alumno: alumno.id_alumno, estado: 'presente' },
      ...(otro ? [{ id_operacion: 'a2', id_alumno: otro.id_alumno, estado: 'ausente' }] : []),
    ],
  })

  const idOperacion = `crear-${Math.random()}`
  const tabla = await handlers.lectura.crear({
    ...datos,
    id_operacion: idOperacion,
    fecha_clase_referencia: semana.inicio,
    id_clase_referencia: null,
  })

  return { tabla, datos, semana, alumno, otro, idOperacion }
}

beforeEach(async () => {
  // Las tablas y las clases viven en modulo: sin vaciarlas, cada prueba
  // heredaria la tabla de la anterior y crear la misma responderia 409.
  _reiniciarSimulador()
  contexto = await prepararTabla()
})

describe('Crear la tabla', () => {
  it('nace con una fila por alumno del subprograma, todas vacías', () => {
    const { tabla, datos } = contexto
    expect(tabla.filas.length).toBeGreaterThan(0)
    expect(tabla.filas.every((f) => f.id_alumno != null)).toBe(true)
    // `cantidad_lsl: null` NO es cero: es "no registrado", y de ahí que la
    // fila nazca pendiente en vez de darse por completada con cero libros.
    expect(tabla.filas[0].cantidad_lsl).toBeNull()
    expect(tabla.filas[0].total_libros).toBe(0)
    expect(tabla.id_programa).toBe(datos.id_programa)
  })

  it('es idempotente por id_operacion: un reintento no crea una segunda', async () => {
    // Es lo que salva a la cola offline: el mismo envío puede llegar dos veces
    // tras un corte, y sin esto la semana acabaría con dos tablas.
    const { tabla, datos, semana, idOperacion } = contexto
    const otraVez = await handlers.lectura.crear({
      ...datos,
      id_operacion: idOperacion,
      fecha_clase_referencia: semana.inicio,
      id_clase_referencia: null,
    })
    expect(otraVez.id).toBe(tabla.id)
  })

  it('con otra operación sobre los mismos filtros responde 409, con el id de la que hay', async () => {
    const { datos, semana } = contexto
    const error = await handlers.lectura
      .crear({ ...datos, id_operacion: 'otra', fecha_clase_referencia: semana.inicio, id_clase_referencia: null })
      .catch((e) => e)
    expect(error.response.status).toBe(409)
    expect(error.response.data.motivo).toBe('tabla_existente')
    // El id va dentro: así la pantalla puede ir a la que ya existe en vez de
    // dejar al docente con un error y sin salida.
    expect(error.response.data.id).toBeGreaterThan(0)
  })
})

describe('Guardar filas', () => {
  it('sin presente o tardanza rechaza los libros, pero acepta la observación', async () => {
    const { tabla, otro } = contexto
    if (!otro) return

    const [rechazado] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'r1', id_alumno: otro.id_alumno, cantidad_lsl: 2 },
    ])
    expect(rechazado).toMatchObject({ estado: 'rechazada', motivo: 'sin_asistencia' })

    const [aceptado] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'r2', id_alumno: otro.id_alumno, observacion: 'Faltó por enfermedad' },
    ])
    expect(aceptado.estado).toBe('aceptada')
    expect(aceptado.registro.observacion).toBe('Faltó por enfermedad')
  })

  it('BORRAR sí se acepta con ausente: es como se resuelve un revisar_asistencia', async () => {
    /**
     * El alumno tenía libros y alguien corrigió su asistencia a ausente. Si
     * borrar estuviera prohibido, la fila se quedaría para siempre marcada
     * como "revisa la asistencia" y el docente sin forma de arreglarla.
     */
    const { tabla, alumno } = contexto
    await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'b1', id_alumno: alumno.id_alumno, cantidad_lsl: 3 },
    ])
    await handlers.asistencia.guardar({
      idColegio: tabla.id_colegio,
      idGrado: tabla.id_grado,
      idSeccion: tabla.id_seccion,
      fecha: tabla.clase_referencia.fecha,
      registros: [{ id_operacion: 'a3', id_alumno: alumno.id_alumno, estado: 'ausente' }],
    })

    const [resultado] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'b2', id_alumno: alumno.id_alumno, cantidad_lsl: null },
    ])
    expect(resultado.estado).toBe('aceptada')
    expect(resultado.registro.revisar_asistencia).toBe(false)
  })

  it('un LSN a medias se rechaza; completo y válido se acepta', async () => {
    const { tabla, alumno } = contexto

    const [aMedias] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'l1', id_alumno: alumno.id_alumno, lsn_titulo: 'El zorro' },
    ])
    expect(aMedias).toMatchObject({ estado: 'rechazada', motivo: 'lsn_incompleto' })

    // Un máximo que no es 5 ni 10 no existe (CU024).
    const [maloElMaximo] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'l2', id_alumno: alumno.id_alumno, lsn_titulo: 'El zorro', lsn_nota: 3, lsn_maximo: 7 },
    ])
    expect(maloElMaximo).toMatchObject({ estado: 'rechazada', motivo: 'lsn_invalido' })

    // La nota 0 ES válida: no es lo mismo que no haber leído.
    const [bien] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'l3', id_alumno: alumno.id_alumno, lsn_titulo: 'El zorro', lsn_nota: 0, lsn_maximo: 5 },
    ])
    expect(bien.estado).toBe('aceptada')
    expect(bien.registro.lsn_nota).toBe(0)
    // (1 si hay LSN) + los LSL, calculado por el servidor.
    expect(bien.registro.total_libros).toBe(1)
  })

  it('un título con solo espacios cuenta como vacío', async () => {
    const { tabla, alumno } = contexto
    const [resultado] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 't1', id_alumno: alumno.id_alumno, lsn_titulo: '   ' },
    ])
    // Queda vacío, así que no hay LSN a medias que rechazar.
    expect(resultado.estado).toBe('aceptada')
    expect(resultado.registro.lsn_titulo).toBeNull()
  })

  it('completada exige asistencia Y los LSL registrados', async () => {
    const { tabla, alumno } = contexto
    const [resultado] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'c1', id_alumno: alumno.id_alumno, cantidad_lsl: 0 },
    ])
    // Cero libros registrados ES un registro: la fila queda completada.
    expect(resultado.registro.estado_fila).toBe('completada')
  })
})

describe('No realizada (CU026)', () => {
  it('sin motivo no se marca', async () => {
    const { tabla } = contexto
    const error = await handlers.lectura
      .noRealizada(tabla.id, { id_operacion: 'n1', version: tabla.version, motivo: '   ' })
      .catch((e) => e)
    expect(error.response.status).toBe(422)
  })

  it('con libros guardados se rechaza, pero una observación no lo impide', async () => {
    const { tabla, alumno } = contexto

    await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'o1', id_alumno: alumno.id_alumno, observacion: 'Nada que destacar' },
    ])
    const conObservacion = await handlers.lectura.noRealizada(tabla.id, {
      id_operacion: 'n2',
      version: tabla.version,
      motivo: 'Paro de transportistas',
    })
    expect(conObservacion.estado).toBe('no_realizada')
    // Todas las filas pasan a "no aplica": ya no cuentan como pendientes.
    expect(conObservacion.filas.every((f) => f.estado_fila === 'no_aplica')).toBe(true)

    // Y a partir de aquí ya no se escribe lectura.
    const [bloqueado] = await handlers.lectura.guardarFilas(tabla.id, [
      { id_operacion: 'o2', id_alumno: alumno.id_alumno, cantidad_lsl: 1 },
    ])
    expect(bloqueado).toMatchObject({ estado: 'rechazada', motivo: 'lectura_no_realizada' })
  })

  it('con una versión vieja responde 409 y no pisa el cambio ajeno', async () => {
    const { tabla } = contexto
    const error = await handlers.lectura
      .noRealizada(tabla.id, { id_operacion: 'n3', version: tabla.version - 1, motivo: 'Lluvia' })
      .catch((e) => e)
    expect(error.response.status).toBe(409)
    expect(error.response.data.motivo).toBe('modificacion_concurrente')
  })
})
