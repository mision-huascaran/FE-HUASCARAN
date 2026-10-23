import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { obtenerResumenDocente } from '../../api/resources/docentes'
import { ahora } from '../../lib/relojServidor'
import useSessionStore from '../../store/sessionStore'

/**
 * La semana en curso (lunes a viernes) según la hora del servidor.
 *
 * Ya no sale de `GET /semanas`: desde T7 ese endpoint exige grupo y mes, y el
 * Inicio no tiene grupo. Se calcula del reloj anclado al servidor, que es lo
 * único que hace falta para decirle al docente en qué semana está.
 */
export function semanaEnCurso(referencia = ahora()) {
  const dia = dayjs(referencia)
  // dayjs: 0 = domingo. El sábado y el domingo miran la semana que termina.
  const desdeLunes = (dia.day() + 6) % 7
  const lunes = dia.subtract(desdeLunes, 'day').startOf('day')
  return { inicio: lunes.format('YYYY-MM-DD'), fin: lunes.add(4, 'day').format('YYYY-MM-DD') }
}

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
  const semanaActual = semanaEnCurso()

  const consulta = useQuery({
    queryKey: ['resumen-docente', idDocente, semanaActual.inicio],
    queryFn: () => obtenerResumenDocente(idDocente, {}),
    enabled: Boolean(idDocente),
  })

  return { ...consulta, semanaActual }
}
