import { create } from 'zustand'

/** Filtros del dashboard consolidado (P12). Vacío = sin filtrar. */
export const FILTROS_DASHBOARD_VACIOS = {
  programa: '',
  colegio: '',
  grado: '',
  aula: '',
  q: '',
  periodo: '',
  dimension: '',
}

/**
 * Filtros que sobreviven a la navegación.
 *
 * - `idPeriodo`: el periodo de evaluación vigente, que la barra superior deja
 *   elegir y todas las pantallas leen (P2).
 * - `dashboard`: los filtros del dashboard (P12). Se guardan aquí para que al
 *   volver a la pantalla sigan puestos, y se reflejan en la URL para que la
 *   vista se pueda compartir (`useFiltrosDashboard`).
 *
 * Se usa zustand y no React Context porque varios gráficos y tablas leen los
 * mismos filtros a la vez: con Context, cualquier cambio re-renderizaría todo
 * el subárbol suscrito.
 */
export const useFiltrosStore = create((set) => ({
  idPeriodo: null,
  dashboard: FILTROS_DASHBOARD_VACIOS,

  setFiltrosDashboard: (parcial) => set((estado) => ({ dashboard: { ...estado.dashboard, ...parcial } })),
  limpiarFiltrosDashboard: () => set({ dashboard: FILTROS_DASHBOARD_VACIOS }),

  setPeriodo: (idPeriodo) => set({ idPeriodo: idPeriodo == null ? null : Number(idPeriodo) }),

  /** Solo fija el periodo si el usuario todavía no eligió uno. */
  fijarPeriodoPorDefecto: (idPeriodo) =>
    set((estado) => (estado.idPeriodo == null ? { idPeriodo: Number(idPeriodo) } : estado)),
}))

export default useFiltrosStore
