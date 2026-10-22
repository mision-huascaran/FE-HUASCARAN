// Asistencia por clase (CU022), rehecha contra el contrato de la tanda 6.
//
// UNA CLASE ES COLEGIO × GRADO × SECCIÓN × FECHA. El subprograma es del alumno,
// no de la clase: una clase reúne a los de Alfabetización y a los de
// Comprensión Lectora que estén en esa aula, y cada alumno tiene UN solo
// registro de asistencia. El filtro de subprograma de la pantalla es visual.
//
// LO QUE CAMBIÓ RESPECTO DEL CONTRATO ANTERIOR, que es bastante:
//
//   · `editable` desaparece. En su lugar llega `escritura: {permitida, motivo,
//     id_permiso, aviso_permiso}`, que además dice POR QUÉ no se puede y si lo
//     que habilita es un permiso excepcional.
//   · La respuesta trae `clase`, con su tipo y una `etiqueta` ya redactada
//     —"Clase programada", "Clase reprogramada", "Clase adicional"— y un
//     `aviso` cuando hace falta explicar algo, como que la clase de ese día se
//     trasladó a otro.
//   · Los alumnos vienen con `nombre` entero e `inactivo`. Se van `nombres`,
//     `apellidos`, `activo` y `en_aula`.
//   · `aplicado: false` ya no existe. Cuando otro dispositivo guardó algo más
//     reciente, el ítem vuelve **aceptada** con `motivo: "registro_mas_reciente"`
//     y el registro vigente. Tiene sentido: la operación se procesó, solo que
//     ganó la otra. Y `version` es informativa, no produce 409.
//   · La primera escritura CREA la clase y congela su lista de alumnos.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

/** Los tres estados del Segmented Control, en el orden en que se pintan. */
export const ESTADOS_ASISTENCIA = ['presente', 'tardanza', 'ausente']

/**
 * Las CUATRO fechas que el servidor rechaza, con su texto de respaldo.
 *
 * Llegan como un 422, igual que antes, pero ya no es uno solo: "futura", "en
 * receso", "no lectiva" y "fuera de periodo" son cuatro cosas distintas y la de
 * en medio no se arregla igual que las otras. Son respuestas legítimas del
 * contrato, no fallos, y la pantalla las pinta como un estado.
 *
 * El texto bueno es el `detail` que manda el servidor, y en `fecha_no_lectiva`
 * es imprescindible: su mensaje lleva dentro el motivo concreto ("fin de
 * semana", un feriado, una suspensión) que aquí no se puede saber. Estos son el
 * respaldo para cuando no llega.
 */
export const MOTIVO_FECHA = {
  fecha_futura: 'No se pueden registrar asistencias para fechas futuras.',
  fecha_en_receso: 'La fecha seleccionada corresponde a un periodo de receso.',
  fecha_no_lectiva: 'Día no lectivo. No se permite registrar asistencias para esta fecha.',
  fecha_fuera_de_periodo: 'La fecha seleccionada no pertenece a un periodo académico configurado.',
}

export const esMotivoDeFecha = (motivo) => Object.hasOwn(MOTIVO_FECHA, motivo ?? '')

/**
 * `GET /asistencias` — la clase de una fecha.
 *
 * Ya NO recibe `id_programa`. Devuelve `{clase, alumnos, escritura}`.
 */
export const obtenerClase = ({ idColegio, idGrado, idSeccion, fecha }) =>
  resolver({
    mock: () => handlers.asistencia.clase({ idColegio, idGrado, idSeccion, fecha }),
    real: () =>
      api.get(ENDPOINTS.asistencia.listar, {
        params: {
          id_colegio: Number(idColegio),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
          fecha,
        },
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PUT /asistencias` — guarda uno o varios registros de la misma clase.
 *
 * Cada registro es una OPERACIÓN con su `id_operacion`, su `version` y su
 * `realizado_en`; el lote responde `resultados`, uno por operación, y puede
 * traer aceptados y rechazados a la vez.
 *
 * @param adicional solo `true` cuando el docente confirma que quiere registrar
 *   una clase extra ese día. Sin la marca y sin clase programada, el servidor
 *   rechaza con `sin_clase_programada` en vez de inventarse una.
 */
export const guardarAsistencia = ({ idClase, idColegio, idGrado, idSeccion, fecha, adicional, registros }) =>
  resolver({
    mock: () =>
      handlers.asistencia.guardar({ idClase, idColegio, idGrado, idSeccion, fecha, adicional, registros }),
    real: () =>
      api.put(ENDPOINTS.asistencia.guardar, {
        // Con `id_clase` basta; sin él, la clase se identifica por su clave,
        // porque una clase habitual puede no tener fila todavía.
        ...(idClase
          ? { id_clase: idClase }
          : {
              id_colegio: Number(idColegio),
              id_grado: Number(idGrado),
              id_seccion: Number(idSeccion),
              fecha,
            }),
        ...(adicional ? { adicional: true } : {}),
        registros,
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * Lo que el servidor rechaza de UN registro, además de los motivos comunes.
 *
 * Los de fecha (`MOTIVO_FECHA`) se repiten aquí porque en el PUT llegan por
 * ítem y no como un 422 del lote: la fecha pudo dejar de ser válida entre que
 * se capturó sin señal y que se sincronizó.
 */
export const MOTIVO_REGISTRO = {
  ...MOTIVO_FECHA,
  sin_habilitacion:
    'No tienes una habilitación vigente para registrar o corregir asistencias en la fecha seleccionada.',
  sin_clase_programada: 'No hay una clase programada para esta fecha. Para registrarla, márcala como clase adicional.',
  alumno_fuera_de_la_clase: 'El alumno no está en la lista de esta clase.',
}
