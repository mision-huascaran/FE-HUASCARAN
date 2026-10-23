// ¿Puede este Docente ESCRIBIR aquí? (CU009, CU010, CU027, CU028)
//
// Hasta ahora bastaban dos datos: la matriz de `permisos.js` —qué hace cada
// rol— y si había una actividad de trabajo abierta. Eso ya no alcanza. Desde
// CU028 hay TRES caminos por los que un Docente puede escribir en un módulo:
//
//   1. Una ASIGNACIÓN del PA vigente para ese colegio y grado.
//   2. Una asignación RETROACTIVA, que durante el receso permite regularizar
//      el PA inmediatamente anterior.
//   3. Un PERMISO EXCEPCIONAL de CU028, vigente, para ese módulo y alcance.
//
// Y no basta con saber si puede: hay que saber POR CUÁL, porque cada
// corrección guarda el identificador del permiso que la autorizó.
//
// ───────────────────────────────────────────────────────────────────────────
// ESTO ES EL RESPALDO SIN CONEXIÓN, NO LA FUENTE DE VERDAD
// ───────────────────────────────────────────────────────────────────────────
//
// Con conexión NO se usa. El contrato de la semana 11 hace que cada GET de
// módulo —`/asistencias`, `/lectura/tablas`, `/rubricas`, `/registro-vuelo`—
// devuelva su propio bloque `escritura: {permitida, motivo, id_permiso?}`. Esa
// es la respuesta buena, porque la calcula quien tiene los datos.
//
// Lo de aquí solo entra en juego SIN CONEXIÓN, a partir del paquete que
// `GET /me/habilitaciones` dejó guardado en IndexedDB. Es una regla de negocio
// que vive en dos sitios, y eso nunca es gratis, pero la alternativa es peor:
// sin ella, el Docente sin señal no sabría si lo que está escribiendo va a ser
// aceptado hasta que vuelva la red. El backend revalida todo al sincronizar,
// así que esta copia puede equivocarse del lado permisivo sin consecuencias:
// lo que no debía pasar, no pasa.
//
// El periodo aplicable se determina por la FECHA EFECTIVA de la operación
// —la de la clase de referencia, no la del día en que se teclea— y sale del
// calendario de ESE colegio, que puede no coincidir con el de los demás.

/** Los módulos tal como los nombra el contrato. No son los de `permisos.js`. */
export const MODULOS = {
  ASISTENCIAS: 'asistencias',
  LECTURA: 'lectura',
  RUBRICA: 'rubrica',
  REGISTRO_VUELO: 'registro_vuelo',
}

/** Por qué se puede, o por qué no. El motivo viaja con cada escritura. */
export const MOTIVO = {
  ASIGNACION: 'asignacion',
  ASIGNACION_RETROACTIVA: 'asignacion_retroactiva',
  PERMISO: 'permiso',
  SIN_CALENDARIO: 'sin_calendario',
  FUERA_DE_PERIODO: 'fuera_de_periodo',
  SIN_HABILITACION: 'sin_habilitacion',
}

/** Lo que se le dice a la persona. El `motivo` es para programar; esto, para leer. */
export const TEXTO_MOTIVO = {
  [MOTIVO.SIN_CALENDARIO]:
    'No hay calendario descargado para este colegio. Conéctate a Internet para actualizar los datos.',
  [MOTIVO.FUERA_DE_PERIODO]: 'Esa fecha no pertenece a ningún periodo académico de este colegio.',
  [MOTIVO.SIN_HABILITACION]: 'No tienes una habilitación vigente para registrar en este grupo y periodo.',
}

const mismo = (a, b) => a != null && b != null && String(a) === String(b)

/**
 * El periodo de un colegio en una fecha, según el calendario descargado.
 *
 * Es la versión local de `GET /calendarios/periodo`. Devuelve `null` cuando no
 * hay calendario de ese colegio —que NO es lo mismo que "fuera de periodo"— y
 * `{tipo: null}` cuando la fecha cae fuera de todos sus periodos.
 */
