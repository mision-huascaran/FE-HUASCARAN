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
 * - `idPeriodo`: HEREDADO, en retirada. Era "el periodo de evaluación vigente"
 *   para TODA la aplicación, elegido en la barra superior. CU027 lo deja sin
 *   sentido: el año se reparte en PA1 a PA4 con sus recesos y cada colegio
 *   puede tener fechas propias, así que no hay un periodo único que valga para
 *   todos. El periodo aplicable es función de (colegio, fecha) y lo resuelve
 *   el servidor: `GET /calendarios/periodo`, o el calendario descargado en
 *   `auth/habilitaciones.js` cuando no hay conexión.
 *
 *   Las pantallas vivas ya no lo usan. Siguen leyéndolo las del mockup antiguo
 *   —Ranking, Consolidados, Nivel final, Panel ejecutivo, Reportes y Consulta
 *   de colegios—, que están pendientes de decidir si se retiran. NO AÑADIR
 *   consumidores nuevos: lo que haga falta se pide al calendario del colegio.
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
