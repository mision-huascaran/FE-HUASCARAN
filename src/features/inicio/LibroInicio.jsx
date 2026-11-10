/**
 * El libro decorativo de Inicio, flotando a la derecha del encabezado.
 *
 * Va en `absolute` para no empujar nada: el encabezado reserva su sitio con
 * padding. Es decoración, así que `alt` vacío y sin eventos de puntero.
 */
export default function LibroInicio() {
  return (
    <img
      src="/images/illustrations/open-book.webp"
      alt=""
      aria-hidden="true"
      width={520}
      height={206}
      decoding="async"
      className="sicedu-libro pointer-events-none absolute right-0 top-1/2 h-11 w-auto -translate-y-1/2 select-none sm:right-2 sm:h-[100px] lg:h-[112px]"
    />
  )
}
