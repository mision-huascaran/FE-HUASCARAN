import { useQuery } from '@tanstack/react-query'
import { obtenerResumenDocente } from '../../api/resources/docentes'
import { useSemanas } from '../../hooks/useCatalogos'
import useSessionStore from '../../store/sessionStore'

/**
 * La semana en curso y, si algún día existe, el resumen de avance del Docente.
 *
 * YA NO PIDE UN PERIODO. Antes llevaba el `idPeriodo` del store global, que
 * CU027 deja sin sentido: el periodo depende del colegio y de la fecha, y un
 * docente con dos colegios puede estar en PA3 en uno y en receso en el otro.
 * El endpoint real tampoco lo recibe.
 *
 * El resumen de avance sigue devolviendo `null` contra la API real: CU010
 * cerró la lista de Resúmenes de Acción a uno solo —los registros offline
 * pendientes, que salen de IndexedDB— y dejó los de avance académico "para
 * futuras entregas conforme se aprueben sus reglas de cálculo".
 */
export default function useResumenDocente() {
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const { data: semanas = [] } = useSemanas()
  const semanaActual = semanas.at(-1) ?? null

  const consulta = useQuery({
    queryKey: ['resumen-docente', idDocente, semanaActual?.id_semana],
    queryFn: () => obtenerResumenDocente(idDocente, { semana: semanaActual.id_semana }),
    enabled: Boolean(idDocente && semanaActual),
  })

  return { ...consulta, semanaActual }
}
