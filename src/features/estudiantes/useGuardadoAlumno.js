import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { guardarEvaluacion } from '../../api/resources/evaluaciones'
import { mensajeDeError } from '../../api/client'
import { useToast } from '../../components/ui/Toast'
import useOfflineQueue, { TIPOS_ENVIO, claveDeFila } from '../../hooks/useOfflineQueue'
import { etiquetaDeSemana } from '../../lib/format'

/**
 * Guardado del modal de un estudiante.
 *
 * El reporte semanal va por la cola offline con la MISMA clave de idempotencia
 * que la grilla completa (RNF-001): capturar por un lado o por el otro no
 * duplica la fila. La evaluación va por su recurso, igual que el formulario de
 * tres pasos.
 */
export default function useGuardadoAlumno({ alumno, semanas, semanaActual, periodoActual, semanal, vuelo, nivelInicial, calculo, onCerrar }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { encolar } = useOfflineQueue()
  const [guardando, setGuardando] = useState(false)

  function guardarSemanal() {
    const fila = {
      id_alumno: alumno.id_alumno,
      id_semana: Number(semanaActual),
      asistio: semanal.asistio,
      // Sin asistencia no se registra nada más: así está modelado (P4).
      lsl: semanal.asistio ? Number(semanal.lsl || 0) : 0,
      libros: semanal.asistio ? semanal.libros.filter((l) => l.titulo.trim()) : [],
      observacion: semanal.asistio ? semanal.observacion : '',
    }
    // RNF-001: va a la cola con su clave de idempotencia, la MISMA que usa la
    // grilla completa, así que capturar por aquí o por allá no duplica la fila.
    encolar({
      clave: claveDeFila(TIPOS_ENVIO.REPORTE_SEMANAL, fila.id_alumno, fila.id_semana),
      tipo: TIPOS_ENVIO.REPORTE_SEMANAL,
      descripcion: `Reporte semanal · ${alumno.nombre}`,
      payload: fila,
    }).catch(() => {
      // El fallo no se pierde: la cola lo reintenta y el SyncBadge lo muestra.
    })
    queryClient.invalidateQueries({ queryKey: ['reporte-semanal'] })
    toast.success('Reporte semanal guardado', `${alumno.nombre} · ${etiquetaDeSemana(semanas.find((s) => s.id_semana === Number(semanaActual)))}`)
    onCerrar()
  }

  async function guardarVuelo() {
    setGuardando(true)
    try {
      await guardarEvaluacion({
        id_alumno: alumno.id_alumno,
        id_periodo: Number(periodoActual),
        nivel_inicial_razkids: nivelInicial?.letra ?? null,
        nivel_prueba: vuelo.nivel_prueba,
        aciertos: Number(vuelo.aciertos),
        total: Number(vuelo.total),
        fluidez: vuelo.fluidez,
        comprension: vuelo.comprension,
        nivel_sugerido: calculo.nivelSugerido?.letra ?? null,
        nivel_ajustado: calculo.nivelSugerido?.letra ?? null,
        nivel_general: calculo.nivelGeneral,
        observacion: vuelo.observacion,
        estado: 'revisado',
      })
      queryClient.invalidateQueries({ queryKey: ['registro-vuelo'] })
      toast.success('Evaluación guardada', alumno.nombre)
      onCerrar()
    } catch (error) {
      toast.error('No se pudo guardar', mensajeDeError(error))
    } finally {
      setGuardando(false)
    }
  }


  return { guardarSemanal, guardarVuelo, guardando }
}
