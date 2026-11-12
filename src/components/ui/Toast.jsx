import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import cn from '../../lib/cn'

const DURACION_MS = 4000

/**
 * Cuántos avisos como mucho a la vez.
 *
 * Sin tope, una ráfaga de errores de sincronización (cada reintento manda el
 * suyo) apilaba uno tras otro hasta cubrir media pantalla y aturdir a quien
 * los mira. Se queda con los más NUEVOS, que son los que todavía describen
 * algo que puede seguir pasando; los viejos ya expiraron solos de todas
 * formas a los 4 s.
 */
const MAXIMO_AVISOS = 8

const TONOS = {
  success: { Icon: CheckCircle2, clases: 'border-success-600/20 bg-success-100 text-success-600' },
  error: { Icon: XCircle, clases: 'border-danger-600/20 bg-danger-100 text-danger-600' },
  warning: { Icon: AlertTriangle, clases: 'border-warning-600/20 bg-warning-100 text-warning-600' },
  info: { Icon: Info, clases: 'border-info-600/20 bg-info-100 text-info-600' },
}

const ToastContext = createContext(null)

/** `const toast = useToast(); toast.success('Semana guardada')` */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])
  const idRef = useRef(0)

  const cerrar = useCallback((id) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id))
  }, [])

  /**
   * D009 del reporte de UX: iniciar y finalizar varias veces apilaba un aviso
   * por clic. Un aviso con la misma `clave` REEMPLAZA al anterior (el de la
   * actividad dice siempre cómo quedó, no la historia de clics), y uno idéntico
   * a otro que ya se ve no se repite: se renueva.
   */
  const push = useCallback((tone, message, description, { clave } = {}) => {
    const id = ++idRef.current
    const repetido = (a) =>
      (clave && a.clave === clave) || (a.tone === tone && a.message === message && a.description === description)
    setAvisos((prev) =>
      [...prev.filter((a) => !repetido(a)), { id, tone, message, description, clave }].slice(-MAXIMO_AVISOS),
    )
    return id
  }, [])

  const api = useMemo(
    () => ({
      push,
      cerrar,
      success: (m, d, o) => push('success', m, d, o),
      error: (m, d, o) => push('error', m, d, o),
      warning: (m, d, o) => push('warning', m, d, o),
      info: (m, d, o) => push('info', m, d, o),
    }),
    [push, cerrar],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 lg:bottom-5 lg:right-5"
          >
            {avisos.map((a) => (
              <ToastItem key={a.id} {...a} onCerrar={cerrar} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

function ToastItem({ id, tone = 'info', message, description, onCerrar }) {
  const { Icon, clases } = TONOS[tone] ?? TONOS.info
  const onClose = () => onCerrar(id)

  // Depende del id y de `cerrar`, que son estables. Antes dependía de una
  // función nueva en cada render: cada aviso que llegaba reiniciaba los 4 s de
  // todos los demás, y en una ráfaga ninguno se cerraba solo (D009).
  useEffect(() => {
    const temporizador = setTimeout(() => onCerrar(id), DURACION_MS)
    return () => clearTimeout(temporizador)
  }, [id, onCerrar])

  return (
    <output
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-modal animate-slide-up',
        clases,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{message}</p>
        {description && <p className="mt-0.5 text-xs text-ink-700">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="-m-1.5 shrink-0 rounded-lg p-1.5 text-ink-500 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <X className="h-4 w-4" />
      </button>
    </output>
  )
}

export default ToastProvider
