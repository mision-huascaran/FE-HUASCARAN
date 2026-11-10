// Tarjeta de Seguimiento de Lectura: libros leídos y su reparto por mes.
//
// LA CIFRA ES EL TOTAL, no el promedio por alumno. El promedio es el dato con
// el que se compara entre colegios —y para eso está el consolidado—, pero la
// pregunta de un dashboard es "cuánto se ha leído", y eso es el total. El
// promedio queda en la etiqueta, que es donde no estorba.
//
// UN MES SIN INFORMACIÓN NO ES UN MES CON CERO LIBROS, y la gráfica de barras
// ya lo respeta: no dibuja barra y rotula el hueco. No se rellena aquí.
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { obtenerLibros } from '../../api/resources/dashboard'
import TarjetaModulo from './TarjetaModulo'
import Grafica from './graficas/Grafica'
import GraficaBarras from './graficas/GraficaBarras'
import { enlaceDeModulo, tituloDeModulo } from './enlacesDeModulo'
import { etiquetaDeEstado, formatearCantidad, sinInformacion } from './estados'

/** El consolidado hereda el año y los colegios de esta consulta (CU034). */
function enlaceDelConsolidado(filtros) {
  const params = new URLSearchParams({ anio: String(filtros.idAnioEscolar) })
  if (filtros.todosLosColegios) params.set('todos', '1')
  else params.set('colegios', filtros.idColegios.join(','))
  return `/dashboard/libros?${params.toString()}`
}

export default function TarjetaLectura({
  filtros,
  contexto,
  hayCambios,
  idRol,
  anioEscolar,
  /** El consolidado por meses es del Supervisor: al Directivo le da 403. */
  conConsolidado = true,
}) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'libros', filtros],
    queryFn: () => obtenerLibros(filtros),
    enabled: Boolean(filtros),
  })

  const resumen = consulta.data?.resumen
  const meses = consulta.data?.meses ?? []
  const titulo = tituloDeModulo('lectura')
  const promedio = resumen?.promedio

  return (
    <TarjetaModulo
      titulo={titulo}
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(consulta.data) && sinInformacion(resumen, 'total')}
      cifra={formatearCantidad(resumen?.total)}
      etiqueta={promedio == null ? 'libros leídos' : `libros leídos · ${promedio} por alumno`}
      detalle="Libros registrados en el año escolar: los de subir nivel más los de sala de lectura."
      aviso={etiquetaDeEstado(resumen)}
      enlace={enlaceDeModulo('lectura', { idRol, filtros })}
      sinInformacion={consulta.data?.sin_informacion ?? []}
    >
      <Grafica
        titulo="Libros leídos por mes"
        tituloVisible={false}
        contexto={contexto}
        anioEscolar={anioEscolar}
        hayDatos={meses.some((m) => !sinInformacion(m, 'cantidad'))}
      >
        <GraficaBarras datos={meses} campo="cantidad" />
      </Grafica>

      {/* La vista nominal por colegio, grado y alumno. Tres palabras, no un
          párrafo con un botón como antes. */}
      {conConsolidado && (
        <Link
          to={enlaceDelConsolidado(filtros)}
          className="self-start text-sm font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          Consolidado por meses
        </Link>
      )}
    </TarjetaModulo>
  )
}
