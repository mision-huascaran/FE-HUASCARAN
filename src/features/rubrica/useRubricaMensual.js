// La rúbrica del mes: consulta, guardado por fila y choque de versiones (CU029, CU030).
//
// Cada cambio de un desplegable es su propia OPERACIÓN, con su `id_operacion` y
// su `version`. No hay botón de guardar porque no hace falta: una evaluación
// son dos desplegables, y obligar a confirmar dos listas sería trabajo de más.
//
// EL CHOQUE DE VERSIONES NO SE RESUELVE SOLO. Cuando el servidor responde
// `modificacion_concurrente` manda el registro VIGENTE, y lo que se hace es
// adoptarlo: reintentar pisaría el cambio de la otra persona, y dejar lo que
// hay en pantalla mostraría algo que el servidor no tiene.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError, motivoDe } from '../../api/client'
import { MOTIVO_RUBRICA, esMotivoDeMes, guardarRubricas, listarRubricas } from '../../api/resources/rubricaMensual'
import { textoDeRechazo } from '../../api/resources/sincronizacion'
import { ahora } from '../../lib/relojServidor'
import useActividadStore from '../../store/actividadStore'

const nuevaOperacion = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(16).slice(2)}`

export default function useRubricaMensual({ filtros, pagina }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes } = filtros
  const listos = Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar && mes)
  const clave = ['rubricas', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, pagina }]

  const rubrica = useQuery({
    queryKey: clave,
    queryFn: () => listarRubricas({ ...filtros, pagina }),
    enabled: listos,
    // Un mes futuro o sin días lectivos es una RESPUESTA, no un fallo:
    // reintentarlo tres veces solo retrasaría el cartel que lo explica.
    retry: (intentos, error) => !esMotivoDeMes(motivoDe(error)) && intentos < 2,
  })

  /** Sustituye UNA fila en la caché, sin volver a pedir la página entera. */
  const aplicar = (registro) =>
    queryClient.setQueryData(clave, (previa) =>
      previa
        ? { ...previa, items: previa.items.map((i) => (i.id_alumno === registro.id_alumno ? registro : i)) }
        : previa,
    )

  const guardar = useMutation({
    mutationFn: ({ fila, cambios }) =>
      guardarRubricas([
        {
          id_operacion: nuevaOperacion(),
          version: fila.version,
          realizado_en: ahora().toISOString(),
          id_actividad: idActividad,
          id_alumno: fila.id_alumno,
          id_colegio: Number(idColegio),
          id_grado: Number(idGrado),
          id_seccion: Number(idSeccion),
          id_programa: Number(idPrograma),
          id_anio_escolar: Number(idAnioEscolar),
          mes: Number(mes),
          ...cambios,
        },
      ]),
    onSuccess: (resultados) => {
      const uno = Array.isArray(resultados) ? resultados[0] : null
      if (!uno) return

      if (uno.estado === 'rechazada') {
        /**
         * `modificacion_concurrente` trae el registro vigente: se adopta. Los
         * demás rechazos no traen nada que adoptar, así que se recarga la
         * página para no dejar en pantalla un valor que no se guardó.
         */
        if (uno.motivo === 'modificacion_concurrente' && uno.registro) {
          aplicar(uno.registro)
          toast.info('Otra persona ya la había cambiado', MOTIVO_RUBRICA.modificacion_concurrente)
          return
        }
        queryClient.invalidateQueries({ queryKey: ['rubricas'] })
        toast.error('No se guardó la evaluación', textoDeRechazo(uno, MOTIVO_RUBRICA) ?? 'Revise los datos.')
        return
      }

      if (uno.registro) aplicar(uno.registro)
    },
    onError: (error) => toast.error('No se guardó la evaluación', mensajeDeError(error)),
  })

  const motivoDelMes = esMotivoDeMes(motivoDe(rubrica.error)) ? motivoDe(rubrica.error) : null

  return {
    datos: rubrica.data ?? null,
    cargando: rubrica.isLoading,
    motivoDelMes,
    // Un error de verdad: ni el mes futuro ni el mes sin días lectivos.
    error: rubrica.isError && !motivoDelMes ? rubrica.error : null,
    guardarFila: (fila, cambios) => guardar.mutate({ fila, cambios }),
    guardando: guardar.isPending,
  }
}
