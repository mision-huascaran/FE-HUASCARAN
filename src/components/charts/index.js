// Los gráficos se cargan de forma diferida: recharts es la dependencia más
// pesada del proyecto y solo la necesitan la ficha del estudiante (P11), el
// dashboard (P12) y el panel ejecutivo (P17). Quien entra a capturar el reporte
// semanal no descarga ni un byte de la librería (RN-017).
import { lazy } from 'react'

export const GraficoEvolucion = lazy(() => import('./GraficoEvolucion'))
export const GraficoRubricaSemanal = lazy(() => import('./GraficoRubricaSemanal'))
