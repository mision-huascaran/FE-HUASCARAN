import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerDetalleColegio } from '../../api/resources/dashboard'
import { mensajeDeError } from '../../api/client'
import useFiltrosStore from '../../store/filtrosStore'

/** Detalle de un colegio con su selector de periodo (P13 y consulta del profesor). */
export default function useDetalleColegio(idColegio) {
  const idPeriodoVigente = useFiltrosStore((s) => s.idPeriodo)
  const [elegido, setPeriodo] = useState('')
  const periodo = elegido || (idPeriodoVigente ? String(idPeriodoVigente) : '')

  const consulta = useQuery({
    queryKey: ['colegio', String(idColegio), periodo],
    queryFn: () => obtenerDetalleColegio(idColegio, { periodo }),
    enabled: Boolean(idColegio && periodo),
    placeholderData: (previos) => previos,
  })

  return {
    detalle: consulta.data ?? null,
    cargando: consulta.isLoading,
    error: consulta.isError,
    mensaje: consulta.isError ? mensajeDeError(consulta.error) : null,
    periodo,
    setPeriodo,
  }
}
