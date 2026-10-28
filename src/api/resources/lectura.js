// Seguimiento de Lectura (CU023 a CU026), contrato de la tanda 7.
//
// LA UNIDAD YA NO ES LA FILA, ES LA TABLA. Antes cada alumno-semana viajaba
// solo y la pantalla era una grilla de filas independientes. Ahora hay un
// objeto propio —la TABLA SEMANAL— que existe o no existe, se crea a mano, se
// puede marcar "no realizada" y tiene su `version`. Eso cambia el orden de
// las cosas: primero se pregunta si la tabla existe, y solo después hay filas.
//
// UNA TABLA ES: grupo (colegio, grado, sección) × subprograma × semana, atada a
// una CLASE DE REFERENCIA de esa semana. Dos consecuencias que no son obvias:
//
//   · El MES de la tabla es el de su clase de referencia, no el de la semana.
//     Una semana partida entre junio y julio aparece entera en el mes de su
//     clase; si no, la misma semana saldría dos veces y nadie sabría en cuál
//     registrar.
//   · Las FILAS son la lista histórica de esa clase filtrada por el
//     subprograma. O sea: quién estaba en la clase ese día, no quién está hoy.
//     Por eso un alumno dado de baja sigue apareciendo.
//
// Y LA LECTURA DEPENDE DE LA ASISTENCIA. Sin presente o tardanza en la clase de
// referencia no se pueden registrar libros: el servidor rechaza la fila con
// `sin_asistencia`. La observación sí se admite siempre —salvo tabla "no
// realizada"—, porque justificar una falta es justo lo que hace falta ahí.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { lectura } = ENDPOINTS

/** Los dos máximos que admite un LSN. No hay otros (CU024). */
export const MAXIMOS_LSN = [5, 10]

/**
 * Estado de una fila, tal como lo calcula el SERVIDOR.
 *
 * No se recalcula en el cliente: la regla mezcla la asistencia de la clase de
 * referencia con el estado de la tabla, y duplicarla aquí solo daría dos
 * verdades distintas. Esto es la traducción a palabras.
 */
export const ESTADO_FILA = {
  completada: { texto: 'Completada', tono: 'success' },
  pendiente: { texto: 'Pendiente', tono: 'warning' },
  // Ausente, o la tabla entera marcada como no realizada: no hay nada que
  // registrar y la fila no cuenta como un pendiente del docente.
  no_aplica: { texto: 'No aplica', tono: 'neutral' },
}

/**
 * Por qué el servidor rechaza UNA fila del lote.
 *
 * `modificacion_concurrente` está aquí y no entre los errores del lote a
 * propósito: en este endpoint no es un 409 sino un rechazo por ítem, y viene
 * con el registro vigente para poder adoptarlo.
 */
export const MOTIVO_FILA = {
  sin_asistencia:
    'El estudiante debe tener asistencia Presente o Tardanza en la clase de referencia para registrar su lectura.',
  lsn_incompleto: 'Para registrar un LSN, completa el título, la nota obtenida y el puntaje máximo.',
  lsn_invalido: 'Selecciona un máximo de 5 o 10 e ingresa una nota entre 0 y ese máximo.',
  alumno_fuera_de_la_tabla: 'El estudiante no corresponde a la clase de referencia de esta tabla semanal.',
  sin_habilitacion: 'No tienes una habilitación vigente para registrar o corregir la lectura de esta semana.',
  lectura_no_realizada: 'La lectura semanal de esta tabla fue marcada como no realizada.',
  modificacion_concurrente:
    'Este registro de lectura fue modificado desde que lo consultaste. Revisa la versión actual antes de guardar nuevamente.',
}

/**
 * ¿El 404 de la tabla significa "no existe todavía"?
 *
 * Es la distinción que ordena la pantalla. Un 404 con `tabla_no_existe` NO es
 * un error: es la respuesta normal de una semana en la que el docente aún no
 * ha creado la tabla, y trae lo necesario para crearla —la clase sugerida y el
 * bloque `escritura`—. Tratarlo como fallo dejaría al docente sin el botón de
 * crear, que es lo único que puede hacer ahí.
 */
export const esTablaPorCrear = (error) => error?.response?.data?.motivo === 'tabla_no_existe'

/** Los datos de un 404 `tabla_no_existe`: clase sugerida y permiso de escritura. */
export const datosParaCrear = (error) => {
  const datos = error?.response?.data
  if (!esTablaPorCrear(error)) return null
  return {
    claseSugerida: datos.clase_referencia_sugerida ?? null,
    escritura: datos.escritura ?? null,
  }
}

/**
 * `GET /lectura/tablas` — la tabla de la semana, o un 404 que dice cómo crearla.
 *
 * Los siete filtros son obligatorios: sin subprograma y sin mes la tabla no
 * está determinada.
 */
