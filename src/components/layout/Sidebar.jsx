import { createPortal } from 'react-dom'
import { useState } from 'react'
import { ChevronUp, KeyRound, LogOut, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import BotonTema from '../ui/BotonTema'
import Logo from '../ui/Logo'
import ModalCambiarPassword from '../../features/perfil/ModalCambiarPassword'
import ConfirmarSalida from './ConfirmarSalida'
import useSyncStore from '../../store/syncStore'
import useOnEscape from '../../hooks/useOnEscape'
import { useAuth } from '../../auth/AuthProvider'
import { NOMBRE_ROL } from '../../auth/roles'
import { navegacionDe } from './navegacion'
import cn from '../../lib/cn'

/**
 * Barra lateral flotante de 236px (P2). En escritorio va fija; bajo `lg` se muestra como
 * panel deslizante con el botón hamburguesa de la barra superior (RNF-002).
 *
 * No usa el componente `Drawer` porque aquel es un panel blanco de formularios;
 * este es el menú navy y comparte con él la animación y el cierre por Escape.
 */
const ANCHO = 'w-[236px]'
const ANCHO_CAJON = 'w-[288px] max-w-[86vw]'

function iniciales(nombre = '') {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function Contenido({ onNavegar, onCerrar }) {
  const { usuario, salir } = useAuth()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [passwordAbierto, setPasswordAbierto] = useState(false)
  const [confirmarSalida, setConfirmarSalida] = useState(false)
  const pendientes = useSyncStore((s) => s.pendientes)

  // CU007: salir con cambios sin enviar no los borra, pero hay que decirlo —
  // si no, el docente se va creyendo que perdió el trabajo del aula.
  const intentarSalir = () => (pendientes > 0 ? setConfirmarSalida(true) : salir())
  useOnEscape(menuAbierto, () => setMenuAbierto(false))
  const items = navegacionDe(usuario?.id_rol)

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy-800 to-navy-900 text-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:pt-5">
        <Logo tone="light" size="md" />
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="sicedu-scrollbar flex-1 overflow-y-auto px-3 py-2" aria-label="Menú principal">
        <ul className="flex flex-col gap-0.5">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavegar}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 lg:min-h-[40px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-navy-900',
                    isActive
                      ? 'bg-brand-solid/85 text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14),0_6px_16px_rgb(37_99_235/0.32)]'
                      : 'text-white/75 hover:bg-white/[0.07] hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-white/90" aria-hidden="true" />
                    )}
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" strokeWidth={1.8} />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Único sitio con la identidad de quien tiene la sesión: correo, cambio
          de contraseña y salida. Antes esto estaba además en la barra superior
          y el nombre salía dos veces en pantalla. */}
      <div className="border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {onCerrar && <BotonTema fila className="mb-1" />}
        {menuAbierto && (
          <div role="menu" className="mb-1 rounded-lg bg-white/[0.07] p-1.5 animate-slide-up">
            <p className="truncate px-3 py-1.5 text-xs text-white/65">{usuario?.correo}</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuAbierto(false)
                setPasswordAbierto(true)
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:min-h-[38px]"
            >
              <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              Cambiar contraseña
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={intentarSalir}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:min-h-[38px]"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuAbierto}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 focus-visible:ring-offset-navy-900"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-xs font-semibold tracking-wide ring-1 ring-white/20">
            {iniciales(usuario?.nombre_completo)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{usuario?.nombre_completo}</span>
            <span className="block truncate text-xs text-white/70">{NOMBRE_ROL[usuario?.id_rol] ?? '—'}</span>
          </span>
          <ChevronUp
            className={cn('h-4 w-4 shrink-0 text-white/60 transition-transform duration-200', !menuAbierto && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      <ModalCambiarPassword abierto={passwordAbierto} onCerrar={() => setPasswordAbierto(false)} />

      <ConfirmarSalida
        abierto={confirmarSalida}
        pendientes={pendientes}
        onCerrar={() => setConfirmarSalida(false)}
        onSalir={() => {
          setConfirmarSalida(false)
          salir()
        }}
      />
    </div>
  )
}

export default function Sidebar({ abierto = false, onCerrar }) {
  useOnEscape(abierto, onCerrar)

  return (
    <>
      <aside className={cn('fixed inset-y-3 left-3 z-40 hidden overflow-hidden rounded-panel shadow-modal ring-1 ring-white/10 lg:block print:!hidden', ANCHO)}>
        <Contenido />
      </aside>

      {abierto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              tabIndex={-1}
              onClick={onCerrar}
              className="absolute inset-0 h-full w-full cursor-default bg-navy-900/55 backdrop-blur-sm animate-fade-in"
            />
            <div className={cn('absolute inset-y-0 left-0 overflow-hidden rounded-r-2xl shadow-modal animate-slide-in-left', ANCHO_CAJON)}>
              <Contenido onNavegar={onCerrar} onCerrar={onCerrar} />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
