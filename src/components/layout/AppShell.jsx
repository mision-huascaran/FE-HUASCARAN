import { useState } from 'react'
import LimiteDeError from './LimiteDeError'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import BarraInferior from './BarraInferior'
import useOfflineQueue from '../../hooks/useOfflineQueue'
import useRegistrosOffline from '../../hooks/useRegistrosOffline'
import Topbar from './Topbar'
import cn from '../../lib/cn'

/**
 * Layout común de todas las pantallas autenticadas (P2).
 *
 * RNF-002: de 360px a 1920px. La barra lateral se reserva con `lg:pl-[260px]`;
 * el contenido nunca empuja el ancho del documento —las tablas anchas manejan su
 * propio `overflow-x-auto` dentro de la tarjeta.
 *
 * EN MÓVIL LA NAVEGACIÓN VIVE ABAJO (`BarraInferior`), donde llega el pulgar, y
 * el menú lateral se queda como cajón para lo que no cabe en cinco ranuras. Es
 * la misma aplicación con otro armazón, no una versión aparte: una pantalla que
 * se arregle aquí se arregla en los dos sitios.
 */
export default function AppShell() {
  const [menuAbierto, setMenuAbierto] = useState(false)
  // Carga la cola guardada en IndexedDB y reanuda los envíos pendientes (RNF-001).
  useOfflineQueue()
  // Lectura, Rúbrica y Vuelo: lo que vuelve de la cola se escribe en pantalla.
  useRegistrosOffline()
  const { pathname } = useLocation()
  // El paisaje es exclusivo de Inicio; el resto va sobre el azul grisáceo liso.
  const conPaisaje = pathname === '/inicio'

  return (
    <div className={cn('sicedu-fondo relative min-h-screen', conPaisaje && 'sicedu-con-paisaje')}>
      {conPaisaje && <div className="sicedu-paisaje" aria-hidden="true" />}
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      {/* El hueco de arriba y abajo es RELLENO del contenedor, no margen del
          panel: el margen colapsaba hacia afuera y sumaba 12 px a la altura de
          la pantalla, así que todas las vistas tenían scroll aunque cupieran
          (D006 y S001 del reporte de UX). */}
      <div className="relative lg:py-3 lg:pl-[260px] print:p-0">
        <div className="sicedu-panel lg:mr-3 lg:min-h-[calc(100vh-1.5rem)] lg:rounded-panel lg:border lg:border-line/60 lg:shadow-card print:m-0 print:border-0 print:shadow-none">
        <Topbar onAbrirMenu={() => setMenuAbierto(true)} />
        {/* `key` fuerza el reinicio del scroll y del estado al cambiar de pantalla. */}
        {/* `pb-24` en móvil: sin ese hueco, la barra inferior tapa la última
            fila de la tabla o el botón de guardar, que es justo lo que se
            estaba intentando pulsar. */}
        <main key={pathname} className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-7 lg:pb-8">
          {/* El límite va DENTRO del armazón: si una pantalla revienta, la
              barra lateral y el menú siguen en pie y el usuario puede irse a
              otra sección en vez de quedarse ante una página en blanco. */}
          <LimiteDeError claveReinicio={pathname}>
            <Outlet />
          </LimiteDeError>
        </main>
        </div>
      </div>

      <BarraInferior onMas={() => setMenuAbierto(true)} />
    </div>
  )
}
