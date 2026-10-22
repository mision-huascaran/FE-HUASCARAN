// Rúbrica MENSUAL (CU029, CU030), contrato de la tanda 8.
//
// LA RÚBRICA SEMANAL YA NO EXISTE. Es una evaluación por alumno y MES, con dos
// dimensiones —Fluidez y Comprensión— en códigos del 0 al 4. El cambio no es
// solo de periodicidad: antes se capturaba por semana junto con la lectura, y
// ahora es su propia pantalla con su propia unidad.
//
// LOS CÓDIGOS SON NÚMEROS Y EL 0 ES UN VALOR. `null` significa "sin evaluar", y
// 0 significa "Pre-inicio": son cosas distintas y confundirlas haría que un
// alumno sin evaluar apareciera como el peor de la clase. Por eso ninguna
// comprobación de este archivo usa la veracidad del número.
//
// Y LA ESCALA DEPENDE DEL SUBPROGRAMA: Alfabetización admite 0 en Fluidez
// —hay alumnos que todavía no reconocen las letras— y Comprensión Lectora
// empieza en 1, porque quien ya está en ese subprograma lee algo por
// definición. Mandar un 0 donde no se admite responde `valor_no_permitido`.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { rubricas } = ENDPOINTS

/** Los cinco niveles, con el nombre que les da la tanda 8. */
export const NIVELES_RUBRICA = [
  { valor: 0, nombre: 'Pre-inicio' },
  { valor: 1, nombre: 'Inicio' },
  { valor: 2, nombre: 'En proceso' },
  { valor: 3, nombre: 'Logrado' },
  { valor: 4, nombre: 'Avanzado' },
]

/**
 * Qué valores admite cada dimensión, por subprograma.
 *
 * Se conoce por el NOMBRE del subprograma y no por su id porque los ids son de
 * la base y cambian entre entornos. El servidor es quien manda: esto solo evita
 * ofrecer en el desplegable una opción que iba a volver rechazada.
 */
export const ESCALA = {
  Alfabetización: { fluidez: [0, 1, 2, 3, 4], comprension: [1, 2, 3, 4] },
  'Comprensión Lectora': { fluidez: [1, 2, 3, 4], comprension: [1, 2, 3, 4] },
}

/** La escala de un subprograma, con la más permisiva como respaldo. */
export const escalaDe = (nombrePrograma) =>
  ESCALA[nombrePrograma] ?? { fluidez: [0, 1, 2, 3, 4], comprension: [1, 2, 3, 4] }

/** Los niveles de una dimensión, ya filtrados por lo que admite el subprograma. */
export const nivelesDe = (nombrePrograma, dimension) => {
  const permitidos = new Set(escalaDe(nombrePrograma)[dimension] ?? [])
  return NIVELES_RUBRICA.filter((n) => permitidos.has(n.valor))
}

export const ESTADO_RUBRICA = {
  pendiente: { texto: 'Pendiente', tono: 'warning' },
  // Una sola dimensión puesta. SE PUEDE GUARDAR: el docente no tiene por qué
  // evaluar las dos cosas en la misma sentada.
  incompleta: { texto: 'Incompleta', tono: 'warning' },
  completada: { texto: 'Completada', tono: 'success' },
}

/**
 * El resultado, que el servidor manda en DÉCIMAS.
 *
 * `resultado_decimas` = 4·Fluidez + 6·Comprensión, o sea F×0,40 + C×0,60
 * expresado en décimas: 26 es 2,6. Viene así para no mandar un decimal por la
 * red y que cada cliente lo redondee a su manera.
 */
export const comoNota = (decimas) => (decimas == null ? null : (decimas / 10).toFixed(1))

/**
 * Por qué el servidor rechaza UNA evaluación del lote.
 *
 * `valor_no_permitido` viene con `registro.campo`, que dice QUÉ dimensión
 * falló: sin ese dato, un rechazo en Comprensión parecería un rechazo de la
 * fila entera.
 */
export const MOTIVO_RUBRICA = {
  valor_no_permitido: 'Selecciona una valoración permitida para esta dimensión.',
  sin_habilitacion:
    'No tienes una habilitación vigente para registrar o modificar las rúbricas del grupo y mes seleccionados.',
  actividad_requerida: 'Debes iniciar una actividad de trabajo para registrar o modificar las rúbricas.',
  modificacion_concurrente:
    'Esta evaluación fue modificada desde que la consultaste. Revisa la versión actual antes de guardar nuevamente.',
  alumno_fuera_del_grupo: 'El estudiante no pertenecía a este grupo en el mes seleccionado.',
  mes_futuro: 'No es posible evaluar meses futuros.',
  mes_sin_actividad:
    'El mes seleccionado no tiene días lectivos de un periodo académico en el calendario del colegio.',
}

/**
 * Motivos que NO son de una fila sino del mes entero.
 *
 * Llegan como un 422 del GET y la pantalla los pinta como un estado —no se
 * puede evaluar ese mes— y no como un error técnico: no hay nada que corregir,
 * solo otro mes que elegir.
 */
export const esMotivoDeMes = (motivo) => motivo === 'mes_futuro' || motivo === 'mes_sin_actividad'

/**
 * `GET /rubricas` — las evaluaciones del grupo en un mes. Paginado de 40.
 *
 * Trae a los alumnos que CORRESPONDE evaluar ese mes, incluidos los que hoy
 * están inactivos: la evaluación es del mes, y quien estuvo entonces cuenta.
 */
export const listarRubricas = ({
  idColegio,
  idPrograma,
  idGrado,
  idSeccion,
  idAnioEscolar,
  mes,
  pagina = 1,
}) =>
  resolver({
    mock: () =>
      handlers.rubricas.listar({ idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, pagina }),
    real: () =>
      api.get(rubricas.listar, {
        params: {
          id_colegio: Number(idColegio),
          id_programa: Number(idPrograma),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
          id_anio_escolar: Number(idAnioEscolar),
          mes: Number(mes),
          page: pagina,
        },
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PUT /rubricas` — el lote de evaluaciones (máximo 200).
 *
 * Una dimensión OMITIDA no cambia; en `null` se borra. Y `version` es la que
 * mostró el GET, o `null` si el alumno todavía no tenía evaluación: es con eso
 * con lo que el servidor detecta que otro docente la cambió entre medias.
 */
export const guardarRubricas = (items) =>
  resolver({
    mock: () => handlers.rubricas.guardar(items),
    real: () => api.put(rubricas.guardar, items),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /rubricas/criterios` — los descriptores pedagógicos del ciclo.
 *
 * NO SE ESCRIBEN EN EL CÓDIGO (RN-011): son material pedagógico, los mantiene
 * Misión Huascarán y cambian sin que nadie toque el front. Un subprograma que
 * no se dicta en ese ciclo —Alfabetización en IV o V— devuelve lista vacía.
 */
export const obtenerCriterios = ({ idPrograma, idCiclo }) =>
  resolver({
    mock: () => handlers.rubricas.criterios({ idPrograma, idCiclo }),
    real: () =>
      api.get(rubricas.criterios, {
        params: { id_programa: Number(idPrograma), id_ciclo: Number(idCiclo) },
      }),
    forzarReal: adminContraApiReal,
  })
