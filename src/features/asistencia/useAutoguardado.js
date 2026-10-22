// Auto-save de la asistencia (CU022, Arquitectura de Guardado Automático).
//
// No hay botón de guardar. Cada clic en el Segmented Control pinta la fila al
// instante y manda su micro-paquete. Lo delicado no es enviarlo, es QUÉ PASA
// CUANDO FALLA: el caso de uso pide revertir el control a su estado
// inmediatamente anterior y avisar, con dos mensajes distintos según el fallo
// sea local o del servidor.
//
// De ahí que se guarde `previo` antes de tocar nada: sin él, "deshacer" sería
// adivinar, y al tercer clic seguido ya no habría a qué volver.
//
// Hay un tercer desenlace que no es un error, y en la tanda 6 cambió de forma:
// el ítem vuelve ACEPTADA con `motivo: "registro_mas_reciente"`. Significa que
// otro dispositivo guardó algo posterior para ese alumno. Antes llegaba como
// `aplicado: false`, que se leía como un fallo y no lo es: la operación se
// procesó, solo que ganó la otra. No se revierte al valor anterior —sería
// volver a algo aún más viejo—, se adopta el registro que devuelve el servidor.
//
// Y hay un CUARTO: un lote puede responder 200 con ítems RECHAZADOS dentro.
// Eso sí deshace el clic, porque ese registro no se aplicó.
//
// La cola offline hace el resto. Su clave es LA CLASE y el alumno, así que un
// alumno nunca tiene dos envíos contradictorios esperando: el último sustituye
// al anterior. Es también lo que hace que una ráfaga de clics sobre el mismo
// alumno cuente como UN cambio en la métrica de productividad (CU021).
//
// OJO CON EL SUBPROGRAMA: no forma parte de la clave. Un alumno tiene UN solo
// registro de asistencia por clase (CU022), no uno por subprograma. Si entrara
// en la clave, cambiar el filtro de Subprograma generaría un segundo envío
// para la misma persona y el mismo día.
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { encolar } from '../../lib/colaOffline'
import { motivoDe } from '../../api/client'
import { TIPOS_ENVIO, claveDeMarca } from '../../hooks/useOfflineQueue'
import { SIN_REFERENCIA_TEMPORAL, ahora, hayContinuidad } from '../../lib/relojServidor'
import useConexion from '../../hooks/useConexion'

// Literales de CU022. Se escriben tal cual porque el caso de uso los da como
// "el mensaje exacto" y el probador los comprueba palabra por palabra.
export const ERROR_LOCAL = 'Error al guardar la asistencia localmente. Inténtelo nuevamente.'
export const ERROR_SERVIDOR =
  'El servidor rechazó el registro de asistencia. Verifique su conexión o contacte al Supervisor.'

/** Sin marcar: ni presente, ni tardanza, ni ausente. Es un estado, no un hueco. */
const sinMarcar = (estado) => estado == null

/**
 * El momento REAL del clic, con zona.
 *
 * Sale del reloj corregido con el desfase del servidor, no del reloj del
 * equipo: CU022 lo exige y es lo que evita que un envío encolado una hora se
 * registre con la hora de la sincronización en vez de la del aula.
 */
const momentoDelClic = () => ahora().toISOString()

/** Lo que el servidor confirmó; si omite un campo, vale lo que se envió. */
const confirmadoPor = (guardado, enviado) => ({
  estado: 'estado' in guardado ? guardado.estado ?? null : enviado.estado,
  observacion: 'observacion' in guardado ? guardado.observacion ?? null : enviado.observacion,
})

/** La clase en caché con un alumno actualizado. */
const conAlumno = (clase, idAlumno, marca) =>
  clase?.alumnos
    ? { ...clase, alumnos: clase.alumnos.map((a) => (a.id_alumno === idAlumno ? { ...a, ...marca } : a)) }
    : clase

/**
 * @param alumnos  los de la clase, tal como llegan del servidor.
 * @param activo   false para el Supervisor y para los días no editables: CU022
 *   le desactiva el Auto-save por completo, ni PostgreSQL ni IndexedDB.
 * @param claveClase la queryKey de la clase: lo que el servidor confirma se
 *   escribe ahí, o al volver a la pantalla se vería lo de antes hasta un F5.
 */
