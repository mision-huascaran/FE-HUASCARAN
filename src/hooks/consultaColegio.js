// D110 — El detalle de un colegio (`GET /colegios/{id}`), con UNA clave y UNA política.
//
// Es lo único que trae los grados, sus secciones y sus subprogramas con id, y
// lo leen Asistencias, Lectura, Rúbrica, Registro de Vuelo, "Nuevo alumno" y la
// ficha del colegio. Antes cada pantalla tenía su clave (`['colegio', id]` o
// `['colegio', 'detalle', id]`) y casi todas lo guardaban PARA SIEMPRE
// (`staleTime` y `gcTime` infinitos) en una caché que además se copia a
// IndexedDB: una vez visto, el detalle no se volvía a pedir y las secciones
// que el Supervisor agregaba después no aparecían nunca.
//
// Ahora:
//   · con conexión se vuelve a pedir al abrir la pantalla si la copia tiene
//     más de 30 segundos (lo que tarda alguien en ir de Colegios a otra
//     pantalla en el mismo equipo ya lo cubre la invalidación al guardar);
//   · sin conexión la consulta queda en pausa y se sigue viendo la copia
//     local (`gcTime` infinito y la raíz `colegio` en `cacheConsultas`);
//   · al crear o editar un colegio se invalida `CLAVE_RAIZ_COLEGIO`.
import { obtenerColegio } from '../api/resources/administracion'

export const CLAVE_RAIZ_COLEGIO = ['colegio']

/** La clave del detalle. El id va como texto: llega como número o desde la URL. */
export const claveDetalleColegio = (idColegio) => [...CLAVE_RAIZ_COLEGIO, String(idColegio ?? '')]

export const FRESCURA_DETALLE_COLEGIO_MS = 30 * 1000

/** Opciones de `useQuery`/`useQueries` para el detalle de un colegio. */
export function consultaDetalleColegio(idColegio, opciones = {}) {
  return {
    queryKey: claveDetalleColegio(idColegio),
    queryFn: () => obtenerColegio(idColegio),
    enabled: Boolean(idColegio),
    staleTime: FRESCURA_DETALLE_COLEGIO_MS,
    gcTime: Infinity,
    refetchOnMount: true,
    ...opciones,
  }
}
