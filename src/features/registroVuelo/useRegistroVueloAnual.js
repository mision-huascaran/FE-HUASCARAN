// El Registro de Vuelo del año: consulta y decisiones por periodo (CU031, CU032).
//
// SOLO VIAJAN LOS TRES CAMPOS DEL DOCENTE. Mandar `entrada`, `sugerencia` o
// `nivel_programa` no es un campo que el servidor ignore: es un 422
// `validacion` que tira el LOTE COMPLETO, hasta 200 decisiones. Y esos campos
// viven en el mismo objeto del que salen el nivel colocado y la proyección, así
// que un `...periodo` los mandaría sin que nadie lo notara hasta el error. De
// ahí que el cuerpo se construya en `decision()`, que filtra lo permitido.
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError } from '../../api/client'
import {
  MOTIVO_VUELO,
  decision,
  guardarRegistroVuelo,
  listarRegistroVuelo,
} from '../../api/resources/registroVueloAnual'
import { textoDeRechazo } from '../../api/resources/sincronizacion'
import { ahora } from '../../lib/relojServidor'
import useConflictos from '../../hooks/useConflictos'
import useActividadStore from '../../store/actividadStore'

const nuevaOperacion = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `op-${Date.now()}-${Math.random().toString(16).slice(2)}`

export default function useRegistroVueloAnual({ filtros, pagina }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar } = filtros
  const listos = Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar)
  const clave = ['registro-vuelo', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, pagina }]
  const conflictos = useConflictos()
  const { limpiar: limpiarConflictos } = conflictos
  const claveTexto = JSON.stringify(clave)
  // Otro grupo u otro mes: los avisos de la vista anterior ya no aplican.
  useEffect(() => limpiarConflictos(), [claveTexto, limpiarConflictos])

  const vuelo = useQuery({
    queryKey: clave,
    queryFn: () => listarRegistroVuelo({ ...filtros, pagina }),
    enabled: listos,
  })

  /**
   * Sustituye UN periodo de UN alumno en la caché.
   *
   * El avance anual se recalcula al vuelo: es el número de PA con nivel
   * colocado, y si no se actualizara, decidir el cuarto periodo dejaría el
   * avance en 75 % hasta que alguien recargara.
   */
  const aplicar = (idAlumno, registro) =>
    queryClient.setQueryData(clave, (previa) => {
      if (!previa) return previa
      return {
        ...previa,
        items: previa.items.map((a) => {
          if (a.id_alumno !== idAlumno) return a
          const periodos = a.periodos.map((p) => (p.numero === registro.numero ? registro : p))
          return { ...a, periodos, avance_anual: periodos.filter((p) => p.nivel_colocado).length * 25 }
        }),
      }
    })

  const guardar = useMutation({
    mutationFn: ({ alumno, periodo, cambios }) =>
      guardarRegistroVuelo([
        decision({
          idOperacion: nuevaOperacion(),
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
        }),
      ]),
    onSuccess: (resultados, { alumno }) => {
      const uno = Array.isArray(resultados) ? resultados[0] : null
      if (!uno) return

      if (uno.estado === 'rechazada') {
        // `modificacion_concurrente` trae el registro vigente: se ofrece
        // "Cargar versión actual". Reintentar pisaría la decisión ajena.
        if (uno.motivo === 'modificacion_concurrente' && uno.registro) {
          conflictos.registrar({
            clave: `${alumno.id_alumno}-${uno.registro.numero}`,
            nombre: `${alumno.nombre} · PA${uno.registro.numero}`,
            idOperacion: uno.id_operacion,
            registro: uno.registro,
            detail: uno.detail ?? MOTIVO_VUELO.modificacion_concurrente,
            aplicar: (registro) => aplicar(alumno.id_alumno, registro),
          })
          return
        }
        queryClient.invalidateQueries({ queryKey: ['registro-vuelo'] })
        toast.error('No se guardó la decisión', textoDeRechazo(uno, MOTIVO_VUELO) ?? 'Revise los datos.')
        return
      }

      if (uno.registro) aplicar(alumno.id_alumno, uno.registro)
    },
    onError: (error) => toast.error('No se guardó la decisión', mensajeDeError(error)),
  })

  return {
    datos: vuelo.data ?? null,
    cargando: vuelo.isLoading,
    error: vuelo.isError ? vuelo.error : null,
    guardarDecision: (alumno, periodo, cambios) => guardar.mutate({ alumno, periodo, cambios }),
    guardando: guardar.isPending,
    conflictos: conflictos.conflictos,
    cargarVersionActual: conflictos.cargarVersionActual,
    cargandoVersion: conflictos.cargando,
  }
}
