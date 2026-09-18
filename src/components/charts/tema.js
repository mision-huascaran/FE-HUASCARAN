// Tema común de los gráficos. Todo color sale de los tokens de §4.1: ningún
// componente de gráfico define un color por su cuenta.
//
// Las combinaciones de series están VALIDADAS para daltonismo (ΔE OKLab ×100
// entre pares adyacentes, en protanopía, deuteranopía y tritanopía):
//
//   SERIES_EVOLUCION  #2563EB ↔ #1E9E6A → ΔE 26.3 (deutan) · 28.7 (normal) — PASA
//   SERIES_RUBRICA    #2563EB ↔ #946200 → ΔE 31.2 (protan) · 32.8 (normal) — PASA
//
// Si se agrega una serie nueva hay que volver a validar la combinación completa,
// no solo el color añadido. Además del color, cada serie lleva SIEMPRE leyenda,
// de modo que la identidad nunca depende únicamente del color.

import { COLOR_NIVEL } from '../../domain/niveles'

export const COLORES = {
  ejes: '#8A94A6', // ink-400
  grilla: '#E2E8F2', // line
  texto: '#5B6577', // ink-500
  superficie: '#FFFFFF', // surface-0
  referencia: '#8A94A6', // ink-400 — la línea de referencia es recesiva a propósito
}

/** Evolución del estudiante (P11, RF-011). */
export const SERIES_EVOLUCION = {
  prueba: { color: '#2563EB', nombre: 'Nivel de la prueba' }, // brand-500
  ajustado: { color: '#1E9E6A', nombre: 'Nivel ajustado por el docente' }, // success-500
  esperado: { color: COLORES.referencia, nombre: 'Nivel esperado para su grado' },
}

/** Rúbrica semanal: las dos dimensiones nunca se promedian (RN-008). */
export const SERIES_RUBRICA = {
  fluidez: { color: '#2563EB', nombre: 'Fluidez lectora' }, // brand-500
  comprension: { color: '#946200', nombre: 'Comprensión lectora' }, // warning-600
}

/** Series por nivel de rúbrica, para los apilados de distribución. */
export const SERIES_NIVEL = COLOR_NIVEL

/** Ejes y grilla recesivos, igual en todos los gráficos. */
export const EJE = {
  stroke: COLORES.ejes,
  tick: { fill: COLORES.texto, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: COLORES.grilla },
}

export const GRILLA = {
  stroke: COLORES.grilla,
  strokeDasharray: '3 3',
  vertical: false,
}

/** Estilo del tooltip, alineado con las tarjetas del sistema de diseño. */
export const TOOLTIP = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #E2E8F2',
    boxShadow: '0 1px 2px rgba(15,30,61,0.04), 0 8px 24px rgba(15,30,61,0.06)',
    fontSize: 12,
  },
  labelStyle: { color: '#0F1E3D', fontWeight: 600, marginBottom: 4 },
  cursor: { fill: 'rgba(37,99,235,0.06)' },
}

export const LEYENDA = {
  verticalAlign: 'bottom',
  height: 32,
  iconType: 'circle',
  iconSize: 8,
  wrapperStyle: { fontSize: 12, color: COLORES.texto },
}

/** Grosor de línea y tamaño de punto según las especificaciones de marca. */
export const LINEA = { strokeWidth: 2, dot: { r: 4 }, activeDot: { r: 6 } }
