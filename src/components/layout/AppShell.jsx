import { useState } from 'react'
import LimiteDeError from './LimiteDeError'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import useOfflineQueue from '../../hooks/useOfflineQueue'
import Topbar from './Topbar'

/**
 * Layout común de todas las pantallas autenticadas (P2).
 *
 * RNF-002: de 360px a 1920px. La barra lateral se reserva con `lg:pl-[248px]`;
 * el contenido nunca empuja el ancho del documento —las tablas anchas manejan su
 * propio `overflow-x-auto` dentro de la tarjeta.
 */
export default function AppShell() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Carga la cola guardada en IndexedDB y reanuda los envíos pendientes (RNF-001).
  useOfflineQueue()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="lg:pl-[248px] print:pl-0">
        <Topbar onAbrirMenu={() => setMenuAbierto(true)} />
        {/* `key` fuerza el reinicio del scroll y del estado al cambiar de pantalla. */}
        <main key={pathname} className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
          {/* El límite va DENTRO del armazón: si una pantalla revienta, la
              barra lateral y el menú siguen en pie y el usuario puede irse a
              otra sección en vez de quedarse ante una página en blanco. */}
          <LimiteDeError claveReinicio={pathname}>
            <Outlet />
          </LimiteDeError>
        </main>
      </div>
    </div>
  )
}
