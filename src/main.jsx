import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Fuentes servidas desde el mismo origen (no desde Google Fonts): la CSP solo
// permite 'self' y un recurso externo sin `integrity` es una alerta de ZAP.
// Los mismos pesos que se pedían a Google Fonts; cada CSS trae font-display: swap.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './styles/index.css'
import { registrarServiceWorker } from './lib/actualizacion'

/**
 * D43 — El Service Worker, para que la aplicación ABRA sin conexión.
 *
 * Se registra después de pintar, no antes: instalarlo no debe retrasar el
 * primer render, y si falla —navegador sin soporte, desarrollo— la aplicación
 * funciona igual, solo que recargar sin señal volverá a dar el error del
 * navegador.
 */
registrarServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
