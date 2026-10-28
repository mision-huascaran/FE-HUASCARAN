// Programación de clases y reprogramaciones (CU013).
//
// UNA CLASE ES COLEGIO × AÑO ESCOLAR × GRADO × SECCIÓN × FECHA VIGENTE, y
// reúne a los alumnos de los dos subprogramas que estén en esa aula. Eso tiene
// una consecuencia que la tabla tiene que respetar: **una clase mixta aparece
// UNA SOLA VEZ**, también con el filtro de subprograma en "Todos". El filtro
// sirve para encontrarla, no para partirla.
//
// Y REPROGRAMAR NO DUPLICA NADA. La clase conserva su identificador: lo que
// cambia es su fecha vigente. La fecha original queda en el historial, y la
// obligación de asistencia que evalúa CU011 pasa a la fecha nueva, sin dejar
// otra pendiente en la vieja.
//
// NO ES UNA OPERACIÓN OFFLINE. CU013 lo dice expresamente: requiere conexión y
// no se encola. Si una solicitud se queda sin respuesta, se bloquea el reenvío
// hasta saber qué pasó, porque reenviarla podría trasladar la clase dos veces.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'

const { clases } = ENDPOINTS

/** Cómo se nombra el tipo de programación en la tabla (CU013). */
export const ETIQUETA_PROGRAMACION = {
  habitual: 'Habitual',
  reprogramada: 'Reprogramada',
  adicional: 'Adicional',
}

/**
 * Por qué el servidor rechaza una reprogramación, con su texto.
 *
 * Todos van **junto a su campo**: son errores de la fecha nueva o del motivo,
 * y en un aviso general el Supervisor no sabría cuál corregir.
 */
export const MOTIVO_REPROGRAMACION = {
  fecha_sin_cambio: 'Selecciona una fecha distinta de la fecha actual de la clase.',
  fecha_en_receso: 'La nueva fecha corresponde a un periodo de receso.',
  fecha_no_lectiva: 'La nueva fecha no es un día lectivo del calendario del colegio.',
  fecha_de_otro_periodo: 'La nueva fecha debe pertenecer al mismo periodo académico de la clase.',
  fecha_ocupada: 'El grupo ya tiene una clase en esa fecha.',
  validacion: 'Ingresa el motivo de la reprogramación.',
}

/** Qué campo señala cada motivo. Sin esto el mensaje saldría suelto. */
export const CAMPO_DE_MOTIVO = {
  fecha_sin_cambio: 'fecha_nueva',
  fecha_en_receso: 'fecha_nueva',
  fecha_no_lectiva: 'fecha_nueva',
  fecha_de_otro_periodo: 'fecha_nueva',
  fecha_ocupada: 'fecha_nueva',
  validacion: 'motivo',
}

/** Una clase ya reprogramada: su fecha vigente no es la original. */
export const estaReprogramada = (clase) =>
  Boolean(clase?.reprogramada) || (clase?.fecha_original && clase.fecha_original !== clase.fecha)

/**
 * `GET /colegios/{id}/clases` — la programación del mes.
 *
 * `id_programa` es de la tanda A2: filtra por los alumnos de ese subprograma y
 * se aplica ANTES de paginar, así que `total` cuenta solo las filtradas. No
 * crea filas por subprograma.
 */
export const listarClases = ({ idColegio, idGrado, idSeccion, idPrograma, desde, hasta, pagina }) =>
  resolver({
    mock: () => handlers.clases.listar({ idColegio, idGrado, idSeccion, idPrograma, desde, hasta, pagina }),
    real: () =>
      api.get(clases.deColegio(idColegio), {
        params: {
          id_grado: idGrado ? Number(idGrado) : undefined,
          id_seccion: idSeccion ? Number(idSeccion) : undefined,
          id_programa: idPrograma ? Number(idPrograma) : undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
          page: pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /colegios/{id}/clases/reprogramaciones` — trasladar una clase.
 *
 * `version` es la que mostró la consulta, y `null` significa "esta clase
 * todavía no tenía fila". Con ella el servidor detecta que alguien la cambió
 * entre que se abrió el modal y se pulsó Guardar, en vez de dejar que el
 * segundo traslado pise al primero sin que nadie se entere.
 */
export const reprogramarClase = (idColegio, { idGrado, idSeccion, fechaOriginal, fechaNueva, motivo, version }) =>
  resolver({
    mock: () =>
      handlers.clases.reprogramar(idColegio, { idGrado, idSeccion, fechaOriginal, fechaNueva, motivo, version }),
    real: () =>
      api.post(clases.reprogramar(idColegio), {
        id_grado: Number(idGrado),
        id_seccion: Number(idSeccion),
        fecha_original: fechaOriginal,
        fecha_nueva: fechaNueva,
        motivo,
        version: version ?? null,
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /clases/{id}/reprogramaciones` — el historial de traslados.
 *
 * Se conserva entero: una clase puede reprogramarse varias veces y cada
 * traslado deja su fila con quién lo hizo y por qué. Modificar una
 * reprogramación NO sobrescribe la anterior.
 */
export const listarReprogramaciones = (idClase) =>
  resolver({
    mock: () => handlers.clases.reprogramaciones(idClase),
    real: () => api.get(clases.reprogramaciones(idClase)),
    forzarReal: adminContraApiReal,
  })
