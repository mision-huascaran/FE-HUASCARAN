/** @type {import('tailwindcss').Config} */
// Tokens de diseño SICEDU (rediseño Alpine Glass / Alpine Night).
//
// Los VALORES viven en `src/styles/tokens.css`, una vez por tema; aquí solo se
// les pone nombre. Por eso una pantalla escrita con `bg-surface-0 text-ink-900`
// sirve para claro y oscuro sin una sola clase `dark:`.
//
// Cualquier color fuera de estos dos archivos es un error de implementación.
const c = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`

/** Genera `{ 900: 'rgb(var(--ink-900) / …)', … }` para una familia de tokens. */
const familia = (prefijo, claves) =>
  Object.fromEntries(claves.map((clave) => [clave, c(`${prefijo}-${clave}`)]))

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: familia('navy', [900, 800, 700]),
        // `solid` es para FONDOS con texto blanco; 600 y 700, para texto y
        // bordes. En oscuro dejan de poder ser el mismo color: un azul que se
        // lee sobre una tarjeta oscura es demasiado claro para llevar blanco.
        brand: familia('brand', [700, 600, 500, 100, 50, 'solid', 'solidHover']),
        ink: familia('ink', [900, 700, 500, 400]),
        surface: familia('surface', [0, 50, 100]),
        line: { DEFAULT: c('line'), strong: c('line-strong') },
        success: familia('success', [600, 500, 100, 'solid', 'solidHover']),
        warning: familia('warning', [600, 500, 100]),
        danger: familia('danger', [600, 500, 100, 'solid', 'solidHover']),
        info: familia('info', [600, 100]),
        lvl: {
          preinicio: c('lvl-preinicio'), preinicioBg: c('lvl-preinicio-bg'),
          inicio: c('lvl-inicio'), inicioBg: c('lvl-inicio-bg'),
          proceso: c('lvl-proceso'), procesoBg: c('lvl-proceso-bg'),
          logrado: c('lvl-logrado'), logradoBg: c('lvl-logrado-bg'),
          destacado: c('lvl-destacado'), destacadoBg: c('lvl-destacado-bg'),
        },
        // Identidad cromática de los iconos por categoría (ver IconoTinte).
        tinte: {
          azul: c('tinte-azul'), azulBg: c('tinte-azul-bg'),
          violeta: c('tinte-violeta'), violetaBg: c('tinte-violeta-bg'),
          celeste: c('tinte-celeste'), celesteBg: c('tinte-celeste-bg'),
          verde: c('tinte-verde'), verdeBg: c('tinte-verde-bg'),
          turquesa: c('tinte-turquesa'), turquesaBg: c('tinte-turquesa-bg'),
          indigo: c('tinte-indigo'), indigoBg: c('tinte-indigo-bg'),
          naranja: c('tinte-naranja'), naranjaBg: c('tinte-naranja-bg'),
          ambar: c('tinte-ambar'), ambarBg: c('tinte-ambar-bg'),
          rojo: c('tinte-rojo'), rojoBg: c('tinte-rojo-bg'),
          gris: c('tinte-gris'), grisBg: c('tinte-gris-bg'),
        },
      },
      ringOffsetColor: { DEFAULT: c('surface-0') },
      fontFamily: {
        // Una sola familia: Inter, servida desde el mismo origen (CSP).
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--sombra-card)',
        'card-hover': 'var(--sombra-card-hover)',
        drawer: 'var(--sombra-drawer)',
        modal: 'var(--sombra-modal)',
        barra: 'var(--sombra-barra)',
      },
      borderRadius: { lg: '10px', xl: '16px', '2xl': '20px', panel: '22px' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-in-left': { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-up': { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'modal-in': { '0%': { transform: 'translateY(6px) scale(0.985)', opacity: '0' }, '100%': { transform: 'translateY(0) scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'slide-up': 'slide-up 180ms ease-out',
        'modal-in': 'modal-in 180ms cubic-bezier(0.2, 0.8, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
