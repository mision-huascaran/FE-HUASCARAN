// La clase de Asistencias con lo que todavía espera en la cola (D123).
//
// La tabla se armaba solo con la respuesta del servidor o, sin conexión, con
// la copia guardada de esa consulta. Lo marcado sin conexión vivía en el estado
// del componente: al ir a otro módulo y volver, se perdía de la pantalla
// aunque siguiera en la cola esperando a sincronizar. El Docente veía la
// lista vacía y podía volver a marcar encima.
//
// Ahora, al cargar la clase (con o sin conexión), se le aplican encima las
// operaciones pendientes de ESA clase: mismo colegio, grado, sección y fecha.
// Por alumno gana la más reciente, campo por campo: una operación que solo
// trae la observación no borra el estado que trae otra.
//
// LA CLASE ADICIONAL TAMBIÉN ESPERA EN LA COLA. No hay un envío aparte que la
// cree: viaja con cada marca (`adicional: true`) y el servidor la crea con la
// primera. Así que, si la copia dice "no hay clase" y alguna marca pendiente
// de esta clase lleva `adicional`, la clase YA está decidida: se muestra como
// "Clase adicional" y no se vuelve a ofrecer crearla.

export const ETIQUETA_ADICIONAL = 'Clase adicional'

/** ¿Este envío pendiente es de la clase que se está viendo? */
const esDeLaClase = (payload, { idColegio, idGrado, idSeccion, fecha }) =>
  String(payload?.idColegio) === String(idColegio) &&
  String(payload?.idGrado) === String(idGrado) &&
  String(payload?.idSeccion) === String(idSeccion) &&
  String(payload?.fecha) === String(fecha)

/** Los registros pendientes de la clase, del más antiguo al más reciente. */
function registrosPendientes(deLaClase) {
  return deLaClase
    .flatMap((item) => item.payload.registros ?? [])
    .map((registro, orden) => ({ registro, orden }))
    .sort((a, b) => String(a.registro.realizado_en ?? '').localeCompare(String(b.registro.realizado_en ?? '')) || a.orden - b.orden)
    .map(({ registro }) => registro)
}

/** La clase con la adicional pendiente, si la copia todavía no tiene ninguna. */
function conAdicionalPendiente(clase, deLaClase) {
  if (clase?.etiqueta || !deLaClase.some((item) => item.payload.adicional)) return clase
  return { ...clase, tipo: 'adicional', etiqueta: ETIQUETA_ADICIONAL, aviso: null, adicional_pendiente: true }
}

/**
 * `datos` (la respuesta de `GET /asistencias`) con las marcas, observaciones y
 * la clase adicional pendientes aplicadas. Devuelve el mismo objeto si no hay
 * nada que aplicar.
 *
 * @param pendientes los ítems de la cola de tipo asistencia (`pendientesDeTipo`).
 * @param clase `{ idColegio, idGrado, idSeccion, fecha }` de la pantalla.
 */
export function fusionarConPendientes(datos, pendientes, clase) {
  if (!datos?.alumnos?.length || !pendientes?.length) return datos
  const deLaClase = pendientes.filter((item) => esDeLaClase(item.payload, clase))
  if (!deLaClase.length) return datos

  const porAlumno = new Map()
  registrosPendientes(deLaClase).forEach((registro) => {
    const anterior = porAlumno.get(registro.id_alumno) ?? {}
    const cambios = {}
    if ('estado' in registro) cambios.estado = registro.estado ?? null
    if ('observacion' in registro) cambios.observacion = registro.observacion ?? null
    porAlumno.set(registro.id_alumno, { ...anterior, ...cambios })
  })

  return {
    ...datos,
    clase: conAdicionalPendiente(datos.clase, deLaClase),
    alumnos: datos.alumnos.map((alumno) =>
      porAlumno.has(alumno.id_alumno) ? { ...alumno, ...porAlumno.get(alumno.id_alumno) } : alumno,
    ),
  }
}

/** Cuántos envíos de la cola son de esta clase. */
export const pendientesDeLaClase = (pendientes, clase) =>
  (pendientes ?? []).filter((item) => esDeLaClase(item.payload, clase)).length
