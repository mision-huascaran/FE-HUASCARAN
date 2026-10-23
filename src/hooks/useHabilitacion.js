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
//     en IndexedDB, con las reglas de `auth/habilitaciones.js`.
//
// A eso se le suman dos condiciones que son del cliente y no del servidor: que
// haya una ACTIVIDAD DE TRABAJO abierta (CU010) y que la referencia temporal
// sea verificable (CU010 otra vez). Ninguna de las dos la puede comprobar el
// backend por adelantado, así que se juntan aquí y la pantalla recibe una sola
// respuesta en vez de tres condiciones sueltas que acabaría combinando mal.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MOTIVO, TEXTO_MOTIVO, habilitacionPara } from '../auth/habilitaciones'
import { obtenerMisHabilitaciones } from '../api/resources/habilitaciones'
import { SIN_REFERENCIA_TEMPORAL, ahora, hayContinuidad } from '../lib/relojServidor'
import useActividadStore from '../store/actividadStore'
import useConexion from './useConexion'

/** Motivos propios del cliente, que no vienen del contrato. */
export const MOTIVO_LOCAL = {
  SIN_ACTIVIDAD: 'sin_actividad',
  SIN_REFERENCIA: 'sin_referencia_temporal',
}

// Literal de CU010, el mismo que usan las cuatro pantallas de registro.
const SIN_ACTIVIDAD = 'Inicia una actividad de trabajo para habilitar el registro de datos.'

const TEXTOS = {
  ...TEXTO_MOTIVO,
  [MOTIVO_LOCAL.SIN_ACTIVIDAD]: SIN_ACTIVIDAD,
  [MOTIVO_LOCAL.SIN_REFERENCIA]: SIN_REFERENCIA_TEMPORAL,
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
  const conActividad = Boolean(useActividadStore((s) => s.sesion))

  /**
   * El paquete local solo se pide cuando puede hacer falta.
   *
   * `staleTime` generoso porque cambia poco —asignaciones, permisos y
   * calendario— y porque su gracia es estar ya descargado cuando se va la red.
   */
  const { data: habilitaciones } = useQuery({
    queryKey: ['me', 'habilitaciones'],
    queryFn: obtenerMisHabilitaciones,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
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

    // Con conexión, lo que diga el servidor.
    if (escrituraDelServidor) {
      const { permitida, motivo, id_permiso: idPermiso } = escrituraDelServidor
      return responder(Boolean(permitida), motivo, { id_permiso: idPermiso })
    }

    if (!modulo || !idColegio || !idGrado || !fecha) return responder(false, MOTIVO.SIN_HABILITACION)

    const local = habilitacionPara({
      habilitaciones,
      modulo,
      idColegio,
      idGrado,
      fecha,
      // La hora del SERVIDOR, no la del dispositivo: de eso va el reloj.
      instante: ahora(),
    })
    return responder(local.permitida, local.motivo, local)
  }, [modulo, idColegio, idGrado, fecha, escrituraDelServidor, exigeActividad, conActividad, enLinea, habilitaciones])
}
