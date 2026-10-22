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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError, motivoDe } from '../../api/client'
import {
  crearTabla,
  datosParaCrear,
  esTablaPorCrear,
  guardarFilas,
  marcarNoRealizada,
  obtenerTabla,
} from '../../api/resources/lectura'
import { ahora } from '../../lib/relojServidor'
import useActividadStore from '../../store/actividadStore'

/** Un `id_operacion` nuevo por intento del usuario, estable en el reintento. */
const nuevaOperacion = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(16).slice(2)}`

export default function useTablaLectura(filtros) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana } = filtros
  const listos = Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar && mes && idSemana)
  const clave = ['lectura', 'tabla', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana }]

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
   */
  const guardarFila = useMutation({
    mutationFn: ({ idAlumno, cambios, version }) =>
      guardarFilas(tabla.data.id, [
        {
          id_operacion: nuevaOperacion(),
          version,
          realizado_en: ahora().toISOString(),
          id_alumno: idAlumno,
          ...cambios,
        },
      ]),
    onSuccess: (resultados) => {
      const uno = Array.isArray(resultados) ? resultados[0] : null

      if (uno?.estado === 'rechazada') {
        // El registro vigente acompaña a `modificacion_concurrente`: se adopta
        // en vez de dejar en pantalla algo que el servidor no tiene.
        if (uno.registro) aplicarFila(uno.registro)
        else refrescar()
        toast.error('No se guardó la lectura', uno.detail ?? 'Revise los datos e inténtelo de nuevo.')
        return
      }

      if (uno?.registro) aplicarFila(uno.registro)
    },
    onError: (error) => toast.error('No se guardó la lectura', mensajeDeError(error)),
  })

  /** Sustituye UNA fila en la caché, sin volver a pedir la tabla entera. */
  function aplicarFila(fila) {
    queryClient.setQueryData(clave, (previa) =>
      previa
        ? { ...previa, filas: previa.filas.map((f) => (f.id_alumno === fila.id_alumno ? fila : f)) }
        : previa,
    )
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
    guardarFila: guardarFila.mutate,
    guardando: guardarFila.isPending,
  }
}