export function periodoDe(calendarios, idColegio, fecha) {
  /**
   * Un colegio puede traer MÁS DE UN calendario: uno por año escolar.
   *
   * `/me/habilitaciones` manda el calendario de cada (colegio, año escolar)
   * que aparezca en alguna habilitación utilizable, y no filtra por "año en
   * curso" porque el receso posterior a PA4 puede caer en el año calendario
   * siguiente. Así que no vale quedarse con el primero del colegio: hay que
   * buscar el que CONTIENE la fecha, que es lo que desempata entre años.
   */
  const delColegio = (calendarios ?? []).filter((c) => mismo(c.id_colegio, idColegio))
  if (!delColegio.length) return null

  let calendario = null
  let periodo = null
  for (const c of delColegio) {
    const encontrado = (c.periodos ?? []).find((p) => fecha >= p.fecha_inicio && fecha <= p.fecha_fin)
    if (encontrado) {
      calendario = c
      periodo = encontrado
      break
    }
  }

  if (!periodo) return { tipo: null, numero: null, id_periodo_academico: null, es_lectivo: false }

  /**
   * Un día no lectivo NO deja de pertenecer a su periodo.
   *
   * Importa para CU028: durante un receso se regulariza el PA anterior, y para
   * eso hay que saber en qué PR se está, no solo que "no es lectivo".
   */
  const noLectivo = (calendario.dias_no_lectivos ?? []).some(
    (d) => fecha >= d.fecha_inicio && fecha <= d.fecha_fin,
  )
  const finDeSemana = [0, 6].includes(new Date(`${fecha}T12:00:00`).getDay())

  return {
    tipo: periodo.tipo,
    numero: periodo.numero,
    id_periodo_academico: periodo.id_periodo_academico ?? null,
    es_lectivo: periodo.tipo === 'PA' && !noLectivo && !finDeSemana,
  }
}

/**
 * ¿Hay habilitación para escribir en (módulo, colegio, grado, fecha)?
 *
 * @param habilitaciones el paquete de `GET /me/habilitaciones`.
 * @param instante       el momento con el que se juzga la vigencia de los
 *   permisos. Se pasa en vez de leer el reloj aquí para que la función siga
 *   siendo pura y para que use la hora del SERVIDOR, no la del dispositivo.
 * @returns `{permitida, motivo, id_permiso?, id_periodo_academico?}`
 */
export function habilitacionPara({ habilitaciones, modulo, idColegio, idGrado, fecha, instante }) {
  const { asignaciones = [], permisos = [], calendarios = [] } = habilitaciones ?? {}

  const periodo = periodoDe(calendarios, idColegio, fecha)
  if (!periodo) return { permitida: false, motivo: MOTIVO.SIN_CALENDARIO }
  if (!periodo.id_periodo_academico) return { permitida: false, motivo: MOTIVO.FUERA_DE_PERIODO }

  const idPeriodo = periodo.id_periodo_academico
  const delGrupo = (x) => mismo(x.id_colegio, idColegio) && mismo(x.id_grado, idGrado)

  /**
   * El orden importa: primero la asignación ordinaria, luego la retroactiva y
   * solo al final el permiso excepcional. Un permiso es la vía de excepción y
   * conviene que la trazabilidad no lo invoque cuando no hacía falta.
   */
  const asignadas = asignaciones.filter((a) => delGrupo(a) && mismo(a.id_periodo_academico, idPeriodo))

  if (asignadas.some((a) => !a.retroactiva)) return { permitida: true, motivo: MOTIVO.ASIGNACION, id_periodo_academico: idPeriodo }

  if (asignadas.some((a) => a.retroactiva)) {
    return { permitida: true, motivo: MOTIVO.ASIGNACION_RETROACTIVA, id_periodo_academico: idPeriodo }
  }

  const momento = instante instanceof Date ? instante.getTime() : Number(instante)
  const vigente = permisos.find(
    (p) =>
      delGrupo(p) &&
      mismo(p.id_periodo_academico, idPeriodo) &&
      mismo(p.modulo, modulo) &&
      // Programado o vencido NO habilita (CU010): solo el que está vigente AHORA.
      Date.parse(p.inicio) <= momento &&
      momento <= Date.parse(p.fin),
  )
  if (vigente) {
    return {
      permitida: true,
      motivo: MOTIVO.PERMISO,
      id_permiso: vigente.id_permiso,
      id_periodo_academico: idPeriodo,
    }
  }

  return { permitida: false, motivo: MOTIVO.SIN_HABILITACION, id_periodo_academico: idPeriodo }
}
