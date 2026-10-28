// Las tres vías por las que un Docente puede escribir (CU028), y el orden en
// que se eligen.
//
// Esto es el respaldo SIN CONEXIÓN: con red manda el bloque `escritura` que
// devuelve cada GET de módulo. Pero sin red es lo único que hay, así que
// conviene que no se equivoque en los bordes: un permiso que todavía no empezó,
// uno que ya venció, una fecha fuera de todo periodo, o un colegio cuyo
// calendario ni siquiera se ha descargado.
import { describe, expect, it } from 'vitest'
import { MODULOS, MOTIVO, habilitacionPara, hayHabilitacionParaIniciar, periodoDe } from '../habilitaciones'

const PA3 = { tipo: 'PA', numero: 3, id_periodo_academico: 33, fecha_inicio: '2026-08-01', fecha_fin: '2026-10-15' }
const PR3 = { tipo: 'PR', numero: 3, id_periodo_academico: 93, fecha_inicio: '2026-10-16', fecha_fin: '2026-10-31' }

const CALENDARIO = {
  id_colegio: 1,
  periodos: [PA3, PR3],
  dias_no_lectivos: [{ motivo: 'Feriado', fecha_inicio: '2026-10-08', fecha_fin: '2026-10-08' }],
}

const AHORA = new Date('2026-10-20T15:00:00-05:00')

const base = (extra = {}) => ({
  asignaciones: [],
  permisos: [],
  calendarios: [CALENDARIO],
  ...extra,
})

const pedir = (habilitaciones, extra = {}) =>
  habilitacionPara({
    habilitaciones,
    modulo: MODULOS.LECTURA,
    idColegio: 1,
    idGrado: 3,
    fecha: '2026-10-05',
    instante: AHORA,
    ...extra,
  })

describe('El periodo de un colegio en una fecha', () => {
  it('encuentra el PA y lo da por lectivo en un día hábil corriente', () => {
    // El 5 de octubre de 2026 es lunes.
    expect(periodoDe([CALENDARIO], 1, '2026-10-05')).toMatchObject({ tipo: 'PA', numero: 3, es_lectivo: true })
  })

  it('un feriado sigue perteneciendo a su periodo, pero no es lectivo', () => {
    // Importa para CU028: durante un receso se regulariza el PA anterior, y
    // para eso hay que saber en qué periodo se está, no solo que no es lectivo.
    expect(periodoDe([CALENDARIO], 1, '2026-10-08')).toMatchObject({ numero: 3, es_lectivo: false })
  })

  it('el fin de semana tampoco es lectivo', () => {
    // El 10 de octubre de 2026 es sábado.
    expect(periodoDe([CALENDARIO], 1, '2026-10-10').es_lectivo).toBe(false)
  })

  it('con varios años del mismo colegio, elige el que contiene la fecha', () => {
    /**
     * `/me/habilitaciones` manda un calendario por (colegio, año escolar) y no
     * filtra por año en curso, porque el receso posterior a PA4 puede caer en
     * el año calendario siguiente. Quedarse con el primero del colegio daría
     * el periodo de otro año.
     */
    const del2027 = {
      id_colegio: 1,
      id_anio_escolar: 2,
      periodos: [
        { tipo: 'PA', numero: 1, id_periodo_academico: 41, fecha_inicio: '2027-03-01', fecha_fin: '2027-05-15' },
      ],
      dias_no_lectivos: [],
    }

    const calendarios = [{ ...CALENDARIO, id_anio_escolar: 1 }, del2027]
    expect(periodoDe(calendarios, 1, '2026-10-05')).toMatchObject({ id_periodo_academico: 33 })
    expect(periodoDe(calendarios, 1, '2027-03-10')).toMatchObject({ id_periodo_academico: 41 })
  })

  it('distingue "no hay calendario" de "fuera de periodo"', () => {
    // Son dos cosas distintas: una se arregla conectándose, la otra no.
    expect(periodoDe([CALENDARIO], 99, '2026-10-05')).toBeNull()
    expect(periodoDe([CALENDARIO], 1, '2026-12-25')).toMatchObject({ tipo: null })
  })
})

