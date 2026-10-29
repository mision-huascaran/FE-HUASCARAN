// Permisos excepcionales de corrección (CU028).
//
// Sirven para una situación concreta: un periodo cuyo plazo ordinario de
// regularización ya terminó y que, aun así, hay que corregir. El Supervisor
// autoriza a UN Docente, para UN módulo, UN colegio, UN grado y UN periodo,
// con fecha y hora de caducidad y un motivo obligatorio.
//
// Tres reglas que condicionan las pantallas:
//
//   · UN PERMISO, UN MÓDULO. Para habilitar otro hace falta otro permiso. No
//     es un descuido del contrato: es lo que permite que la trazabilidad diga
//     exactamente qué se autorizó.
//   · NO SE EDITAN NI SE BORRAN. Solo se otorgan y se revocan, y la revocación
//     deja su propio rastro —quién, cuándo y por qué—.
//   · EL ESTADO SE CALCULA, no se guarda: `programado` antes del inicio,
//     `vigente` mientras dura, `vencido` después, `revocado` si lo cortaron.
//     Por eso no hay que refrescar nada para que un permiso caduque.
//
// Todo exige conexión: no hay versión offline de esto, ni debe haberla.
import { api, resolver, adminContraApiReal } from '../client'
import ENDPOINTS from '../endpoints'
import handlers from '../mock/handlers'
import { normalizarPaginado } from './administracion'
import { formatearFechaHora } from '../../lib/format'

const { permisos } = ENDPOINTS

/** Los módulos que un permiso puede habilitar, con el nombre que ve la gente. */
export const MODULOS_PERMISO = [
  { value: 'asistencias', label: 'Asistencias' },
  { value: 'lectura', label: 'Seguimiento de Lectura' },
  { value: 'rubrica', label: 'Rúbrica' },
  { value: 'registro_vuelo', label: 'Registro de Vuelo' },
]

export const ETIQUETA_MODULO = Object.fromEntries(MODULOS_PERMISO.map((m) => [m.value, m.label]))

/** Los cuatro estados calculados, en el orden en que se entienden. */
export const ESTADOS_PERMISO = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'programado', label: 'Programado' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'revocado', label: 'Revocado' },
]

export const ETIQUETA_ESTADO_PERMISO = Object.fromEntries(ESTADOS_PERMISO.map((e) => [e.value, e.label]))

/**
 * El color de cada estado.
 *
 * `programado` va en info y no en verde: todavía no habilita nada, y pintarlo
 * como vigente haría creer que el Docente ya puede corregir.
 */
export const TONO_ESTADO_PERMISO = {
  vigente: 'success',
  programado: 'info',
  vencido: 'neutral',
  revocado: 'danger',
}

/** `GET /usuarios/{id}/permisos` — paginado de 40, del más reciente al más antiguo. */
export const listarPermisos = async (idUsuario, filtros = {}) => {
  const datos = await resolver({
    mock: () => handlers.permisos.listar(idUsuario, filtros),
    real: () =>
      api.get(permisos.deUsuario(idUsuario), {
        params: {
          id_anio_escolar: filtros.id_anio_escolar || undefined,
          id_colegio: filtros.id_colegio || undefined,
          id_periodo_academico: filtros.id_periodo_academico || undefined,
          modulo: filtros.modulo || undefined,
          estado: filtros.estado || undefined,
          page: filtros.pagina || undefined,
        },
      }),
    forzarReal: adminContraApiReal,
  })
  return normalizarPaginado(datos, 40)
}

