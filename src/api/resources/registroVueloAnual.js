// Registro de Vuelo (CU031, CU032), contrato de la tanda 9.
//
// CAMBIA LA UNIDAD Y CAMBIA QUIÉN DECIDE QUÉ. Antes era un asistente: se
// aplicaba una prueba, se contaban aciertos sobre un total y de ahí salía un
// nivel. Eso desaparece. Ahora es una fila por alumno y PERIODO ACADÉMICO del
// año, y el reparto de responsabilidades es explícito:
//
//   · EL SERVIDOR CALCULA tres cosas: la ENTRADA (de dónde viene el alumno),
//     la SUGERENCIA (qué dice el motor sobre su última rúbrica completa) y el
//     NIVEL DEL PROGRAMA. Ninguna se manda desde el cliente, y mandarla es un
//     422 del lote entero, no un campo que se ignore.
//   · EL DOCENTE REGISTRA tres: el nivel COLOCADO, la PROYECCIÓN y la
//     observación. La sugerencia es una sugerencia: colocar la misma letra que
//     la entrada también es una decisión, y se guarda como tal.
//
// LA HABILITACIÓN ES POR PA, no por módulo. Tener permiso en PA2 no habilita
// PA3: por eso `escritura` llega una vez por periodo y no una por alumno.
//
// Y EL NIVEL COLOCADO NO SE PUEDE DESHACER a "sin nivel". Una vez que hay una
// decisión, se puede cambiar de letra pero no volver al vacío: la fila del PA
// siguiente se construye sobre ella.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { registroVuelo } = ENDPOINTS

/** Estado de un PA en el calendario del colegio. */
export const ESTADO_PERIODO = {
  futuro: { texto: 'No empieza aún', tono: 'neutral' },
  en_curso: { texto: 'En curso', tono: 'success' },
  culminado: { texto: 'Culminado', tono: 'neutral' },
}

/**
 * De dónde sale la entrada de un periodo.
 *
 * `pendiente_periodo_anterior` es el que importa: significa que el PA anterior
 * no tiene nivel colocado todavía. NO se cae a la letra del grado —eso solo
 * vale para PA1—, porque daría por buena una entrada inventada y arrastraría
 * el error a todos los periodos siguientes.
 */
export const ORIGEN_ENTRADA = {
  grado: 'Nivel inicial según el grado del alumno.',
  periodo_anterior: 'Proviene del nivel colocado en el periodo anterior.',
  pendiente_periodo_anterior: 'Pendiente del periodo anterior',
}

/** Las acciones del motor de sugerencias. */
export const ACCION_SUGERIDA = {
  bajar: { texto: 'Bajar nivel', tono: 'warning' },
  mantener: { texto: 'Mantener nivel', tono: 'neutral' },
  subir: { texto: 'Subir nivel', tono: 'success' },
}

/**
 * Por qué el servidor rechaza UNA decisión del lote.
 *
 * `nivel_invalido` viene con `registro.campo`: sin ese dato, un rechazo de la
 * proyección parecería un rechazo del nivel colocado.
 */
export const MOTIVO_VUELO = {
  modificacion_concurrente:
    'El registro de este alumno y periodo fue modificado desde que lo consultaste. Revisa la versión actual antes de guardar nuevamente.',
  nivel_invalido: 'Selecciona un nivel válido entre aa y Z.',
  nivel_colocado_obligatorio: 'El nivel colocado ya registrado no se puede quitar; selecciona otro nivel.',
  periodo_futuro: 'No se puede registrar un periodo académico que todavía no empieza.',
  periodo_inexistente: 'El periodo académico no existe.',
  alumno_fuera_del_grupo: 'El estudiante no pertenecía a este grupo en el periodo seleccionado.',
  sin_habilitacion: 'No tienes autorización vigente para registrar o modificar este periodo.',
}

/** Cada PA con nivel colocado vale 25 puntos del avance anual. */
export const PUNTOS_POR_PERIODO = 25

/** El periodo de un alumno, por número de PA. */
export const periodoDe = (alumno, numero) =>
  (alumno?.periodos ?? []).find((p) => Number(p.numero) === Number(numero)) ?? null

/**
 * `GET /registro-vuelo` — una fila por alumno del grupo en el año.
 *
 * Trae a los que PERTENECIERON al grupo en el año, incluidos los que hoy están
 * inactivos: una decisión tomada en PA1 sigue siendo parte del año aunque el
 * alumno se haya ido en PA3.
 */
export const listarRegistroVuelo = ({ idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, pagina = 1 }) =>
  resolver({
    mock: () =>
      handlers.registroVuelo.listar({ idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, pagina }),
    real: () =>
      api.get(registroVuelo.listar, {
        params: {
          id_colegio: Number(idColegio),
          id_programa: Number(idPrograma),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
          id_anio_escolar: Number(idAnioEscolar),
          page: pagina,
        },
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `PUT /registro-vuelo` — el lote de decisiones (máximo 200).
 *
 * Solo viajan los TRES campos del docente. Mandar `entrada`, `sugerencia`,
 * `nivel_programa` o cualquier otro campo desconocido responde 422
 * `validacion` del lote COMPLETO: no es un campo que el servidor ignore, es un
 * error que tira las 200 decisiones. De ahí que esta función construya el
 * cuerpo campo a campo en vez de reenviar la fila.
 */
export const guardarRegistroVuelo = (items) =>
  resolver({
    mock: () => handlers.registroVuelo.guardar(items),
    real: () => api.put(registroVuelo.guardar, items),
    forzarReal: adminContraApiReal,
  })

/**
 * El cuerpo de UNA decisión, con solo lo que el docente puede escribir.
 *
 * Existe para que ninguna pantalla pueda colar por accidente un campo
 * calculado: `entrada` y `sugerencia` están en la misma fila de la que salen
 * `nivel_colocado` y `proyeccion`, así que un `...periodo` las mandaría y el
 * lote entero volvería con un 422.
 */
export function decision({
  idOperacion,
  version,
  realizadoEn,
  idActividad,
  idAlumno,
  idPeriodoAcademico,
  idColegio,
  idGrado,
  idSeccion,
  idPrograma,
  cambios,
}) {
  const permitidos = new Set(['id_nivel_colocado', 'id_nivel_proyeccion', 'observacion'])
  const soloLoSuyo = Object.fromEntries(Object.entries(cambios ?? {}).filter(([campo]) => permitidos.has(campo)))

  return {
    id_operacion: idOperacion,
    version: version ?? null,
    realizado_en: realizadoEn,
    id_actividad: idActividad ?? null,
    id_alumno: idAlumno,
    id_periodo_academico: idPeriodoAcademico,
    id_colegio: Number(idColegio),
    id_grado: Number(idGrado),
    id_seccion: Number(idSeccion),
    id_programa: Number(idPrograma),
    ...soloLoSuyo,
  }
}
