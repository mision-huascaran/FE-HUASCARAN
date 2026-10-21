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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
