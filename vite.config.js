import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Destino del proxy de desarrollo. El backend sirve en 127.0.0.1:8000 y NO
   * tiene CORS configurado: un preflight `OPTIONS /login` desde el navegador
   * responde 405 y ninguna respuesta trae cabeceras `Access-Control-*`
   * (verificado; ver APIS_BACKEND.md).
   *
   * Con el proxy el navegador habla siempre con su propio origen
   * (localhost:5173/api/…) y es Vite quien llama al backend desde Node, donde
   * la política de mismo origen no aplica. Además es exactamente el modelo de
   * despliegue de §11 del prompt: en producción la API vive bajo el mismo
   * dominio con el prefijo /api, así que el frontend no cambia de forma al
   * desplegarse.
   *
   * Esto NO sustituye a configurar CORSMiddleware en el backend: hace falta
   * igualmente para cualquier entorno que no pase por este servidor.
   */
  const destinoApi = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  return {
    plugins: [
      react(),
      /**
       * D43 — Service Worker y Application Shell.
       *
       * Hasta ahora recargar sin conexión daba el error del navegador
       * (`ERR_INTERNET_DISCONNECTED`): toda la aplicación offline dependía de
       * que la pestaña no se cerrara nunca, lo que en un aula de Yungay no es
       * una suposición razonable.
       *
       * DOS DECISIONES QUE IMPORTAN:
       *
       *   · `registerType: 'prompt'` y no `autoUpdate`. Un despliegue nuevo
       *     no puede cambiar la aplicación bajo los pies de un docente a
       *     mitad de jornada: se avisa y lo decide él.
       *   · `/api/` NO se cachea. Los datos los gestionan IndexedDB y la cola
       *     de envíos, que saben qué está pendiente y qué no. Mezclar las dos
       *     cachés es la forma más rápida de enseñar datos viejos creyendo
       *     que son nuevos.
       */
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'SICEDU · Misión Huascarán',
          short_name: 'SICEDU',
          description: 'Registro académico de Misión Huascarán',
          lang: 'es-PE',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#1d4ed8',
        },
        workbox: {
          // El Application Shell: el HTML, el JS y el CSS del build.
          globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
          // Cualquier ruta de navegación se sirve con `index.html`: es una
          // SPA, así que /asistencia o /alumnos no son documentos distintos.
          navigateFallback: 'index.html',
          // Salvo las de la API, que no son navegación y no se cachean.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
        },
        devOptions: {
          // En desarrollo estorba más que ayuda: deja JS viejo pegado entre
          // recargas y cuesta ver si un cambio llegó.
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(process.cwd(), 'src') },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: destinoApi,
          changeOrigin: true,
          rewrite: (ruta) => ruta.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          /**
           * RN-017: los colegios operan con ~70 % de disponibilidad de conexión.
           * Separar recharts de la aplicación evita que quien solo va a capturar
           * el reporte semanal descargue la librería de gráficos: solo la piden
           * las pantallas que la usan, y queda cacheada aparte entre despliegues.
           */
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      // e2e/ son las pruebas de Playwright: corren contra la app desplegada,
      // no con Vitest (ver playwright.config.js).
      exclude: [...configDefaults.exclude, 'e2e/**'],
      // Informe lcov para SonarQube (stage de pruebas en qa y uat).
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'lcov'],
        // scripts/verificar-csp.mjs: la validación del stage 'Security Headers - CSP'.
        include: ['src/**/*.{js,jsx}', 'scripts/verificar-csp.mjs'],
        // Igual que `sonar.coverage.exclusions`: el arranque (main.jsx) y el
        // simulador de la API (api/mock) no son lógica de la aplicación.
        exclude: ['src/**/__tests__/**', 'src/test/**', 'src/main.jsx', 'src/api/mock/**', 'e2e/**'],
      },
      /**
       * Las pruebas resuelven SIEMPRE contra el mock, pase lo que pase en `.env`.
       * Si tomaran `VITE_AUTH_REAL` del entorno, la suite pasaría o fallaría
       * según si alguien tiene el backend levantado, que es justo lo que una
       * prueba no debe hacer. La integración real se comprueba aparte, con
       * `npm run verificar:backend`.
       */
      env: {
        VITE_USE_MOCK: 'true',
        VITE_AUTH_REAL: 'false',
        VITE_ADMIN_REAL: 'false',
      },
      // Montar el dashboard con sus seis gráficos pasa de los 5 s por defecto
      // cuando la suite corre entera.
      testTimeout: 15_000,
    },
  }
})
