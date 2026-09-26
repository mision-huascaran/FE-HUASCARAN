import '@testing-library/jest-dom/vitest'

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
