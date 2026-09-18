// Los gráficos se cargan de forma diferida: recharts es la dependencia más
// pesada del proyecto y solo la necesitan la ficha del estudiante (P11), el
// dashboard (P12), colegios (P13) y el panel ejecutivo (P17). Quien entra a
// capturar el reporte semanal no descarga ni un byte de la librería (RN-017).
import { lazy } from 'react'

export const GraficoEvolucion = lazy(() => import('./GraficoEvolucion'))
export const GraficoRubricaSemanal = lazy(() => import('./GraficoRubricaSemanal'))
export const GraficoDistribucion = lazy(() => import('./GraficoDistribucion'))
export const GraficoVariacion = lazy(() => import('./GraficoVariacion'))
export const GraficoAlcanzadoEsperado = lazy(() => import('./GraficoAlcanzadoEsperado'))
export const GraficoFluidezComprension = lazy(() => import('./GraficoFluidezComprension'))
export const GraficoLineasPct = lazy(() => import('./GraficoLineasPct'))
export const GraficoCobertura = lazy(() => import('./GraficoCobertura'))
export const GraficoDispersion = lazy(() => import('./GraficoDispersion'))

// Estos dos no usan recharts y se cargan con la página.
export { default as TarjetaGrafico } from './TarjetaGrafico'
export { default as BarraSegmentada } from './BarraSegmentada'
