/** Pasos del formulario guiado de P7. */
export const PASOS_EVALUACION = ['Seleccionar estudiante', 'Registrar evaluación', 'Revisar y guardar']

/**
 * Años lectivos disponibles, deducidos de los periodos de evaluación del
 * catálogo. Hoy el sistema trabaja sobre un solo año; cuando el backend exponga
 * varios, este selector se llena solo.
 */
export const aniosDe = (periodos = []) =>
  [...new Set(periodos.map((p) => p.anio))].filter(Boolean).map((anio) => ({ value: anio, label: String(anio) }))
