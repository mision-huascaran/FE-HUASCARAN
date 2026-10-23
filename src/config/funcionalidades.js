// Interruptores de funcionalidades que existen en el código pero todavía no se
// muestran. Cambiarlos no exige tocar las pantallas: solo este archivo.

/**
 * Pestaña "Auditoría" del popup "Ver detalle" (Alumnos, Colegios, Usuarios).
 *
 * Oculta hasta que la auditoría esté implementada para todas las entidades. Hoy
 * solo la de alumnos responde datos reales (`GET /alumnos/{id}/historial`,
 * CU015); colegios y usuarios devuelven una lista vacía.
 */
export const MOSTRAR_AUDITORIA = false