/** `GET /usuarios/{id}/permisos/{id}` — con el motivo y los datos de revocación. */
export const obtenerPermiso = (idUsuario, idPermiso) =>
  resolver({
    mock: () => handlers.permisos.detalle(idUsuario, idPermiso),
    real: () => api.get(permisos.detalle(idUsuario, idPermiso)),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /usuarios/{id}/permisos` — otorgar.
 *
 * `desde_ahora` evita un problema real: si el Supervisor escribe la hora de
 * inicio a mano y tarda un minuto en darle a guardar, el servidor la rechaza
 * por estar en el pasado. Con `desde_ahora: true` la pone él.
 */
/**
 * La fecha y hora de un `<input type="datetime-local">`, CON ZONA.
 *
 * El control devuelve "2026-10-27T12:39": hora local y sin offset. Mandarlo
 * así era D76, el defecto que impedía otorgar cualquier permiso —el servidor
 * no podía comparar una fecha sin zona con una con zona y respondía 500—.
 *
 * El backend ya lo tolera e interpreta esas horas como de Lima, pero se sigue
 * mandando con zona: `new Date(valor)` lo lee en la zona del equipo, que es la
 * del Supervisor que lo escribe, y `toISOString()` lo convierte al instante
 * exacto. Así no dependemos de cómo decida interpretarlo el servidor.
 */
const conZona = (valor) => {
  if (!valor) return valor
  const instante = new Date(valor)
  return Number.isNaN(instante.getTime()) ? valor : instante.toISOString()
}

export const otorgarPermiso = (idUsuario, datos) =>
  resolver({
    mock: () => handlers.permisos.otorgar(idUsuario, datos),
    real: () =>
      api.post(permisos.otorgar(idUsuario), {
        id_anio_escolar: Number(datos.id_anio_escolar),
        id_colegio: Number(datos.id_colegio),
        id_grado: Number(datos.id_grado),
        id_periodo_academico: Number(datos.id_periodo_academico),
        modulo: datos.modulo,
        // `desde_ahora` viaja siempre, también en false: es el campo con el
        // que el servidor decide si la hora de inicio la pone él.
        desde_ahora: Boolean(datos.desde_ahora),
        ...(datos.desde_ahora ? {} : { inicio: conZona(datos.inicio) }),
        fin: conZona(datos.fin),
        motivo: datos.motivo,
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * `POST /usuarios/{id}/permisos/lote` — varios de una vez (tanda I).
 *
 * SIGUE CREANDO UN PERMISO POR COMBINACIÓN: CU028 exige que cada uno
 * autorice un solo módulo. Lo que cambia es que se piden juntos, con el
 * alcance común —año, colegio, periodo, vigencia y motivo— una sola vez.
 *
 * ES ATÓMICO (todos o ninguno), y por eso existe en vez de un bucle en el cliente. Con N
 * peticiones sueltas, que la cuarta choque con un permiso superpuesto deja
 * tres creados que el Supervisor no pidió y que **no se pueden deshacer**:
 * un permiso no se borra, se revoca.
 */
export const otorgarPermisosEnLote = (idUsuario, datos) =>
  resolver({
    mock: () => handlers.permisos.otorgarLote(idUsuario, datos),
    real: () =>
      api.post(permisos.otorgarLote(idUsuario), {
        id_anio_escolar: Number(datos.id_anio_escolar),
        id_colegio: Number(datos.id_colegio),
        id_periodo_academico: Number(datos.id_periodo_academico),
        desde_ahora: Boolean(datos.desde_ahora),
        ...(datos.desde_ahora ? { inicio: null } : { inicio: conZona(datos.inicio) }),
        fin: conZona(datos.fin),
        motivo: datos.motivo,
        combinaciones: (datos.combinaciones ?? []).map(({ id_grado: idGrado, modulo }) => ({
          id_grado: Number(idGrado),
          modulo,
        })),
      }),
    forzarReal: adminContraApiReal,
  })

/**
 * Las combinaciones que el servidor rechazó, por índice.
 *
 * Un lote fallido responde con el motivo de la PRIMERA que falló, pero trae
 * `combinaciones_rechazadas[]` con todas. Se devuelve un mapa por `indice`
 * para poder señalar **cada** fila del modal y no solo una: si fallan tres,
 * corregir una y reintentar volvería a fallar por las otras dos.
 */
export const combinacionesRechazadas = (error) => {
  const lista = error?.response?.data?.combinaciones_rechazadas
  if (!Array.isArray(lista)) return {}
  return lista.reduce((mapa, item) => {
    if (item?.indice == null) return mapa
    return { ...mapa, [item.indice]: textoDeRechazoDeCombinacion(item) }
  }, {})
}

/**
 * D77 — Una superposición dice CON QUÉ choca: CU028 pide las fechas del
 * permiso existente, que el servidor manda en `permiso_existente`. Sin ellas
 * el Supervisor tiene que salir del modal a buscarlo.
 */
function textoDeRechazoDeCombinacion(item) {
  const texto = item.detail ?? item.motivo ?? 'No se pudo crear.'
  const existente = item.permiso_existente
  if (!existente?.inicio || !existente?.fin) return texto
  return `${texto} Permiso existente: del ${formatearFechaHora(existente.inicio)} al ${formatearFechaHora(existente.fin)}.`
}

/**
 * `POST /usuarios/{id}/permisos/{id}/revocar`.
 *
 * POST y no PATCH porque es una ACCIÓN, no una edición parcial: no se cambia
 * un campo del permiso, se corta su vigencia y se registra quién lo hizo.
 */
export const revocarPermiso = (idUsuario, idPermiso, motivo) =>
  resolver({
    mock: () => handlers.permisos.revocar(idUsuario, idPermiso, motivo),
    real: () => api.post(permisos.revocar(idUsuario, idPermiso), { motivo }),
    forzarReal: adminContraApiReal,
  })

/**
 * `GET /permisos/opciones` — los periodos que YA admiten permiso.
 *
 * Son aquellos cuyo plazo ordinario terminó, es decir, cuyo PR ya pasó. Hace
 * falta pedirlos en vez de ofrecer los cuatro PA: un periodo que todavía se
 * puede regularizar por la vía normal se rechaza con "este periodo no requiere
 * un permiso excepcional", y ofrecerlo sería invitar a ese error.
 */
export const opcionesDePermiso = ({ idColegio, idAnioEscolar }) =>
  resolver({
    mock: () => handlers.permisos.opciones({ idColegio, idAnioEscolar }),
    real: () =>
      api.get(permisos.opciones, {
        params: {
          id_colegio: Number(idColegio),
          ...(idAnioEscolar ? { id_anio_escolar: Number(idAnioEscolar) } : {}),
        },
      }),
    forzarReal: adminContraApiReal,
  })
