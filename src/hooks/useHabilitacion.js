// ¿Puedo escribir aquí? — la respuesta que usan las pantallas (CU009, CU028).
//
// Hay DOS fuentes y no compiten: se turnan.
//
//   · CON CONEXIÓN manda el servidor. Cada GET de módulo —`/asistencias`,
//     `/lectura/tablas`, `/rubricas`, `/registro-vuelo`— trae su propio bloque
//     `escritura: {permitida, motivo, id_permiso?}`. Esa es la respuesta
//     buena, porque la calcula quien tiene todos los datos. La pantalla se la
//     pasa a este hook en `escrituraDelServidor` y aquí no se discute.
//
//   · SIN CONEXIÓN se deduce del paquete de `GET /me/habilitaciones` guardado
//     en IndexedDB, con las reglas de `auth/habilitaciones.js`. Se lee de
//     IndexedDB al abrir la pantalla, no de la caché de consultas (D95): esa
//     caché también se restaura de una copia, y con ella se dejaba registrar
//     aunque el paquete ya no estuviera en el equipo. Si no está, se bloquea
//     con "No se puede verificar tu habilitación sin conexión…" (CU009, CU022).
//
// A eso se le suman dos condiciones que son del cliente y no del servidor: que
// haya una ACTIVIDAD DE TRABAJO abierta (CU010) y que la referencia temporal
// sea verificable (CU010 otra vez). Ninguna de las dos la puede comprobar el
// backend por adelantado, así que se juntan aquí y la pantalla recibe una sola
// respuesta en vez de tres condiciones sueltas que acabaría combinando mal.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MOTIVO, TEXTO_MOTIVO, habilitacionPara } from '../auth/habilitaciones'
import { habilitacionesGuardadas, obtenerMisHabilitaciones } from '../api/resources/habilitaciones'
import { SIN_ACTIVIDAD } from '../api/resources/sincronizacion'
import { SIN_REFERENCIA_TEMPORAL, ahora, hayContinuidad } from '../lib/relojServidor'
import { useActividadEnCurso } from '../store/actividadStore'
import useSessionStore from '../store/sessionStore'
import { ROLES } from '../auth/roles'
import useConexion from './useConexion'

/** Motivos propios del cliente, que no vienen del contrato. */
export const MOTIVO_LOCAL = {
  SIN_ACTIVIDAD: 'sin_actividad',
  SIN_REFERENCIA: 'sin_referencia_temporal',
  /** D95 — Sin conexión, mientras se busca el paquete en IndexedDB. Sin texto: aún no hay nada que decir. */
  POR_VERIFICAR: 'habilitacion_por_verificar',
  /** D95 — Sin conexión y sin el paquete en IndexedDB. */
  NO_VERIFICABLE: 'habilitacion_no_verificable',
}

/** Literal de CU009 y CU022 (D95). */
export const SIN_HABILITACION_VERIFICABLE =
  'No se puede verificar tu habilitación sin conexión. Conéctate a Internet para actualizar los datos y continuar.'

// El texto de "falta la actividad" es el MISMO que responde el servidor: así
// el docente lee lo mismo cuando la pantalla se lo adelanta y cuando el
// servidor se lo rechaza.
const TEXTOS = {
  ...TEXTO_MOTIVO,
  [MOTIVO_LOCAL.SIN_ACTIVIDAD]: SIN_ACTIVIDAD,
  [MOTIVO_LOCAL.SIN_REFERENCIA]: SIN_REFERENCIA_TEMPORAL,
  [MOTIVO_LOCAL.NO_VERIFICABLE]: SIN_HABILITACION_VERIFICABLE,
}

/**
 * @param modulo  uno de `MODULOS` (`asistencias`, `lectura`, `rubrica`,
 *   `registro_vuelo`). Son los del contrato, no los de `permisos.js`.
 * @param escrituraDelServidor el bloque `escritura` del GET del módulo, si la
 *   pantalla ya lo tiene. Cuando llega, manda.
 * @param exigeActividad false para las pantallas que consultan sin registrar.
 * @returns `{permitida, motivo, texto, id_permiso}` — `texto` es lo que se le
 *   enseña a la persona junto al control deshabilitado, que CU029 pide
 *   visible y no escondido en un tooltip.
 */
