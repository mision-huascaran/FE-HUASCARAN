import logoUrl from '../../assets/logo_MH.png'
import cn from '../../lib/cn'

/**
 * Logo de Misión Huascarán + etiqueta SICEDU (§4.4).
 *
 * El logo YA contiene el nombre de la ONG, por eso nunca se escribe
 * "Misión Huascarán" como texto a su costado.
 *
 * El archivo entregado es un PNG blanco con canal alfa, no un SVG. Para
 * conservar el requisito de §4.4 —el logo va en blanco sobre la barra lateral
 * navy y en brand-700 sobre fondos claros, controlado desde la clase de color
 * del contenedor— se usa el alfa del PNG como máscara CSS y se pinta el relleno
 * con `currentColor`. Es el equivalente exacto de `fill="currentColor"` en SVG.
 *
 * Si más adelante llega el logo en SVG, basta cambiar `logoUrl`: la máscara
 * funciona igual con un SVG y la API del componente no cambia.
 */
const ASPECTO = 734 / 300 // proporción real del archivo

/**
 * Un GIF transparente de 1×1 como `src` del `<img>`: lo que se ve es el
 * relleno (`currentColor`) recortado por la máscara, igual que antes con el
 * `<span role="img">`. El `<img alt>` da el mismo rol y nombre de forma nativa.
 */
const PIXEL_TRANSPARENTE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const ALTURAS = { sm: 'h-6', md: 'h-8', lg: 'h-10', xl: 'h-12' }

export default function Logo({ tone = 'light', size = 'md', showLabel = true, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-3',
        tone === 'light' ? 'text-white' : 'text-brand-700',
        className,
      )}
    >
      <img
        src={PIXEL_TRANSPARENTE}
        alt="Misión Huascarán"
        className={cn('block shrink-0', ALTURAS[size] ?? ALTURAS.md)}
        style={{
          aspectRatio: String(ASPECTO),
          backgroundColor: 'currentColor',
          WebkitMaskImage: `url(${logoUrl})`,
          maskImage: `url(${logoUrl})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
      {showLabel && (
        <>
          <span
            aria-hidden="true"
            className={cn('h-6 w-px shrink-0', tone === 'light' ? 'bg-white/25' : 'bg-line-strong')}
          />
          <span className="text-[13px] font-semibold tracking-[0.12em]">SICEDU</span>
        </>
      )}
    </span>
  )
}
