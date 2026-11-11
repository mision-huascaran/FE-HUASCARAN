import cn from '../../lib/cn'

/** Cada categoría tiene su color: el mismo en todas las pantallas y temas. */
const TONOS = {
  azul: 'bg-tinte-azulBg text-tinte-azul',
  violeta: 'bg-tinte-violetaBg text-tinte-violeta',
  celeste: 'bg-tinte-celesteBg text-tinte-celeste',
  verde: 'bg-tinte-verdeBg text-tinte-verde',
  turquesa: 'bg-tinte-turquesaBg text-tinte-turquesa',
  indigo: 'bg-tinte-indigoBg text-tinte-indigo',
  naranja: 'bg-tinte-naranjaBg text-tinte-naranja',
  ambar: 'bg-tinte-ambarBg text-tinte-ambar',
  rojo: 'bg-tinte-rojoBg text-tinte-rojo',
  gris: 'bg-tinte-grisBg text-tinte-gris',
  // Sin cuadro de color: el gris de los iconos de las tarjetas de Inicio
  // (StatCard `sobria`). Conserva el hueco del tamaño para no mover nada.
  neutro: 'text-ink-500',
}

const TAMANOS = {
  sm: { caja: 'h-9 w-9 rounded-[10px]', icono: 'h-[18px] w-[18px]' },
  md: { caja: 'h-11 w-11 rounded-xl', icono: 'h-5 w-5' },
  lg: { caja: 'h-12 w-12 rounded-xl', icono: 'h-[22px] w-[22px]' },
}

/** Icono lineal sobre un cuadrado suave del color de su categoría. */
export default function IconoTinte({ icon: Icon, tono = 'azul', tamano = 'md', className }) {
  const { caja, icono } = TAMANOS[tamano] ?? TAMANOS.md
  return (
    <span className={cn('flex shrink-0 items-center justify-center', caja, TONOS[tono] ?? TONOS.azul, className)}>
      <Icon className={icono} aria-hidden="true" strokeWidth={1.9} />
    </span>
  )
}
