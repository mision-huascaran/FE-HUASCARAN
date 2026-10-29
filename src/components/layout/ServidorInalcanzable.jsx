// El servidor no contesta, pero la sesión sigue viva (D52, CU011, CU012).
//
// Antes esto acababa en el login: cualquier fallo de `GET /me` borraba la
// sesión, así que con el backend caído la aplicación echaba al usuario y le
// hacía creer que su sesión había expirado. Son dos cosas distintas y la
// diferencia importa: de una se vuelve esperando, de la otra hay que entrar
// otra vez.
//
// El token se conserva. Lo único que falta es el perfil, y sin él no se puede
// decidir qué menú ni qué módulos pintar, así que la aplicación no entra: se
// queda aquí, lo explica y ofrece volver a intentarlo.
import { CloudOff } from 'lucide-react'
import Button from '../ui/Button'

export default function ServidorInalcanzable({ onReintentar }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-50 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100 text-ink-400">
        <CloudOff className="h-7 w-7" aria-hidden="true" />
      </span>

      <div className="max-w-md">
        <h1 className="text-xl font-bold text-ink-900">No se pudo contactar con el servidor</h1>
        <p className="mt-2 text-sm text-ink-500">
          Tu sesión sigue abierta. Comprueba tu conexión e inténtalo nuevamente.
        </p>
      </div>

      <Button onClick={onReintentar}>Reintentar</Button>
    </div>
  )
}
