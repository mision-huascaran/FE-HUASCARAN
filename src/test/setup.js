import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// `testTimeout` (vite.config.js) limita la prueba entera; esto limita cada espera
// de findBy*/waitFor, y por defecto es 1 s. El agente de Jenkins es bastante más
// lento que una máquina de desarrollo —la suite tarda ~80 s allí frente a ~13 s
// aquí—, así que los casos que encadenan login → /me → carga de la pantalla
// (unos 750 ms en local) se pasaban del segundo y fallaban de forma intermitente.
// No hace que nada espere de más: es un tope, y cada consulta resuelve en cuanto
// el elemento aparece.
configure({ asyncUtilTimeout: 5000 })

// jsdom no implementa matchMedia y los componentes responsivos (FilterBar, la
// barra lateral) lo consultan al montarse. Se declara aquí como "escritorio".
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom no implementa ResizeObserver y el ResponsiveContainer de recharts lo
// necesita para medir su contenedor. Este sustituto solo existe en las pruebas:
// los gráficos no llegan a dibujarse (jsdom no tiene medidas), pero la página
// que los contiene sí se monta y se puede comprobar.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
