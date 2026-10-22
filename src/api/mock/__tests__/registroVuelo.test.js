// Las reglas del Registro de Vuelo, contra el simulador (CU031, CU032).
//
// Son reglas DEL CONTRATO y se prueban aquí: cómo se encadena la entrada de un
// periodo con la decisión del anterior, qué pasa cuando esa decisión no existe
// y qué campos se pueden mandar. Pasar por el DOM no probaría nada más.
import { beforeEach, describe, expect, it } from 'vitest'
import handlers, { _reiniciarSimulador } from '../handlers'
import * as db from '../db'

const PROGRAMA = 2

const idPeriodo = (numero) => 4 + numero

const alumno = () => db.ALUMNOS.find((a) => Number(a.id_programa) === PROGRAMA)

const listar = (a) =>
  handlers.registroVuelo.listar({
    idColegio: a.id_colegio,
    idPrograma: PROGRAMA,
    idGrado: a.id_grado,
    idSeccion: 2,
    idAnioEscolar: 2,
  })

const decidir = (a, numero, campos, version = null) =>
  handlers.registroVuelo.guardar([
    {
      id_operacion: `op-${Math.random()}`,
      version,
      id_alumno: a.id_alumno,
      id_periodo_academico: idPeriodo(numero),
      id_colegio: a.id_colegio,
      id_grado: a.id_grado,
      id_seccion: 2,
      id_programa: PROGRAMA,
      ...campos,
    },
  ])

const suyo = (datos, idAlumno, numero) =>
  datos.items.find((i) => i.id_alumno === idAlumno).periodos.find((p) => p.numero === numero)

beforeEach(() => _reiniciarSimulador())

describe('La entrada de cada periodo', () => {
  it('PA1 entra por la letra del grado', async () => {
    const a = alumno()
    const datos = await listar(a)
    const pa1 = suyo(datos, a.id_alumno, 1)

    expect(pa1.entrada.origen).toBe('grado')
    expect(pa1.entrada.nivel).not.toBeNull()
  })

  it('PA2 entra por el nivel COLOCADO de PA1, no por la sugerencia', async () => {
    /**
     * Es la diferencia de fondo: la sugerencia es del motor y el nivel
     * colocado es la decisión del docente. Si PA2 entrara por la sugerencia,
     * la decisión del docente no tendría consecuencia.
     */
    const a = alumno()
    const letraF = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F')

    await decidir(a, 1, { id_nivel_colocado: letraF.id_nivel_razkids })
    const datos = await listar(a)
    const pa2 = suyo(datos, a.id_alumno, 2)

    expect(pa2.entrada.origen).toBe('periodo_anterior')
    expect(pa2.entrada.nivel.letra).toBe('F')
  })

  it('sin decisión en PA1, PA2 queda PENDIENTE y no cae a la letra del grado', async () => {
    // Caer a la letra del grado daría por buena una entrada inventada, y el
    // error se arrastraría a PA3 y PA4 sin que nadie lo notara.
    const a = alumno()
    const datos = await listar(a)
    const pa2 = suyo(datos, a.id_alumno, 2)

    expect(pa2.entrada.nivel).toBeNull()
    expect(pa2.entrada.origen).toBe('pendiente_periodo_anterior')
  })

  it('avisa si la entrada cambió DESPUÉS de haber decidido', async () => {
    /**
     * Alguien corrigió el periodo anterior. La decisión del docente no se
     * recalcula sola —sería decidir por él—: se marca para que la revise.
     */
    const a = alumno()
    const F = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F').id_nivel_razkids
    const I = db.NIVELES_RAZKIDS.find((n) => n.letra === 'I').id_nivel_razkids

    await decidir(a, 1, { id_nivel_colocado: F })
    await decidir(a, 2, { id_nivel_colocado: I })

    let datos = await listar(a)
    expect(suyo(datos, a.id_alumno, 2).aviso_entrada_cambio).toBe(false)

    // Se corrige PA1: la entrada de PA2 ya no es la que había al decidir.
    await decidir(a, 1, { id_nivel_colocado: I }, 1)
    datos = await listar(a)
    const pa2 = suyo(datos, a.id_alumno, 2)
    expect(pa2.aviso_entrada_cambio).toBe(true)
    expect(pa2.aviso).toMatch(/cambi/i)
    // Y la decisión sigue intacta: no se toca sola.
    expect(pa2.nivel_colocado.letra).toBe('I')
  })
})