export default function useHabilitacion({
  modulo,
  idColegio,
  idGrado,
  fecha,
  escrituraDelServidor = null,
  exigeActividad = true,
}) {
  const enLinea = useConexion()
  // D114 — La fuente única de la actividad (la misma que la cabecera).
  const { enCurso: conActividad } = useActividadEnCurso()
  /**
   * `GET /me/habilitaciones` es solo del Docente: al Supervisor, que abre los
   * mismos módulos en modo consulta, el servidor le responde 403 y quedaba un
   * error en la consola en cada visita. Sin el paquete el resultado es el
   * mismo (no puede registrar), así que a otros roles no se les pide.
   */
  const idRol = useSessionStore((s) => s.usuario?.id_rol)
  const pideHabilitaciones = idRol == null || Number(idRol) === ROLES.PROFESOR

  /**
   * El paquete local solo se pide cuando puede hacer falta.
   *
   * `staleTime` generoso porque cambia poco —asignaciones, permisos y
   * calendario— y porque su gracia es estar ya descargado cuando se va la red.
   */
  const { data: habilitaciones } = useQuery({
    queryKey: ['me', 'habilitaciones'],
    queryFn: obtenerMisHabilitaciones,
    enabled: pideHabilitaciones,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    retry: false,
  })

  /**
   * D95 — Sin conexión, el paquete se busca en IndexedDB cada vez que se abre
   * la pantalla. Raíz propia: no entra en la copia de `cacheConsultas`, que es
   * justo lo que hacía creer que seguía ahí.
   */
  const { data: guardadas, isPending: buscandoGuardadas } = useQuery({
    queryKey: ['habilitaciones-en-equipo'],
    queryFn: async () => (await habilitacionesGuardadas()) ?? null,
    enabled: !enLinea,
    networkMode: 'always',
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  return useMemo(() => {
    const responder = (permitida, motivo, extra = {}) => ({
      permitida,
      motivo,
      texto: permitida ? null : (TEXTOS[motivo] ?? null),
      id_permiso: extra.id_permiso ?? null,
      id_periodo_academico: extra.id_periodo_academico ?? null,
    })

    // Estas dos van ANTES que la autorización: aunque el grupo sea suyo, sin
    // actividad abierta o sin saber qué hora es no se escribe.
    if (exigeActividad && !conActividad) return responder(false, MOTIVO_LOCAL.SIN_ACTIVIDAD)
    if (!enLinea && !hayContinuidad()) return responder(false, MOTIVO_LOCAL.SIN_REFERENCIA)

    /**
     * Sin conexión NO vale el `escritura` que trajo la consulta en caché: es
     * de cuando había red, y un permiso pudo vencer o un periodo cerrarse.
     * Se decide con el paquete del equipo, o no se decide.
     */
    if (!enLinea) {
      if (buscandoGuardadas) return responder(false, MOTIVO_LOCAL.POR_VERIFICAR)
      if (!guardadas) return responder(false, MOTIVO_LOCAL.NO_VERIFICABLE)
    }

    // Con conexión, lo que diga el servidor.
    if (enLinea && escrituraDelServidor) {
      const { permitida, motivo, id_permiso: idPermiso } = escrituraDelServidor
      return responder(Boolean(permitida), motivo, { id_permiso: idPermiso })
    }

    if (!modulo || !idColegio || !idGrado || !fecha) return responder(false, MOTIVO.SIN_HABILITACION)

    const local = habilitacionPara({
      habilitaciones: enLinea ? habilitaciones : guardadas,
      modulo,
      idColegio,
      idGrado,
      fecha,
      // La hora del SERVIDOR, no la del dispositivo: de eso va el reloj.
      instante: ahora(),
    })
    return responder(local.permitida, local.motivo, local)
  }, [
    modulo,
    idColegio,
    idGrado,
    fecha,
    escrituraDelServidor,
    exigeActividad,
    conActividad,
    enLinea,
    habilitaciones,
    guardadas,
    buscandoGuardadas,
  ])
}
