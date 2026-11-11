// La navegación del MÓVIL: una barra de iconos abajo, no un cajón lateral.
//
// Por qué abajo y no el menú lateral de siempre:
//
//   · SE LLEGA CON EL PULGAR. El menú lateral vive detrás de un botón en la
//     esquina superior izquierda, que es justo la zona a la que no llega la
//     mano con la que se sostiene el teléfono. Cambiar de sección era: estirar
//     el pulgar o usar la otra mano, abrir el cajón, elegir, esperar a que se
//     cierre. Tres gestos para lo que aquí es uno.
//   · SE VE DÓNDE ESTÁ UNO sin abrir nada. En un cajón, la sección activa solo
//     existe mientras el cajón está abierto.
//
// El Docente registra de pie, en un aula, con el teléfono en una mano. Esa es
// toda la justificación.
//
// NO SUSTITUYE AL MENÚ LATERAL: lo complementa. Caben cuatro secciones y el
// Docente tiene siete, así que la quinta ranura es "Más", que abre el mismo
// cajón de siempre con la lista completa, el cambio de contraseña y la salida.
// Un rol con cuatro secciones o menos no ve "Más": no haría falta.
import { NavLink } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { navegacionDe, RANURAS_BARRA_INFERIOR as RANURAS } from './navegacion'
import { useAuth } from '../../auth/AuthProvider'
import cn from '../../lib/cn'

const CLASES_ITEM = [
  // `relative` por la barrita de la sección activa, que va en `absolute`.
  'relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2',
  // 56px de alto mínimo: el objetivo táctil de 44px más el aire para no
  // pulsar la sección de al lado.
  'min-h-[56px] min-w-0',
  'text-[11px] font-medium leading-tight',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
].join(' ')

export default function BarraInferior({ onMas }) {
  const { usuario } = useAuth()
  const items = navegacionDe(usuario?.id_rol)
  if (items.length === 0) return null

  const hayMas = items.length > RANURAS
  const visibles = hayMas ? items.slice(0, RANURAS) : items

  return (
    <nav
      aria-label="Secciones"
      /**
       * `pb-[env(safe-area-inset-bottom)]`: en un iPhone, la franja del gesto
       * de inicio se come la última fila de píxeles. Sin esto, el texto de los
       * iconos queda debajo de la barra del sistema.
       */
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden print:hidden',
        'sicedu-cristal-barra rounded-t-2xl border-t border-line/70 shadow-barra',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="flex items-stretch">
        {visibles.map(({ to, corta, label, icon: Icono }) => (
          <li key={to} className="flex min-w-0 flex-1">
            <NavLink
              to={to}
              // El nombre accesible es el LARGO: "Lectura" basta para leerlo de
              // un vistazo, pero no para saber a qué sección lleva si lo lee
              // un lector de pantalla.
              aria-label={label}
              className={({ isActive }) =>
                cn(CLASES_ITEM, isActive ? 'font-semibold text-brand-700' : 'text-ink-500')
              }
            >
              {({ isActive }) => (
                <>
                  {/* La sección activa se marca con una píldora, no con el
                      color solo: un icono azul sobre otro gris es poca
                      diferencia en una pantalla al sol. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200',
                      isActive ? 'bg-brand-100' : 'bg-transparent',
                    )}
                  >
                    <Icono className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.1 : 1.8} />
                  </span>
                  <span className="w-full truncate text-center">{corta}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}

        {hayMas && (
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={onMas}
              aria-label="Más secciones"
              className={cn(CLASES_ITEM, 'text-ink-500')}
            >
              <span aria-hidden="true" className="flex h-7 w-12 items-center justify-center">
                <MoreHorizontal className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              </span>
              <span className="w-full truncate text-center">Más</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
