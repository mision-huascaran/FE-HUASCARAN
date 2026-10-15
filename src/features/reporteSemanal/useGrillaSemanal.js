// T32 — Existencia y creación de la grilla semanal, y quién faltó.
//
// Dos cosas que el caso de uso separa a propósito:
//   · la grilla NO se crea sola ni se copia de la semana anterior;
//   · los ausentes salen del módulo Asistencia, no de la propia rúbrica, para
//     que el docente no tenga que marcar la falta dos veces.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { ausentesDe, crearGrillaSemanal, existeGrillaSemanal } from '../../api/resources/grillas'
import { mensajeDeError } from '../../api/client'

export default function useGrillaSemanal({ tipo, idSemana, idColegio, idGrado, idSeccion }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const listos = Boolean(idSemana && idColegio && idGrado)
  const clave = { tipo, idSemana, idColegio, idGrado, idSeccion }

  const existe = useQuery({
    queryKey: ['grilla', clave],
    queryFn: () => existeGrillaSemanal(clave),
    enabled: listos,
  })

  const ausentes = useQuery({
    queryKey: ['ausentes', { idColegio, idGrado, idSemana }],
    queryFn: () => ausentesDe({ idColegio, idGrado, idSemana }),
    enabled: listos,
  })

  const crear = useMutation({
    mutationFn: () => crearGrillaSemanal(clave),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grilla'] })
      toast.success('Grilla creada', 'Las filas nacen vacías: no se copian de otra semana.')
    },
    onError: (error) => toast.error('No se pudo crear la grilla', mensajeDeError(error)),
  })

  return {
    existe: existe.data === true,
    cargando: existe.isLoading,
    creando: crear.isPending,
    crear: () => crear.mutate(),
    ausentes: ausentes.data ?? [],
  }
}