export default function useAutoguardado({ alumnos = [], fecha, idColegio, idGrado, idSeccion, activo, claveClase }) {
  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()

  /**
   * Lo que este navegador ha cambiado por encima de lo que vino del servidor,
   * atado a SU clase: cambiar de fecha o de aula no puede arrastrar las marcas
   * de la anterior.
   *
   * El subprograma NO entra: es un filtro de la vista, no otra clase. Si
   * entrara, cambiar el filtro borraría de la pantalla lo que se acaba de
   * marcar, que es justo lo que CU022 prohíbe ("cambiar el filtro conserva las
   * asistencias ya registradas").
   */
  const clase = `${fecha}|${idSeccion}`
  const [cambios, setCambios] = useState({ clase, locales: {} })
  const locales = useMemo(() => (cambios.clase === clase ? cambios.locales : {}), [cambios, clase])

  /** El estado y la observación que se ven ahora mismo para un alumno. */
  const marcaDe = useCallback(
    (alumno) => locales[alumno.id_alumno] ?? { estado: alumno.estado ?? null, observacion: alumno.observacion ?? null },
    [locales],
  )

  const escribir = useCallback(
    (idAlumno, marca) =>
      setCambios((previos) => ({
        clase,
        locales: { ...(previos.clase === clase ? previos.locales : {}), [idAlumno]: marca },
      })),
    [clase],
  )

  /**
   * Manda un cambio de UN alumno y lo revierte si no se puede.
   *
   * `campos` lleva `estado`, `observacion` o ambos: lo que se omite no se toca
   * en el servidor, así que poner una observación no borra el estado.
   */
  const enviar = useCallback(
    async (alumno, campos) => {
      if (!activo) return null

      /**
       * CU010: sin referencia temporal verificable no se habilitan nuevas
       * escrituras. Solo aplica SIN CONEXIÓN: con red, la propia petición
       * reancla el reloj, así que bloquear por adelantado no protegería de
       * nada y estorbaría. El caso real es recargar la página en el aula, sin
       * señal y con el reloj del equipo cambiado: ahí no hay forma de saber
       * qué hora es, y una marca con fecha inventada es peor que no marcar.
       *
       * La cola de pendientes NO se toca: esos registros se crearon cuando la
       * referencia sí valía y el backend revalida sus fechas al sincronizar.
       */
      if (!enLinea && !hayContinuidad()) {
        toast.error('No se puede registrar la asistencia', SIN_REFERENCIA_TEMPORAL)
        return new Error('sin_referencia_temporal')
      }

      const previo = marcaDe(alumno)
      const siguiente = { ...previo, ...campos }
      escribir(alumno.id_alumno, siguiente)

      try {
        const respuesta = await encolar({
          clave: claveDeMarca(alumno.id_alumno, fecha, idSeccion),
          tipo: TIPOS_ENVIO.ASISTENCIA,
          payload: {
            idColegio,
            idGrado,
            idSeccion,
            fecha,
            /**
             * Un registro es una OPERACIÓN. La cola le pone su `id_operacion`
             * al enviar; `realizado_en` es la hora REAL del clic, no la de la
             * sincronización, y el servidor evalúa la habilitación A ESA HORA:
             * un permiso que venció hoy pero estaba vigente entonces acepta.
             */
            registros: [{ id_alumno: alumno.id_alumno, realizado_en: momentoDelClic(), ...campos }],
          },
          descripcion: `Asistencia de ${alumno.nombre}`,
          // Sin botón de guardar, un apunte local que no queda escrito es un
          // dato perdido en silencio.
          exigePersistencia: true,
        })

        /**
         * El lote responde `resultados`, uno por OPERACIÓN, y puede mezclar
         * aceptados con rechazados. Lo que importa aquí es el de este alumno.
         */
        const mio = respuesta?.resultados?.find((r) => r.registro?.id_alumno === alumno.id_alumno)
        const guardado = mio?.registro

        // Solo lo que el SERVIDOR confirmó: lo encolado offline no resuelve aún.
        if (guardado && claveClase) {
          const confirmado = confirmadoPor(guardado, siguiente)
          queryClient.setQueryData(claveClase, (previa) => conAlumno(previa, alumno.id_alumno, confirmado))
        }

        if (mio?.estado === 'rechazada') {
          // 200 con un ítem rechazado dentro: no es un fallo de red, es que
          // ESE registro no se pudo aplicar. El control vuelve atrás.
          escribir(alumno.id_alumno, previo)
          toast.error('No se registró la asistencia', mio.detail ?? ERROR_SERVIDOR)
          return new Error(mio.motivo ?? 'rechazada')
        }

        if (mio?.motivo === 'registro_mas_reciente') {
          escribir(alumno.id_alumno, {
            estado: guardado?.estado ?? null,
            observacion: guardado?.observacion ?? null,
          })
          toast.info('Otro dispositivo lo registró después', `Se conserva lo último guardado para ${alumno.nombre}.`)
        }
        return null
      } catch (error) {
        // La cola solo rechaza cuando el envío no va a llegar nunca: se
        // agotaron los reintentos, el error no admite reintento, o no se pudo
        // ni apuntar en IndexedDB.
        escribir(alumno.id_alumno, previo)
        const motivo = motivoDe(error)
        toast.error(
          'No se registró la asistencia',
          motivo === 'persistencia_local' ? ERROR_LOCAL : ERROR_SERVIDOR,
        )
        return error
      }
    },
    [activo, enLinea, marcaDe, escribir, fecha, idColegio, idGrado, idSeccion, toast, claveClase, queryClient],
  )

  const marcar = useCallback((alumno, estado) => enviar(alumno, { estado }), [enviar])
  const observar = useCallback(
    // Texto vacío BORRA la observación: el contrato acepta `null` para eso.
    (alumno, texto) => enviar(alumno, { observacion: texto || null }),
    [enviar],
  )

  /**
   * "Marcar todos como presentes" (paso 8).
   *
   * Solo toca a los que están SIN MARCAR. El caso de uso lo subraya: lo que el
   * docente ya decidió a mano no se sobrescribe, ni siquiera para ponerlo en
   * presente.
   */
  const marcarTodosPresentes = useCallback(() => {
    const pendientes = alumnos.filter((a) => sinMarcar(marcaDe(a).estado))
    pendientes.forEach((a) => marcar(a, 'presente'))
    return pendientes.length
  }, [alumnos, marcaDe, marcar])

  return {
    marcaDe,
    marcar,
    observar,
    marcarTodosPresentes,
    sinMarcar: alumnos.filter((a) => sinMarcar(marcaDe(a).estado)).length,
  }
}
