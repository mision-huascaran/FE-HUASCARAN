import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarReporteSemanal } from '../../api/resources/semanal'
import { listarEvaluaciones } from '../../api/resources/evaluaciones'
import { obtenerAlumno } from '../../api/resources/alumnos'

/**
 * Datos del modal de captura de un estudiante.
 *
 * Usa las MISMAS consultas que las pantallas completas y se queda con la fila de
 * ese alumno, en vez de un endpoint propio: así lo que se ve aquí y lo que se ve
 * en la grilla no pueden desincronizarse.
 */
export default function useDatosAlumno({ alumno, abierto, semanaActual, pestana }) {
  const consultaSemanal = useQuery({
    queryKey: ['reporte-semanal', semanaActual, alumno?.id_colegio, alumno?.id_grado],
    queryFn: () => listarReporteSemanal({ semana: semanaActual, colegio: alumno.id_colegio, grado: alumno.id_grado }),
    enabled: Boolean(abierto && alumno && semanaActual),
  })
  const filaSemanal = useMemo(
    () => (consultaSemanal.data ?? []).find((f) => f.id_alumno === alumno?.id_alumno) ?? null,
    [consultaSemanal.data, alumno],
  )

  const consultaVuelo = useQuery({
    queryKey: ['registro-vuelo', 'alumno', alumno?.id_alumno],
    queryFn: () => listarEvaluaciones({ colegio: alumno.id_colegio, q: alumno.codigo }),
    enabled: Boolean(abierto && alumno),
  })
  const filaVuelo = useMemo(
    () => (consultaVuelo.data ?? []).find((f) => f.id_alumno === alumno?.id_alumno) ?? null,
    [consultaVuelo.data, alumno],
  )

  const consultaFicha = useQuery({
    queryKey: ['alumno', alumno?.id_alumno],
    queryFn: () => obtenerAlumno(alumno.id_alumno),
    enabled: Boolean(abierto && alumno && pestana === 'ficha'),
  })

  return { filaSemanal, filaVuelo, consultaSemanal, consultaVuelo, consultaFicha }
}
