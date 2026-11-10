// Tema claro / oscuro / del sistema (rediseño visual).
//
// La preferencia se guarda en `localStorage` con la clave `sicedu.tema`; el
// primer pintado lo resuelve `public/tema-inicial.js`, que no puede ir en línea
// por la CSP. Esto mantiene sincronizados los dos botones (barra superior y
// menú "Más") y reacciona si cambia la preferencia del sistema.
import { create } from 'zustand'

export const CLAVE_TEMA = 'sicedu.tema'
export const TEMAS = ['claro', 'oscuro', 'sistema']

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)'
const DURACION_TRANSICION_MS = 280

function leerPreferencia() {
  try {
    const guardada = window.localStorage.getItem(CLAVE_TEMA)
    return TEMAS.includes(guardada) ? guardada : 'sistema'
  } catch {
    return 'sistema'
  }
}

function sistemaEnOscuro() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(CONSULTA_OSCURO)?.matches)
}

function aplicar(preferencia, { suave = false } = {}) {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement
  if (suave) {
    raiz.classList.add('sicedu-tema-transicion')
    window.setTimeout(() => raiz.classList.remove('sicedu-tema-transicion'), DURACION_TRANSICION_MS)
  }
  raiz.classList.toggle('dark', preferencia === 'oscuro' || (preferencia === 'sistema' && sistemaEnOscuro()))
}

const useTemaStore = create((set) => ({
  preferencia: typeof window === 'undefined' ? 'sistema' : leerPreferencia(),
  fijar: (preferencia) => {
    try {
      window.localStorage.setItem(CLAVE_TEMA, preferencia)
    } catch {
      // Sin almacenamiento el tema vale para esta visita y nada más.
    }
    aplicar(preferencia, { suave: true })
    set({ preferencia })
  },
}))

if (typeof window !== 'undefined') {
  window.matchMedia?.(CONSULTA_OSCURO)?.addEventListener?.('change', () => {
    if (useTemaStore.getState().preferencia === 'sistema') aplicar('sistema', { suave: true })
  })
}

/** `{ preferencia, siguiente, alternar }`: cicla claro → oscuro → sistema. */
export default function useTema() {
  const preferencia = useTemaStore((s) => s.preferencia)
  const fijar = useTemaStore((s) => s.fijar)
  const siguiente = TEMAS[(TEMAS.indexOf(preferencia) + 1) % TEMAS.length]
  return { preferencia, siguiente, alternar: () => fijar(siguiente) }
}
