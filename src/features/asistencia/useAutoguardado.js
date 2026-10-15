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
// Hay un tercer desenlace que no es un error: `aplicado: false`. Significa que
// OTRO dispositivo guardó algo más reciente para ese alumno. No se revierte al
// valor anterior —sería volver a algo aún más viejo—, se adopta lo que manda el
// servidor, que es quien tiene la verdad.
//
// La cola offline hace el resto. Su clave es alumno-fecha-programa, así que un
// alumno nunca tiene dos envíos contradictorios esperando: el último sustituye
// al anterior. Es también lo que hace que una ráfaga de clics sobre el mismo
// alumno cuente como UN cambio en la métrica de productividad (CU021).
import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { encolar } from '../../lib/colaOffline'
import { motivoDe } from '../../api/client'
import { TIPOS_ENVIO, claveDeMarca } from '../../hooks/useOfflineQueue'
import { ahora } from '../../lib/relojServidor'

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
export default function useAutoguardado({ alumnos = [], fecha, idPrograma, activo, claveClase }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  // Lo que este navegador ha cambiado por encima de lo que vino del servidor,
  // atado a SU clase: cambiar de fecha o de subprograma no puede arrastrar las
  // marcas de la anterior, porque los ids de alumno se repiten entre clases.
  const clase = `${fecha}|${idPrograma}`
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

      const previo = marcaDe(alumno)
      const siguiente = { ...previo, ...campos }
      escribir(alumno.id_alumno, siguiente)

      try {
        const respuesta = await encolar({
          clave: claveDeMarca(alumno.id_alumno, fecha, idPrograma),
          tipo: TIPOS_ENVIO.ASISTENCIA,
          payload: {
            fecha,
            registros: [{ id_alumno: alumno.id_alumno, id_programa: Number(idPrograma), ...campos }],
            fechaRegistro: momentoDelClic(),
          },
          descripcion: `Asistencia de ${alumno.nombres} ${alumno.apellidos}`,
          // Sin botón de guardar, un apunte local que no queda escrito es un
          // dato perdido en silencio.
          exigePersistencia: true,
        })

        /**
         * `aplicado: false` — otro dispositivo ganó la carrera.
         *
         * No es un error ni se revierte: se adopta lo que devuelve el servidor,
         * porque volver al valor anterior sería retroceder aún más.
         */
        const guardado = respuesta?.registros?.find((r) => r.id_alumno === alumno.id_alumno)
        // Solo lo que el SERVIDOR confirmó: lo encolado offline no resuelve aún.
        if (guardado && claveClase) {
          const confirmado = confirmadoPor(guardado, siguiente)
          queryClient.setQueryData(claveClase, (previa) => conAlumno(previa, alumno.id_alumno, confirmado))
        }
        if (guardado && guardado.aplicado === false) {
          escribir(alumno.id_alumno, { estado: guardado.estado ?? null, observacion: guardado.observacion ?? null })
          toast.info(
            'Otro dispositivo lo registró antes',
            `Se conserva lo último guardado para ${alumno.nombres} ${alumno.apellidos}.`,
          )
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
    [activo, marcaDe, escribir, fecha, idPrograma, toast, claveClase, queryClient],
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
