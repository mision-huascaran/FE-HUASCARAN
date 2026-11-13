// La declaración de "no realizada" (y su reversión) que todavía espera en la
// cola, aplicada a la tabla (CU026, flujo "Registro sin conexión a Internet").
//
// Las dos se encolan, pero la tabla solo cambiaba cuando el servidor
// respondía: sin conexión no se bloqueaba, no decía el motivo ni "Pendiente
// de sincronización", y al volver al módulo no quedaba rastro de lo declarado.
// Ahora el estado sale de la COLA, que sobrevive a salir y volver (y a
// recargar): gana la última operación pendiente de esa tabla.

/**
 * @param datos la tabla (`GET /lectura/tablas`).
 * @param noRealizadas los ítems pendientes de tipo `lectura-no-realizada`.
 * @param habilitaciones los de tipo `lectura-habilitar`.
 */
export function conDeclaracionPendiente(datos, noRealizadas = [], habilitaciones = []) {
  if (!datos?.id) return datos
  const deEstaTabla = (item) => String(item.payload?.idTabla) === String(datos.id)
  const ultima = [
    ...noRealizadas.filter(deEstaTabla).map((item) => ({ item, declara: true })),
    ...habilitaciones.filter(deEstaTabla).map((item) => ({ item, declara: false })),
  ].sort((a, b) =>
    String(a.item.payload.realizadoEn ?? a.item.creado ?? '').localeCompare(String(b.item.payload.realizadoEn ?? b.item.creado ?? '')),
  ).at(-1)
  if (!ultima) return datos

  return ultima.declara
    ? { ...datos, estado: 'no_realizada', motivo_no_realizada: ultima.item.payload.motivo ?? null, declaracion_pendiente: true }
    : { ...datos, estado: 'normal', motivo_no_realizada: null, declaracion_pendiente: true }
}

/** Cuántas declaraciones o reversiones de esta tabla esperan en la cola. */
export const declaracionesPendientes = (idTabla, ...listas) =>
  listas.flat().filter((item) => idTabla != null && String(item.payload?.idTabla) === String(idTabla)).length
