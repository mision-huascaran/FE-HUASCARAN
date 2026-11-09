// Tarjeta de Registro de Vuelo: cuántos tienen nivel colocado y en qué nivel.
//
// Es la única de las cuatro que habla de RESULTADO y no de avance: el nivel
// colocado es la decisión del Docente sobre dónde está cada alumno, y el
// reparto por nivel es la foto del grupo. Por eso la gráfica es la
// distribución y no un porcentaje de completitud.
//
// La cifra sí es de cobertura —cuántos tienen nivel— porque una distribución
// calculada sobre la mitad del grupo no se puede leer sin saber que es la
// mitad.
import { useQuery } from '@tanstack/react-query'
import { obtenerResultadosAprendizaje } from '../../api/resources/dashboard'
import TarjetaModulo from './TarjetaModulo'
import Grafica from './graficas/Grafica'
import GraficaBarras from './graficas/GraficaBarras'
import { enlaceDeModulo, tituloDeModulo } from './enlacesDeModulo'
import { formatearPorcentaje } from './estados'
import { CLAVE_VUELO, completitud, dimensionesDe, nivelesSumados } from './resultadosPorModulo'

export default function TarjetaVuelo({ filtros, contexto, hayCambios, idRol, anioEscolar }) {
  // Misma clave que la tarjeta de Rúbrica: una sola petición para las dos.
  const consulta = useQuery({
    queryKey: ['dashboard', 'resultados', filtros],
    queryFn: () => obtenerResultadosAprendizaje(filtros),
    enabled: Boolean(filtros),
  })

  const dimensiones = dimensionesDe(consulta.data, CLAVE_VUELO)
  const { porcentaje, pendientes, esperadas } = completitud(dimensiones)
  const niveles = nivelesSumados(dimensiones)
  const titulo = tituloDeModulo('vuelo')

  return (
    <TarjetaModulo
      titulo={titulo}
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(consulta.data) && !esperadas}
      cifra={formatearPorcentaje(porcentaje)}
      etiqueta={pendientes ? `con nivel colocado · ${pendientes} sin decidir` : 'con nivel colocado'}
      detalle="Alumnos con nivel colocado sobre los que había que evaluar. El reparto de abajo se calcula solo sobre los que ya lo tienen."
      aviso={pendientes ? 'Evaluación incompleta' : null}
      enlace={enlaceDeModulo('vuelo', { idRol, filtros })}
      sinInformacion={consulta.data?.colegios_sin_informacion ?? []}
    >
      <Grafica
        titulo="Alumnos por nivel colocado"
        tituloVisible={false}
        contexto={contexto}
        anioEscolar={anioEscolar}
        hayDatos={niveles.some((n) => n.cantidad > 0)}
      >
        <GraficaBarras datos={niveles} campo="cantidad" />
      </Grafica>
    </TarjetaModulo>
  )
}
