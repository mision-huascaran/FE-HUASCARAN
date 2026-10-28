import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import AuthProvider from './auth/AuthProvider'
import RutasApp from './rutas'

/**
 * Router y proveedores de la aplicación.
 *
 * RNF-001: la política de reintentos de TanStack Query es la espera creciente de
 * 1s / 4s / 9s exigida por el requerimiento. Las mutaciones de captura no se
 * reintentan aquí: pasan por la cola en IndexedDB, que controla su propia
 * idempotencia (ver `hooks/useOfflineQueue.js`).
 */
const ESPERAS_MS = [1000, 4000, 9000]

export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * REINTENTAR SOLO LO QUE PUEDE CAMBIAR.
         *
         * Con `retry: 3` a secas, un 403 o un 422 se repetían tres veces con
         * espera creciente: catorce segundos mirando un cargando para acabar
         * viendo un error que nunca iba a cambiar, y tres peticiones que el
         * servidor ya había contestado.
         *
         * Un 4xx es una respuesta: el servidor entendió y dijo que no. Se
         * muestra y punto. Un 5xx o un fallo de red sí pueden resolverse
         * solos, y esos se siguen reintentando.
         */
        retry: (intentos, error) => {
          const estado = error?.response?.status
          if (estado >= 400 && estado < 500) return false
          return intentos < 3
        },
        retryDelay: (intento) => ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)],
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  })
}

const queryClient = crearQueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {/* Se adoptan desde ya los dos comportamientos de React Router 7: evita
            las advertencias en consola y que la migración traiga sorpresas. */}
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <RutasApp />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
