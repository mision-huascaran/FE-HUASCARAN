// D114 — El `escritura` del servidor, leído junto con la actividad local.
//
// "Hay actividad en curso" tiene una sola fuente: `useActividadEnCurso` (la
// cabecera y los módulos leen lo mismo). Pero el `escritura` que calcula el
// servidor TAMBIÉN incluye la actividad, y una iniciada sin conexión no existe
// para él hasta que su inicio se sincroniza: su respuesta (la guardada o una
// que llega antes de esa sincronización) dice "Debes iniciar una actividad de
// trabajo…" aunque la cabecera muestre "Finalizar actividad".
//
// Ese "no" se calculó sin la actividad y el contrato da el porqué solo como
// texto, que el front no usa para decidir. Así que, mientras la actividad no
// llegó al servidor, la habilitación se decide con el paquete de
// `/me/habilitaciones` (la misma regla que usa el servidor: asignación,
// retroactiva o permiso vigente para ese grupo y periodo). En cuanto el
// servidor la conoce (`delServidor`), su respuesta manda otra vez.
//
// Solo para quien registra (el Docente): el resto consulta y el servidor ya le
// dice por qué.
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TEXTO_MOTIVO, habilitacionEnPeriodo, habilitacionPara } from '../auth/habilitaciones'
import { obtenerMisHabilitaciones } from '../api/resources/habilitaciones'
import { ahora } from '../lib/relojServidor'
import { useActividadEnCurso } from '../store/actividadStore'

/**
 * @param escritura  el bloque `escritura` de la respuesta del módulo.
 * @param registra   si esta persona registra en el módulo (el Docente).
 * @param idPeriodo  el PA, si la respuesta lo trae (Rúbrica, Registro de Vuelo).
 * @param fecha      si no, la fecha de la clase (Asistencias, Lectura).
 * @returns el `escritura` con el que decidir.
 */
export default function useEscrituraConActividad({
  escritura,
  registra,
  modulo,
  idColegio,
  idGrado,
  idPeriodo = null,
  fecha = null,
}) {
  const { sesion } = useActividadEnCurso()
  const calculadaSinLaActividad = Boolean(
    registra && escritura && escritura.permitida === false && sesion && !sesion.delServidor,
  )

  const { data: habilitaciones } = useQuery({
    queryKey: ['me', 'habilitaciones'],
    queryFn: obtenerMisHabilitaciones,
    enabled: calculadaSinLaActividad,
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Sin conexión también: `obtenerMisHabilitaciones` cae a lo guardado.
    networkMode: 'offlineFirst',
  })

  return useMemo(() => {
    if (!calculadaSinLaActividad) return escritura
    // Sin el paquete no hay con qué decidir: queda el "no" del servidor.
    if (!habilitaciones) return escritura
    const grupo = { habilitaciones, modulo, idColegio, idGrado, instante: ahora() }
    let local = null
    if (idPeriodo != null) local = habilitacionEnPeriodo({ ...grupo, idPeriodo })
    else if (fecha) local = habilitacionPara({ ...grupo, fecha })
    if (!local) return escritura
    if (local.permitida) return { ...escritura, permitida: true, motivo: null }
    return { ...escritura, motivo: TEXTO_MOTIVO[local.motivo] ?? escritura.motivo }
  }, [calculadaSinLaActividad, escritura, habilitaciones, modulo, idColegio, idGrado, idPeriodo, fecha])
}
