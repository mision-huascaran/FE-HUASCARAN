// Tarjeta de Rúbrica: cuánto está evaluado, y qué dimensión va atrasada.
//
// La cifra es de COMPLETITUD, no de resultado. Es lo que un Supervisor puede
// accionar: un nivel bajo se trabaja en el aula, pero una rúbrica sin
// completar se reclama hoy. Los niveles obtenidos están en la tarjeta de
// Registro de Vuelo, que es donde se deciden.
//
// Fluidez y Comprensión van SEPARADAS en la gráfica a propósito: un promedio
// de las dos esconde justo lo que hay que ver, que es cuál de las dos falta.
import { useQuery } from '@tanstack/react-query'
import { obtenerResultadosAprendizaje } from '../../api/resources/dashboard'
import TarjetaModulo from './TarjetaModulo'
import Grafica from './graficas/Grafica'
import GraficaBarras from './graficas/GraficaBarras'
import { enlaceDeModulo, tituloDeModulo } from './enlacesDeModulo'
import { formatearPorcentaje } from './estados'
import { CLAVES_RUBRICA, avancePorDimension, completitud, dimensionesDe } from './resultadosPorModulo'

export default function TarjetaRubrica({ filtros, contexto, hayCambios, idRol, anioEscolar }) {
  // La misma clave que usa la tarjeta de Registro de Vuelo: TanStack Query
  // reconoce la consulta y las dos tarjetas comparten UNA sola petición.
  const consulta = useQuery({
    queryKey: ['dashboard', 'resultados', filtros],
    queryFn: () => obtenerResultadosAprendizaje(filtros),
    enabled: Boolean(filtros),
  })

  const dimensiones = dimensionesDe(consulta.data, CLAVES_RUBRICA)
  const { porcentaje, pendientes, esperadas } = completitud(dimensiones)
  const avance = avancePorDimension(dimensiones)
  const titulo = tituloDeModulo('rubrica')

  return (
    <TarjetaModulo
      titulo={titulo}
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(consulta.data) && !esperadas}
      cifra={formatearPorcentaje(porcentaje)}
      etiqueta={pendientes ? `evaluado · ${pendientes} pendientes` : 'evaluado'}
      detalle="Evaluaciones completas sobre las esperadas. Fluidez y Comprensión cuentan por separado: un alumno puede tener una y no la otra."
      aviso={pendientes ? 'Evaluación incompleta' : null}
      enlace={enlaceDeModulo('rubrica', { idRol, filtros })}
      sinInformacion={consulta.data?.colegios_sin_informacion ?? []}
    >
      <Grafica
        titulo="Avance por dimensión"
        tituloVisible={false}
        contexto={contexto}
        anioEscolar={anioEscolar}
        hayDatos={avance.some((d) => d.porcentaje != null)}
      >
        <GraficaBarras datos={avance} campo="porcentaje" sufijo=" %" />
      </Grafica>
    </TarjetaModulo>
  )
}
