import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
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
    plugins: [react()],
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
      },
    },
  }
})
