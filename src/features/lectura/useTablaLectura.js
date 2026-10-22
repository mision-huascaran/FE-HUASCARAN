// La tabla de lectura de una semana: existencia, creación y guardado (CU023 a CU026).
//
// EL ORDEN IMPORTA Y NO ES EL HABITUAL. Primero se pregunta si la tabla
// existe; solo si existe hay filas que editar. Un 404 con `tabla_no_existe` NO
// es un error: es la respuesta normal de una semana sin tabla, y trae la clase
// sugerida para poder crearla. Si se tratara como fallo, el docente vería un
// cartel de error en vez del único botón que puede pulsar ahí.
//
// Y LA TABLA NO SE CREA SOLA. CU023 lo pide así porque crearla CONGELA la lista
// de alumnos de su clase de referencia —y crea la clase si no tenía fila—: eso
// es una decisión del docente, no un efecto secundario de abrir una pantalla.
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError, motivoDe } from '../../api/client'
import {
  crearTabla,
  datosParaCrear,
  esTablaPorCrear,
  marcarNoRealizada,
  obtenerTabla,
} from '../../api/resources/lectura'
import { ahora } from '../../lib/relojServidor'
import { conectarConsultas, guardarRegistro } from '../../lib/registrosOffline'
import useActividadStore from '../../store/actividadStore'

/** Un `id_operacion` nuevo por intento del usuario, estable en el reintento. */
const nuevaOperacion = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Un 4xx del lote entero (422 `validacion`, 403…) no se arregla reintentando:
 * se dice. Un corte de red no es un error: el cambio sigue en la cola.
 */
const esDefinitivo = (error) => {
  const estado = error?.response?.status
  return estado != null && estado >= 400 && estado < 500
}

export default function useTablaLectura(filtros) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana } = filtros
  const listos = Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar && mes && idSemana)
  const clave = ['lectura', 'tabla', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana }]
  // Lo que responde la cola (ahora o al reconectar) se escribe en esta caché.
  useEffect(() => conectarConsultas(queryClient), [queryClient])

  const tabla = useQuery({
    queryKey: clave,
    queryFn: () => obtenerTabla(filtros),
    enabled: listos,
    /**
     * El 404 de "no existe todavía" no se reintenta: es una respuesta, no un
     * fallo, y reintentarla tres veces solo retrasaría el botón de crear.
     */
    retry: (intentos, error) => !esTablaPorCrear(error) && intentos < 2,
  })

  const porCrear = esTablaPorCrear(tabla.error) ? datosParaCrear(tabla.error) : null
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['lectura', 'tabla'] })

  const crear = useMutation({
    mutationFn: ({ fechaClaseReferencia, idClaseReferencia } = {}) =>
      crearTabla({
        ...filtros,
        idOperacion: nuevaOperacion(),
        realizadoEn: ahora().toISOString(),
        idActividad,
        idClaseReferencia,
        // Sin clase elegida va la sugerida del 404, que es la habitual o
        // reprogramada de la semana.
        fechaClaseReferencia: fechaClaseReferencia ?? porCrear?.claseSugerida?.fecha ?? null,
      }),
    onSuccess: (creada) => {
      queryClient.setQueryData(clave, creada)
      refrescar()
      toast.success(
        'Tabla creada',
        'Las filas nacen vacías y la lista de alumnos queda fijada a la clase de referencia.',
      )
    },
    onError: (error) => {
      // Que ya exista no es un fallo que haya que explicar: alguien la creó
      // entre medias. Se recarga y se sigue trabajando sobre la que hay.
      if (motivoDe(error) === 'tabla_existente') {
        refrescar()
        return
      }
      toast.error('No se pudo crear la tabla', mensajeDeError(error))
    },
  })

  const noRealizada = useMutation({
    mutationFn: (motivo) =>
      marcarNoRealizada(tabla.data.id, {
        idOperacion: nuevaOperacion(),
        version: tabla.data.version,
        realizadoEn: ahora().toISOString(),
        motivo,
      }),
    onSuccess: (actualizada) => {
      queryClient.setQueryData(clave, actualizada)
      toast.success('Lectura marcada como no realizada', 'Ninguna fila queda pendiente para esta semana.')
    },
    onError: (error) => {
      if (motivoDe(error) === 'modificacion_concurrente') refrescar()
      toast.error('No se pudo marcar la semana', mensajeDeError(error))
    },
  })

  /**
   * Guardar una fila. Solo viajan los campos que CAMBIARON.
   *
   * Un campo omitido no se toca; uno en `null` se borra. Mandar la fila entera
   * con los campos intactos en null borraría datos que el docente no quiso
   * borrar, y es exactamente lo que haría un `...fila` descuidado.
   *
   * Va por la cola offline: sin conexión queda en el equipo y sale al volver.
   * El resultado —aceptado, rechazado o choque de versión— lo procesa
   * `registrosOffline`, porque puede llegar con esta pantalla ya cerrada.
   */
  const guardarFila = ({ idAlumno, cambios, version }) => {
    const fila = tabla.data?.filas?.find((f) => f.id_alumno === idAlumno)
    guardarRegistro('lectura', {
      clave: `${tabla.data.id}-${idAlumno}`,
      envio: {
        idTabla: tabla.data.id,
        nombre: fila?.nombre ?? null,
        item: { version, realizado_en: ahora().toISOString(), id_actividad: idActividad, id_alumno: idAlumno, ...cambios },
      },
      local: cambios,
      descripcion: `Lectura · ${fila?.nombre ?? `alumno ${idAlumno}`}`,
      idActividad,
    }).catch((error) => {
      if (!esDefinitivo(error)) return
      refrescar()
      toast.error('No se guardó la lectura', mensajeDeError(error))
    })
  }

  return {
    tabla: tabla.data ?? null,
    cargando: tabla.isLoading,
    // Un error de verdad: ni el 404 de "no existe", que es una respuesta.
    error: tabla.isError && !porCrear ? tabla.error : null,
    porCrear,
    crear: crear.mutate,
    creando: crear.isPending,
    marcarNoRealizada: noRealizada.mutate,
    marcando: noRealizada.isPending,
    guardarFila,
  }
}
