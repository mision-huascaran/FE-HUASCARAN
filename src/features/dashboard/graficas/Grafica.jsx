// El marco común de todas las gráficas del dashboard.
//
// Lo que resuelve una sola vez, en vez de nueve:
//
//   · EL CONTEXTO VISIBLE. Los tres CU repiten que cada bloque identifique el
//     año escolar, el periodo o intervalo y los colegios consultados. Aquí van
//     esas líneas, debajo del título, y son las mismas que acaban dentro del
//     PNG.
//   · "DESCARGAR GRÁFICA", y cuándo NO se puede: "La acción permanece
//     deshabilitada mientras la gráfica esté cargando, tenga un error o no
//     disponga de datos para representarse", y "Si pierde la conexión, el
//     sistema solicita recuperarla antes de descargar".
//   · El literal del error de descarga, con reintento (volver a pulsar).
import { cloneElement, isValidElement, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import useConexion from '../../../hooks/useConexion'
import useAnchoDe from '../../../hooks/useAnchoDe'
import useMediaQuery from '../../../hooks/useMediaQuery'
import descargarGrafica from '../../../lib/descargarGrafica'
import { ERROR_DESCARGA } from '../estados'

export default function Grafica({
  titulo,
  /** Líneas de contexto: año, periodo, colegios, fecha de la consulta. */
  contexto = [],
  /** Advertencias que el CU exige conservar también en la imagen. */
  avisos = [],
  anioEscolar,
  /** `false` deshabilita la descarga: sin datos no hay nada que exportar. */
  hayDatos = true,
  /** `false` cuando el título repite el del bloque: queda para el lector de pantalla y el PNG. */
  tituloVisible = true,
  children,
}) {
  const caja = useRef(null)
  /** Por debajo de `sm` (640 px de Tailwind) la gráfica se dibuja compacta. */
  const compacto = useMediaQuery('(max-width: 639px)')
  /** Con el ancho real de la caja cada gráfica ajusta sus letras (ver `escala.js`). */
  const anchoVisible = useAnchoDe(caja)
  const [descargando, setDescargando] = useState(false)
  const enLinea = useConexion()
  const toast = useToast()

  const descargar = async () => {
    setDescargando(true)
    try {
      await descargarGrafica(caja.current?.querySelector('svg'), {
        titulo,
        anioEscolar,
        encabezado: contexto,
        pie: avisos,
      })
    } catch {
      toast.error(ERROR_DESCARGA)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <figcaption className="min-w-0">
          <span className={tituloVisible ? 'block text-sm font-semibold text-ink-900' : 'sr-only'}>{titulo}</span>
          {/* El contexto ya está en la cabecera del bloque: aquí se repetía en
              tres líneas (U10). Sigue para el lector de pantalla, y el PNG lo
              recibe aparte, en `encabezado`. */}
          {contexto.filter(Boolean).map((linea) => (
            <span key={linea} className="sr-only">
              {linea}
            </span>
          ))}
        </figcaption>

        <Button
          size="sm"
          variant="ghost"
          iconLeft={Download}
          loading={descargando}
          disabled={!hayDatos || !enLinea}
          title={!enLinea ? 'Conéctate a Internet para descargar la gráfica.' : undefined}
          onClick={descargar}
        >
          Descargar gráfica
        </Button>
      </div>

      {/*
        EN MÓVIL LA GRÁFICA ENTRA ENTERA, CON LAS LETRAS MÁS GRANDES.

        Antes se le dejaba su ancho de 680 y se deslizaba en horizontal, porque
        metido en 360 px sus etiquetas se reducían a la mitad y dejaban de
        leerse. Con una sola gráfica pasaba; con un dashboard de cuatro
        tarjetas son cuatro desplazamientos laterales, y en un teléfono eso es
        justo lo que nadie hace: se mira, no se explora.

        Ahora en móvil la gráfica entra completa y es el TEXTO el que se dibuja
        al doble, de modo que tras la reducción se lee al tamaño de siempre.
        El `min-w` se queda solo para las gráficas que no admiten compacto.
      */}
      <div className="sicedu-scrollbar -mx-1 overflow-x-auto px-1">
        <div ref={caja} className={compacto ? '' : 'min-w-[560px] sm:min-w-0'}>
          {/* El modo lo decide el marco, no cada tarjeta: así ninguna se
              olvida y la descarga a PNG sigue saliendo del mismo nodo. */}
          {isValidElement(children) ? cloneElement(children, { compacto, anchoVisible }) : children}
        </div>
      </div>

      {avisos.filter(Boolean).map((aviso) => (
        <p key={aviso} className="mt-2 text-xs text-warning-600">
          {aviso}
        </p>
      ))}
    </figure>
  )
}
