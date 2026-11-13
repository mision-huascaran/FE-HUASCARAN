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

/** ¿Este envío pendiente es de la clase que se está viendo? */
const esDeLaClase = (payload, { idColegio, idGrado, idSeccion, fecha }) =>
  String(payload?.idColegio) === String(idColegio) &&
  String(payload?.idGrado) === String(idGrado) &&
  String(payload?.idSeccion) === String(idSeccion) &&
  String(payload?.fecha) === String(fecha)

/** Los registros pendientes de la clase, del más antiguo al más reciente. */
function registrosPendientes(pendientes, clase) {
  return pendientes
    .filter((item) => esDeLaClase(item.payload, clase))
    .flatMap((item) => item.payload.registros ?? [])
    .map((registro, orden) => ({ registro, orden }))
    .sort((a, b) => String(a.registro.realizado_en ?? '').localeCompare(String(b.registro.realizado_en ?? '')) || a.orden - b.orden)
    .map(({ registro }) => registro)
}

/**
 * `datos` (la respuesta de `GET /asistencias`) con las marcas y observaciones
 * pendientes aplicadas. Devuelve el mismo objeto si no hay nada que aplicar.
 *
 * @param pendientes los ítems de la cola de tipo asistencia (`pendientesDeTipo`).
 * @param clase `{ idColegio, idGrado, idSeccion, fecha }` de la pantalla.
 */
export function fusionarConPendientes(datos, pendientes, clase) {
  if (!datos?.alumnos?.length || !pendientes?.length) return datos
  const registros = registrosPendientes(pendientes, clase)
  if (!registros.length) return datos

  const porAlumno = new Map()
  registros.forEach((registro) => {
    const anterior = porAlumno.get(registro.id_alumno) ?? {}
    const cambios = {}
    if ('estado' in registro) cambios.estado = registro.estado ?? null
    if ('observacion' in registro) cambios.observacion = registro.observacion ?? null
    porAlumno.set(registro.id_alumno, { ...anterior, ...cambios })
  })

  return {
    ...datos,
    alumnos: datos.alumnos.map((alumno) =>
      porAlumno.has(alumno.id_alumno) ? { ...alumno, ...porAlumno.get(alumno.id_alumno) } : alumno,
    ),
  }
}
