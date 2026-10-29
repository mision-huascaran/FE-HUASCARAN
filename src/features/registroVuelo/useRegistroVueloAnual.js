// El Registro de Vuelo del año: consulta y decisiones por periodo (CU031, CU032).
//
// SOLO VIAJAN LOS TRES CAMPOS DEL DOCENTE. Mandar `entrada`, `sugerencia` o
// `nivel_programa` no es un campo que el servidor ignore: es un 422
// `validacion` que tira el LOTE COMPLETO, hasta 200 decisiones. Y esos campos
// viven en el mismo objeto del que salen el nivel colocado y la proyección, así
// que un `...periodo` los mandaría sin que nadie lo notara hasta el error. De
// ahí que el cuerpo se construya en `decision()`, que filtra lo permitido.
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError } from '../../api/client'
import {
  decision,
  listarRegistroVuelo,
} from '../../api/resources/registroVueloAnual'
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

export default function useRegistroVueloAnual({ filtros, pagina }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar } = filtros
  const listos = Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar)
  const clave = ['registro-vuelo', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, pagina }]
  // Lo que responde la cola (ahora o al reconectar) se escribe en esta caché.
  useEffect(() => conectarConsultas(queryClient), [queryClient])

  const vuelo = useQuery({
    queryKey: clave,
    queryFn: () => listarRegistroVuelo({ ...filtros, pagina }),
    enabled: listos,
    /**
     * SIEMPRE SE VUELVE A PEDIR AL ENTRAR (D87).
     *
     * Con el `staleTime` global de 60 s, volver a esta pantalla servía lo que
     * había en memoria —incluida la copia optimista de lo que este equipo
     * acababa de escribir— sin preguntarle al servidor. Lo guardado desde
     * otro dispositivo no aparecía, y editar encima terminaba en un conflicto
     * de versión: la `version` que se manda es la que vio el docente, y la
     * suya estaba vieja.
     *
     * Estos dos módulos los escriben varias personas sobre los mismos
     * alumnos, así que la copia en memoria no vale como verdad. Sin conexión
     * no cambia nada: la consulta falla y se sigue viendo lo guardado.
     */
    staleTime: 0,
    refetchOnMount: 'always',
  })

  /** La letra de un nivel, del catálogo ya descargado (para pintar mientras espera). */
  const nivelLocal = (id) => {
    if (id == null) return null
    const niveles = queryClient.getQueryData(['catalogo', 'niveles-razkids']) ?? []
    const nivel = niveles.find((n) => n.id_nivel_razkids === id)
    return { id, letra: nivel?.letra ?? null }
  }

  /**
   * Una decisión es una operación de la cola offline. Mientras espera se ve el
   * nivel elegido, pero la entrada, la sugerencia y el nivel del programa
   * siguen como en la última descarga: los calcula el servidor al sincronizar.
   */
  const guardarDecision = (alumno, periodo, cambios) => {
    const local = {}
    if ('id_nivel_colocado' in cambios) local.nivel_colocado = nivelLocal(cambios.id_nivel_colocado)
    if ('id_nivel_proyeccion' in cambios) local.proyeccion = nivelLocal(cambios.id_nivel_proyeccion)
    if ('observacion' in cambios) local.observacion = cambios.observacion
    // El id de operación lo pone la cola al encolar; el de `decision` no va.
    const item = decision({
      version: periodo.version,
      realizadoEn: ahora().toISOString(),
      idActividad,
      idAlumno: alumno.id_alumno,
      idPeriodoAcademico: periodo.id_periodo_academico,
      idColegio,
      idGrado,
      idSeccion,
      idPrograma,
      cambios,
    })
    delete item.id_operacion
    guardarRegistro('vuelo', {
      clave: [idColegio, idGrado, idSeccion, idPrograma, alumno.id_alumno, periodo.id_periodo_academico].join('-'),
      envio: { item, numero: periodo.numero, nombre: `${alumno.nombre} · PA${periodo.numero}` },
      local,
      descripcion: `Registro de Vuelo · ${alumno.nombre} · PA${periodo.numero}`,
      idActividad,
    }).catch((error) => {
      if (!esDefinitivo(error)) return
      queryClient.invalidateQueries({ queryKey: ['registro-vuelo'] })
      toast.error('No se guardó la decisión', mensajeDeError(error))
    })
  }

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
  const datos = vuelo.data
    ? { ...vuelo.data, items: vuelo.data.items ?? [], periodos: vuelo.data.periodos ?? [] }
    : null

  return {
    datos,
    cargando: vuelo.isLoading,
    error: vuelo.isError ? vuelo.error : null,
    guardarDecision,
  }
}