describe('La sugerencia', () => {
  it('sin rúbrica completa queda pendiente de evaluar', async () => {
    // Inventarla sería peor que no darla: se leería como fundada.
    const a = alumno()
    const datos = await listar(a)
    const pa1 = suyo(datos, a.id_alumno, 1)

    expect(pa1.sugerencia.accion).toBeNull()
    expect(pa1.sugerencia.texto).toBe('Pendiente de evaluar')
    expect(pa1.sugerencia.rubrica).toBeNull()
  })

  it('con una rúbrica completa trae la acción y la rúbrica de referencia', async () => {
    const a = alumno()
    const mes = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()).slice(5, 7))

    await handlers.rubricas.guardar([
      {
        id_operacion: 'r1',
        version: null,
        id_alumno: a.id_alumno,
        id_colegio: a.id_colegio,
        id_grado: a.id_grado,
        id_seccion: 2,
        id_programa: PROGRAMA,
        id_anio_escolar: 2,
        mes,
        fluidez: 4,
        comprension: 4,
      },
    ])

    const datos = await listar(a)
    const pa1 = suyo(datos, a.id_alumno, 1)

    expect(pa1.sugerencia.accion).toBe('subir')
    // 4·4 + 6·4 = 40 décimas.
    expect(pa1.sugerencia.resultado_decimas).toBe(40)
    // La rúbrica de referencia va dentro: el docente tiene que poder ver de
    // dónde sale la sugerencia antes de seguirla.
    expect(pa1.sugerencia.rubrica).toMatchObject({ fluidez: 'Avanzado', comprension: 'Avanzado' })
  })
})

describe('Lo que el cliente puede mandar', () => {
  it('un campo CALCULADO tira el lote completo con un 422', async () => {
    /**
     * No es un campo que el servidor ignore: es un 422 `validacion` que tira
     * las 200 decisiones del lote. Y `entrada` vive en el mismo objeto del que
     * sale el nivel colocado, así que un `...periodo` lo mandaría sin que
     * nadie lo notara hasta el error.
     */
    const a = alumno()
    const error = await decidir(a, 1, { entrada: { nivel: { id: 1, letra: 'aa' } } }).catch((e) => e)

    expect(error.response.status).toBe(422)
    expect(error.response.data.motivo).toBe('validacion')
    expect(error.response.data.errores[0].campo).toBe('entrada')
  })

  it('un nivel inexistente se rechaza diciendo QUÉ campo falló', async () => {
    // Sin el campo, un rechazo de la proyección parecería del nivel colocado.
    const a = alumno()
    const [resultado] = await decidir(a, 1, { id_nivel_proyeccion: 999 })

    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'nivel_invalido' })
    expect(resultado.registro.campo).toBe('id_nivel_proyeccion')
  })

  it('el nivel colocado no se puede volver a null', async () => {
    // La fila del PA siguiente se construye sobre esa decisión.
    const a = alumno()
    const F = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F').id_nivel_razkids

    await decidir(a, 1, { id_nivel_colocado: F })
    const [resultado] = await decidir(a, 1, { id_nivel_colocado: null }, 1)

    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'nivel_colocado_obligatorio' })
  })

  it('la proyección y la observación SÍ se pueden borrar', async () => {
    // Son opcionales: no dejan el periodo incompleto, así que quitarlas no
    // rompe nada que venga después.
    const a = alumno()
    const F = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F').id_nivel_razkids

    await decidir(a, 1, { id_nivel_colocado: F, id_nivel_proyeccion: F, observacion: 'Va bien' })
    const [resultado] = await decidir(a, 1, { id_nivel_proyeccion: null, observacion: null }, 1)

    expect(resultado.estado).toBe('aceptada')
    expect(resultado.registro.proyeccion).toBeNull()
    expect(resultado.registro.observacion).toBeNull()
    // El nivel colocado se queda: no se mandó, así que no cambia.
    expect(resultado.registro.nivel_colocado.letra).toBe('F')
  })

  it('con una versión vieja se rechaza y devuelve la vigente', async () => {
    const a = alumno()
    const F = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F').id_nivel_razkids

    await decidir(a, 1, { id_nivel_colocado: F })
    const [resultado] = await decidir(a, 1, { id_nivel_colocado: F }, 99)

    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'modificacion_concurrente' })
    expect(resultado.registro.nivel_colocado.letra).toBe('F')
  })
})

describe('El avance anual y los periodos', () => {
  it('son 25 puntos por cada PA con nivel colocado', async () => {
    const a = alumno()
    const F = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F').id_nivel_razkids

    let datos = await listar(a)
    expect(datos.items.find((i) => i.id_alumno === a.id_alumno).avance_anual).toBe(0)

    await decidir(a, 1, { id_nivel_colocado: F })
    datos = await listar(a)
    expect(datos.items.find((i) => i.id_alumno === a.id_alumno).avance_anual).toBe(25)
  })

  it('la escritura va una vez POR PERIODO, no por alumno', async () => {
    // La habilitación es de cada PA: tenerla en PA2 no habilita PA3, y por eso
    // no se puede repetir el mismo bloque en cada fila.
    const a = alumno()
    const datos = await listar(a)

    expect(datos.periodos).toHaveLength(4)
    datos.periodos.forEach((p) => expect(p.escritura).toHaveProperty('permitida'))
    expect(datos.items[0]).not.toHaveProperty('escritura')
  })

  it('un periodo futuro no se puede registrar', async () => {
    const a = alumno()
    const datos = await listar(a)
    const futuro = datos.periodos.find((p) => p.estado === 'futuro')
    if (!futuro) return

    expect(futuro.escritura.permitida).toBe(false)
    const F = db.NIVELES_RAZKIDS.find((n) => n.letra === 'F').id_nivel_razkids
    const [resultado] = await decidir(a, futuro.numero, { id_nivel_colocado: F })
    expect(resultado).toMatchObject({ estado: 'rechazada', motivo: 'periodo_futuro' })
  })
})
