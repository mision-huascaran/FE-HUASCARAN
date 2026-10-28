// La rúbrica del mes: consulta, guardado por fila y choque de versiones (CU029, CU030).
//
// Cada cambio de un desplegable es su propia OPERACIÓN, con su `id_operacion` y
// su `version`. No hay botón de guardar porque no hace falta: una evaluación
// son dos desplegables, y obligar a confirmar dos listas sería trabajo de más.
//
// EL CHOQUE DE VERSIONES NO SE RESUELVE SOLO. Cuando el servidor responde
// `modificacion_concurrente` manda el registro VIGENTE: queda como rechazo con
// "Cargar versión actual" (ver `lib/registrosOffline`). Reintentar pisaría el
// cambio de la otra persona.
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError, motivoDe } from '../../api/client'
import { esMotivoDeMes, listarRubricas } from '../../api/resources/rubricaMensual'
import { ahora } from '../../lib/relojServidor'
import { conectarConsultas, guardarRegistro } from '../../lib/registrosOffline'
import useActividadStore from '../../store/actividadStore'

/**
 * Un 4xx del lote entero (422 `validacion`, 403…) no se arregla reintentando:
 * se dice. Un corte de red no es un error: el cambio sigue en la cola.
 */
const esDefinitivo = (error) => {
  const estado = error?.response?.status
  return estado != null && estado >= 400 && estado < 500
}

export default function useRubricaMensual({ filtros, pagina }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes } = filtros
  const listos = Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar && mes)
  const clave = ['rubricas', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, pagina }]
  // Lo que responde la cola (ahora o al reconectar) se escribe en esta caché.
  useEffect(() => conectarConsultas(queryClient), [queryClient])

  const rubrica = useQuery({
    queryKey: clave,
    queryFn: () => listarRubricas({ ...filtros, pagina }),
    enabled: listos,
    // Un mes futuro o sin días lectivos es una RESPUESTA, no un fallo:
    // reintentarlo tres veces solo retrasaría el cartel que lo explica.
    retry: (intentos, error) => !esMotivoDeMes(motivoDe(error)) && intentos < 2,
  })

  /**
   * Cada cambio de un desplegable es una operación de la cola offline. La
   * `version` es la que mostró el GET (`null` si el alumno no tenía
   * evaluación); 0 y `null` son distintos y viajan tal cual.
   */
  const guardarFila = (fila, cambios) =>
    guardarRegistro('rubrica', {
      clave: [idColegio, idGrado, idSeccion, idPrograma, idAnioEscolar, mes, fila.id_alumno].join('-'),
      envio: {
        nombre: fila.nombre,
        item: {
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
      },
      local: cambios,
      descripcion: `Rúbrica · ${fila.nombre}`,
      idActividad,
    }).catch((error) => {
      if (!esDefinitivo(error)) return
      queryClient.invalidateQueries({ queryKey: ['rubricas'] })
      toast.error('No se guardó la evaluación', mensajeDeError(error))
    })

  const motivoDelMes = esMotivoDeMes(motivoDe(rubrica.error)) ? motivoDe(rubrica.error) : null

  /**
   * La respuesta del servidor, con sus listas SIEMPRE como listas (D48).
   *
   * El contrato dice que vienen como arreglos, pero cuando no llega lo esperado
   * —un endpoint a medio migrar, un `null` donde iba `[]`— un `.map()` o un
   * `.length` revientan el render y la pantalla acaba en el error genérico "No
   * se pudo mostrar esta pantalla". Eso fue D48: el probador veía ese cartel en
   * Registro de Vuelo y, como Supervisora, en Rúbrica y Seguimiento de Lectura,
   * sin forma de saber qué había pasado.
   *
   * Normalizando aquí, la pantalla puede fiarse de la forma y enseñar SU estado
   * vacío, que es lo que el caso de uso pide.
   */
  const datos = rubrica.data ? { ...rubrica.data, items: rubrica.data.items ?? [] } : null

  return {
    datos,
    cargando: rubrica.isLoading,
    motivoDelMes,
    // Un error de verdad: ni el mes futuro ni el mes sin días lectivos.
    error: rubrica.isError && !motivoDelMes ? rubrica.error : null,
    guardarFila,
  }
}