export const obtenerTabla = ({ idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana }) =>
  resolver({
    mock: () =>
      handlers.lectura.tabla({ idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana }),
    real: () =>
      api.get(lectura.tablas, {
        params: {
          id_colegio: Number(idColegio),
          id_programa: Number(idPrograma),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
          id_anio_escolar: Number(idAnioEscolar),
          mes: Number(mes),
          id_semana: Number(idSemana),
        },
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /lectura/tablas` — crear la tabla.
 *
 * Nunca se crea sola: CU023 lo pide explícitamente, porque crear una tabla
 * CONGELA la lista de alumnos de su clase de referencia —y si la clase no
 * tenía fila, la crea—. Eso es una decisión del docente, no un efecto
 * secundario de abrir una pantalla.
 *
 * Sin clase indicada usa la sugerida. Para elegir otra va `idClaseReferencia`
 * **o** `fechaClaseReferencia`, nunca las dos: la fecha existe para poder
 * elegir una clase habitual que todavía no tiene fila.
 */
export const crearTabla = ({
  idOperacion,
  realizadoEn,
  idActividad,
  idColegio,
  idPrograma,
  idGrado,
  idSeccion,
  idAnioEscolar,
  mes,
  idSemana,
  idClaseReferencia,
  fechaClaseReferencia,
}) => {
  const cuerpo = {
    id_operacion: idOperacion,
    realizado_en: realizadoEn,
    id_actividad: idActividad ?? null,
    id_colegio: Number(idColegio),
    id_programa: Number(idPrograma),
    id_grado: Number(idGrado),
    id_seccion: Number(idSeccion),
    id_anio_escolar: Number(idAnioEscolar),
    mes: Number(mes),
    id_semana: Number(idSemana),
    // Los dos campos viajan siempre, uno en null: el contrato prohíbe mandar
    // ambos con valor, no mandar ambos declarados.
    id_clase_referencia: idClaseReferencia ?? null,
    fecha_clase_referencia: idClaseReferencia ? null : (fechaClaseReferencia ?? null),
  }
  return resolver({
    mock: () => handlers.lectura.crear(cuerpo),
    real: () => api.post(lectura.crear, cuerpo),
    forzarReal: adminContraApiReal,
  })
}

/**
 * `PATCH /lectura/tablas/{id}/clase-referencia` — cambiar de clase.
 *
 * Solo mientras no haya datos de lectura guardados: cambiarla regenera las
 * filas, y con libros dentro eso sería perderlos. El servidor lo rechaza con
 * 409 `tabla_con_datos`, y las observaciones NO cuentan como datos.
 */
export const cambiarClaseReferencia = (idTabla, { idOperacion, version, idClase, fecha }) =>
  resolver({
    mock: () => handlers.lectura.claseReferencia(idTabla, { idOperacion, version, idClase, fecha }),
    real: () =>
      api.patch(lectura.claseReferencia(idTabla), {
        id_operacion: idOperacion,
        version,
        ...(idClase ? { id_clase: Number(idClase) } : { fecha }),
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PUT /lectura/tablas/{id}/filas` — el lote de filas (máximo 200).
 *
 * Un campo OMITIDO no cambia; un campo en `null` se BORRA. La diferencia
 * importa: enviar la fila entera con los campos que no se tocaron en null
 * borraría datos que el docente no quiso borrar.
 *
 * Responde un `ResultadoOperacion` por ítem y puede venir medio aceptado.
 */
export const guardarFilas = (idTabla, filas) =>
  resolver({
    mock: () => handlers.lectura.guardarFilas(idTabla, filas),
    real: () => api.put(lectura.filas(idTabla), filas),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /lectura/tablas/{id}/no-realizada` — CU026.
 *
 * Bloquea los datos de lectura Y las observaciones, y pone todas las filas en
 * `no_aplica`: si no se dio la clase, no hay nada pendiente que reclamarle al
 * docente. El motivo es obligatorio.
 */
export const marcarNoRealizada = (idTabla, { idOperacion, version, realizadoEn, motivo }) =>
  resolver({
    mock: () => handlers.lectura.noRealizada(idTabla, { idOperacion, version, realizadoEn, motivo }),
    real: () =>
      api.post(lectura.noRealizada(idTabla), {
        id_operacion: idOperacion,
        version,
        realizado_en: realizadoEn,
        motivo,
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /lectura/tablas/{id}/habilitar-registro` — deshacer la declaración de
 * "no realizada" (CU026, tanda D).
 *
 * NO BORRA NADA. La declaración anterior se queda en `declaraciones` con su
 * motivo de corrección, quién la revirtió y cuándo: el Supervisor que revise
 * después tiene que poder ver que esa semana estuvo declarada y por qué dejó
 * de estarlo.
 *
 * Tampoco amplía el plazo: si la semana ya venció, la tabla vuelve a contar
 * como vencida en CU011. Habilitar el registro no es una prórroga.
 */
export const habilitarRegistroLectura = (idTabla, { idOperacion, version, realizadoEn, idActividad, motivo }) =>
  resolver({
    mock: () => handlers.lectura.habilitarRegistro(idTabla, { idOperacion, version, realizadoEn, motivo }),
    real: () =>
      api.post(lectura.habilitarRegistro(idTabla), {
        id_operacion: idOperacion,
        version,
        realizado_en: realizadoEn,
        id_actividad: idActividad ?? null,
        motivo,
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * Los textos EXACTOS de los dos conflictos de CU026, y qué ofrecer ante ellos.
 *
 * Los dos se resuelven igual: volver a pedir la tabla. Ninguno se reintenta
 * solo —reintentar un choque de versiones solo lo repite— y en los dos la
 * salida es "Consultar versión actual".
 */
export const CONFLICTO_TABLA = {
  declaracion_no_vigente: 'La lectura ya no figura como no realizada. Consulta la versión actual.',
  modificacion_concurrente:
    'Esta tabla de lectura semanal fue modificada desde que la consultaste. Revisa la versión actual antes de guardar nuevamente.',
}
