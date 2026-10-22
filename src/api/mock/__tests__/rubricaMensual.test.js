// Las reglas de la rúbrica mensual, contra el simulador (CU029, CU030).
//
// Van aquí y no por la pantalla porque son reglas DEL CONTRATO: qué valor se
// admite en cada dimensión, cómo se calcula el resultado y cuándo hay choque de
// versiones. Pasar por el DOM para comprobar la ponderación añadiría tres
// esperas y no probaría nada más.
import { beforeEach, describe, expect, it } from 'vitest'
import handlers, { _reiniciarSimulador } from '../handlers'
import * as db from '../db'

const ALFABETIZACION = 1
const COMPRENSION_LECTORA = 2

/** El mes en curso en Lima: evaluar un mes futuro está prohibido. */
const mesActual = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()).slice(5, 7))

const alumnoDe = (idPrograma) => db.ALUMNOS.find((a) => Number(a.id_programa) === idPrograma)

const guardar = (alumno, idPrograma, campos, version = null) =>
  handlers.rubricas.guardar([
    {
      id_operacion: `op-${Math.random()}`,
      version,
      id_alumno: alumno.id_alumno,
      id_colegio: alumno.id_colegio,
      id_grado: alumno.id_grado,
      id_seccion: 2,
      id_programa: idPrograma,
      id_anio_escolar: 2,
      mes: mesActual(),
      ...campos,
    },
  ])

beforeEach(() => _reiniciarSimulador())

describe('La escala de cada dimensión', () => {
  it('Alfabetización admite 0 en Fluidez', async () => {
    // Hay alumnos que todavía no reconocen consonantes y vocales: "Pre-inicio"
    // existe para ellos, y es un valor, no un hueco.
    const alumno = alumnoDe(ALFABETIZACION)
    const [resultado] = await guardar(alumno, ALFABETIZACION, { fluidez: 0 })
    expect(resultado.estado).toBe('aceptada')
    expect(resultado.registro.fluidez).toBe(0)
    // Con una sola dimensión queda incompleta, y se guarda igual.
    expect(resultado.registro.estado).toBe('incompleta')
  })

  it('Comprensión nunca admite 0, ni en Alfabetización', async () => {
    // Quien ya está en el subprograma comprende algo por definición.
    const alumno = alumnoDe(ALFABETIZACION)
    const [resultado] = await guardar(alumno, ALFABETIZACION, { comprension: 0 })
    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'valor_no_permitido' })
    // Dice QUÉ dimensión falló: sin eso, parecería un rechazo de la fila.
    expect(resultado.registro.campo).toBe('comprension')
  })

  it('Comprensión Lectora no admite 0 ni en Fluidez', async () => {
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    const [resultado] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 0 })
    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'valor_no_permitido' })
    expect(resultado.registro.campo).toBe('fluidez')
  })

  it('un valor fuera de 0-4 se rechaza', async () => {
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    const [resultado] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 5 })
    expect(resultado.motivo).toBe('valor_no_permitido')
  })
})

describe('El resultado ponderado', () => {
  it('son décimas: 4·Fluidez + 6·Comprensión', async () => {
    // F × 0,40 + C × 0,60 expresado en décimas, para no mandar un decimal por
    // la red y que cada cliente lo redondee a su manera.
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    const [resultado] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 2, comprension: 3 })
    expect(resultado.registro.resultado_decimas).toBe(26)
    expect(resultado.registro.estado).toBe('completada')
  })

  it('con una dimensión suelta no hay resultado', async () => {
    // Una nota a medias no es una nota.
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    const [resultado] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 3 })
    expect(resultado.registro.resultado_decimas).toBeNull()
  })
})

describe('Omitir, borrar y la versión', () => {
  it('una dimensión omitida no cambia; en null se borra', async () => {
    const alumno = alumnoDe(COMPRENSION_LECTORA)

    const [primero] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 2, comprension: 3 })
    expect(primero.registro.version).toBe(1)

    // Solo Fluidez: Comprensión se queda como estaba.
    const [segundo] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 4 }, 1)
    expect(segundo.registro).toMatchObject({ fluidez: 4, comprension: 3 })

    // Ahora en null: se borra, y la fila vuelve a incompleta.
    const [tercero] = await guardar(alumno, COMPRENSION_LECTORA, { comprension: null }, 2)
    expect(tercero.registro.comprension).toBeNull()
    expect(tercero.registro.estado).toBe('incompleta')
    expect(tercero.registro.resultado_decimas).toBeNull()
  })

  it('con una versión vieja se rechaza y devuelve la vigente para adoptarla', async () => {
    /**
     * Reintentar pisaría el cambio de la otra persona, así que el servidor
     * manda el registro vigente y el cliente lo adopta. Sin ese registro, la
     * pantalla tendría que recargar la página entera para enterarse.
     */
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 2, comprension: 3 })

    const [resultado] = await guardar(alumno, COMPRENSION_LECTORA, { fluidez: 1 }, 99)
    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'modificacion_concurrente' })
    expect(resultado.registro).toMatchObject({ fluidez: 2, comprension: 3 })
  })
})

describe('La lista del mes', () => {
  it('un mes futuro responde 422, no una lista vacía', async () => {
    // Una lista vacía diría "no hay a quién evaluar", que es otra cosa.
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    const error = await handlers.rubricas
      .listar({
        idColegio: alumno.id_colegio,
        idPrograma: COMPRENSION_LECTORA,
        idGrado: alumno.id_grado,
        idAnioEscolar: 2,
        mes: 12,
      })
      .catch((e) => e)

    // Diciembre solo es futuro si hoy no estamos en diciembre.
    if (mesActual() < 12) {
      expect(error.response.status).toBe(422)
      expect(error.response.data.motivo).toBe('mes_futuro')
    }
  })

  it('trae el ciclo del grado, que es lo que pide los descriptores', async () => {
    const alumno = alumnoDe(COMPRENSION_LECTORA)
    const datos = await handlers.rubricas.listar({
      idColegio: alumno.id_colegio,
      idPrograma: COMPRENSION_LECTORA,
      idGrado: alumno.id_grado,
      idAnioEscolar: 2,
      mes: mesActual(),
    })
    expect(['III', 'IV', 'V']).toContain(datos.ciclo)
    expect(datos.page_size).toBe(40)
  })
})

describe('Los descriptores pedagógicos', () => {
  it('Alfabetización no se dicta en IV ni en V: lista vacía, no un error', async () => {
    // Que esa combinación no exista no es un fallo que haya que explicar.
    expect(await handlers.rubricas.criterios({ idPrograma: ALFABETIZACION, idCiclo: 2 })).toEqual([])
    expect(await handlers.rubricas.criterios({ idPrograma: ALFABETIZACION, idCiclo: 3 })).toEqual([])
  })

  it('vienen con su valor, su nombre y su descriptor, por dimensión', async () => {
    const criterios = await handlers.rubricas.criterios({ idPrograma: ALFABETIZACION, idCiclo: 1 })
    expect(criterios.length).toBeGreaterThan(0)
    expect(criterios[0]).toMatchObject({ dimension: 'Fluidez', valor: 0, nombre: 'Pre-inicio' })
    expect(criterios[0].descriptor).toEqual(expect.any(String))
    // Comprensión empieza en 1 también aquí: la escala es la misma.
    const comprension = criterios.filter((c) => c.dimension === 'Comprension')
    expect(comprension.map((c) => c.valor)).toEqual([1, 2, 3, 4])
  })
})
