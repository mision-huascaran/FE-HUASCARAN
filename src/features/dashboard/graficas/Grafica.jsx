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
import { useRef, useState } from 'react'
import { Download } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { useToast } from '../../../components/ui/Toast'
import useConexion from '../../../hooks/useConexion'
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
  children,
}) {
  const caja = useRef(null)
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
          <span className="block text-sm font-semibold text-ink-900">{titulo}</span>
          {contexto.filter(Boolean).map((linea) => (
            <span key={linea} className="block text-xs text-ink-500">
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

      <div ref={caja}>{children}</div>

      {avisos.filter(Boolean).map((aviso) => (
        <p key={aviso} className="mt-2 text-xs text-warning-600">
          {aviso}
        </p>
      ))}
    </figure>
  )
}
