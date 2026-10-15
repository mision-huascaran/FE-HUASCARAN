// Límite de error alrededor del contenido de cada pantalla.
//
// POR QUÉ EXISTE. Un error al pintar —leer `.join` de algo que ya no viene, o
// meter un objeto donde React espera texto— no rompe solo esa celda: React
// desmonta el árbol entero y el usuario ve una PÁGINA EN BLANCO, sin ninguna
// pista de qué pasó. Con los contratos del backend todavía moviéndose, eso ha
// ocurrido ya dos veces.
//
// Esto no arregla el fallo: lo acota. La barra lateral y el menú siguen vivos,
// el usuario puede irse a otra sección, y en desarrollo se ve el mensaje real
// en vez de tener que abrir la consola.
//
// Tiene que ser una clase: `componentDidCatch` no tiene equivalente en hooks.
import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class LimiteDeError extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Queda en consola con el componente culpable, que es lo que hace falta
    // para arreglarlo. No se manda a ningún sitio: no hay servicio de errores.
    console.error('Error al pintar la pantalla:', error, info?.componentStack)
  }

  componentDidUpdate(prevProps) {
    // Al cambiar de ruta se reintenta: si no, la pantalla rota se quedaría
    // pegada aunque el usuario navegue a otra sección.
    if (this.state.error && prevProps.claveReinicio !== this.props.claveReinicio) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-warning-600" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-ink-900">No se pudo mostrar esta pantalla</h2>
        <p className="max-w-md text-sm text-ink-500">
          Puede seguir usando el resto de la aplicación desde el menú. Si vuelve a ocurrir, avise
          indicando en qué sección estaba.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-2 max-w-full overflow-auto rounded-lg bg-surface-100 p-3 text-left text-xs text-danger-600">
            {String(error?.message ?? error)}
          </pre>
        )}
      </div>
    )
  }
}