describe('Habilitación de escritura', () => {
  it('sin calendario descargado no decide: pide conexión', () => {
    expect(pedir(base(), { idColegio: 99 })).toMatchObject({
      permitida: false,
      motivo: MOTIVO.SIN_CALENDARIO,
    })
  })

  it('una fecha fuera de todo periodo no habilita', () => {
    expect(pedir(base(), { fecha: '2026-12-25' })).toMatchObject({
      permitida: false,
      motivo: MOTIVO.FUERA_DE_PERIODO,
    })
  })

  it('sin asignación ni permiso, no se escribe', () => {
    expect(pedir(base())).toMatchObject({ permitida: false, motivo: MOTIVO.SIN_HABILITACION })
  })

  it('la asignación del periodo habilita', () => {
    const h = base({ asignaciones: [{ id_colegio: 1, id_grado: 3, id_periodo_academico: 33, retroactiva: false }] })
    expect(pedir(h)).toMatchObject({ permitida: true, motivo: MOTIVO.ASIGNACION, id_periodo_academico: 33 })
  })

  it('la asignación retroactiva habilita, y se distingue de la ordinaria', () => {
    const h = base({ asignaciones: [{ id_colegio: 1, id_grado: 3, id_periodo_academico: 33, retroactiva: true }] })
    expect(pedir(h)).toMatchObject({ permitida: true, motivo: MOTIVO.ASIGNACION_RETROACTIVA })
  })

  it('la asignación de OTRO grado no sirve', () => {
    const h = base({ asignaciones: [{ id_colegio: 1, id_grado: 4, id_periodo_academico: 33, retroactiva: false }] })
    expect(pedir(h).permitida).toBe(false)
  })

  it('un permiso vigente habilita y devuelve su identificador', () => {
    // Hace falta el id: cada corrección guarda qué permiso la autorizó.
    const h = base({
      permisos: [
        {
          id_permiso: 7,
          id_colegio: 1,
          id_grado: 3,
          id_periodo_academico: 33,
          modulo: MODULOS.LECTURA,
          inicio: '2026-10-19T00:00:00-05:00',
          fin: '2026-10-25T23:59:59-05:00',
        },
      ],
    })
    expect(pedir(h)).toMatchObject({ permitida: true, motivo: MOTIVO.PERMISO, id_permiso: 7 })
  })

  it('un permiso de OTRO módulo no sirve', () => {
    // CU028: un permiso autoriza un solo módulo; para otro hace falta otro.
    const h = base({
      permisos: [
        {
          id_permiso: 7,
          id_colegio: 1,
          id_grado: 3,
          id_periodo_academico: 33,
          modulo: MODULOS.RUBRICA,
          inicio: '2026-10-19T00:00:00-05:00',
          fin: '2026-10-25T23:59:59-05:00',
        },
      ],
    })
    expect(pedir(h).permitida).toBe(false)
  })

  it('un permiso programado o vencido NO habilita', () => {
    // CU010 lo dice con esas palabras: solo los vigentes.
    const programado = {
      id_permiso: 8,
      id_colegio: 1,
      id_grado: 3,
      id_periodo_academico: 33,
      modulo: MODULOS.LECTURA,
      inicio: '2026-11-01T00:00:00-05:00',
      fin: '2026-11-05T23:59:59-05:00',
    }
    const vencido = { ...programado, id_permiso: 9, inicio: '2026-10-01T00:00:00-05:00', fin: '2026-10-02T23:59:59-05:00' }

    expect(pedir(base({ permisos: [programado] })).permitida).toBe(false)
    expect(pedir(base({ permisos: [vencido] })).permitida).toBe(false)
  })

  it('la asignación gana al permiso cuando valen las dos', () => {
    /**
     * El permiso es la vía de excepción. Si había asignación, la trazabilidad
     * no debe decir que se corrigió "con permiso excepcional": no hacía falta.
     */
    const h = base({
      asignaciones: [{ id_colegio: 1, id_grado: 3, id_periodo_academico: 33, retroactiva: false }],
      permisos: [
        {
          id_permiso: 7,
          id_colegio: 1,
          id_grado: 3,
          id_periodo_academico: 33,
          modulo: MODULOS.LECTURA,
          inicio: '2026-10-19T00:00:00-05:00',
          fin: '2026-10-25T23:59:59-05:00',
        },
      ],
    })
    expect(pedir(h)).toMatchObject({ motivo: MOTIVO.ASIGNACION })
    expect(pedir(h).id_permiso).toBeUndefined()
  })
})

// D56 — Iniciar la actividad con un permiso y sin asignaciones.
//
// Es el respaldo local de `puede_iniciar_actividad`. Importa porque sin
// actividad no se puede registrar nada, así que equivocarse aquí deja al
// Docente con un permiso que no puede usar para nada.
describe('¿Hay con qué iniciar una actividad?', () => {
  const PERMISO = {
    id_permiso: 7,
    id_colegio: 1,
    id_grado: 3,
    id_periodo_academico: 33,
    modulo: MODULOS.LECTURA,
    inicio: '2026-10-19T00:00:00-05:00',
    fin: '2026-10-25T23:59:59-05:00',
  }

  it('con una asignación, sí', () => {
    const habilitaciones = base({
      asignaciones: [{ id_colegio: 1, id_grado: 3, id_periodo_academico: 33, retroactiva: false }],
    })
    expect(hayHabilitacionParaIniciar({ habilitaciones, instante: AHORA })).toBe(true)
  })

  it('SIN asignaciones pero con un permiso VIGENTE, también', () => {
    // Es el caso del defecto: el único en que el permiso tiene sentido.
    const habilitaciones = base({ permisos: [PERMISO] })
    expect(hayHabilitacionParaIniciar({ habilitaciones, instante: AHORA })).toBe(true)
  })

  it('un permiso que todavía no empezó o que ya venció no habilita', () => {
    const programado = { ...PERMISO, inicio: '2026-10-28T00:00:00-05:00', fin: '2026-10-30T23:59:59-05:00' }
    const vencido = { ...PERMISO, inicio: '2026-10-01T00:00:00-05:00', fin: '2026-10-02T23:59:59-05:00' }
    expect(hayHabilitacionParaIniciar({ habilitaciones: base({ permisos: [programado] }), instante: AHORA })).toBe(false)
    expect(hayHabilitacionParaIniciar({ habilitaciones: base({ permisos: [vencido] }), instante: AHORA })).toBe(false)
  })

  it('sin nada, no', () => {
    expect(hayHabilitacionParaIniciar({ habilitaciones: base(), instante: AHORA })).toBe(false)
    expect(hayHabilitacionParaIniciar({ habilitaciones: null, instante: AHORA })).toBe(false)
  })
})
