// Cubre: RF-006, RF-007, RF-010, RN-004, RN-008, RN-012, RNF-002
import {
  GraficoAlcanzadoEsperado,
  GraficoCobertura,
  GraficoDistribucion,
  GraficoFluidezComprension,
  GraficoLineasPct,
  GraficoVariacion,
  TarjetaGrafico,
} from '../../components/charts'
import { SERIES_PROGRAMA } from '../../components/charts/tema'

/**
 * Los seis gráficos del dashboard (P12), todos alimentados por la misma
 * respuesta y los mismos filtros (RF-006). Cada uno trae su CSV, que es además
 * su vista de tabla.
 */
export default function GraficosDashboard({ datos, catalogoRazkids, dimension }) {
  const distribucion = datos?.distribucion
  const niveles = distribucion?.niveles ?? []
  const etiquetaDimension = dimension ? `según ${dimension}` : 'nivel general'

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <TarjetaGrafico
        titulo="Distribución por nivel y periodo"
        subtitulo={`Porcentaje de estudiantes en cada nivel (${etiquetaDimension}), en los cuatro cortes del año`}
        ayuda="Cada barra suma 100 %: muestra cómo se reparte el grupo entre los niveles en cada corte diagnóstico. Sirve para ver si la masa se desplaza hacia Logrado y Destacado a lo largo del año."
        nombre="distribucion-por-nivel"
        csv={{
          filas: distribucion?.filas ?? [],
          columnas: [
            { titulo: 'Periodo', valor: 'periodo' },
            { titulo: 'Evaluados', valor: 'total' },
            ...niveles.map((n) => ({ titulo: n, valor: (f) => f.conteos[n] ?? 0 })),
          ],
        }}
      >
        <GraficoDistribucion datos={distribucion} />
      </TarjetaGrafico>

      <TarjetaGrafico
        titulo="Variación de nivel"
        subtitulo="Primer corte del año frente al corte elegido"
        ayuda="Cuántos niveles Raz-Kids subió o bajó cada estudiante desde su primera evaluación del año. Solo cuenta a quienes tienen al menos dos evaluaciones."
        nombre="variacion-de-nivel"
        csv={{
          filas: datos?.variacion?.categorias ?? [],
          columnas: [
            { titulo: 'Categoría', valor: 'nombre' },
            { titulo: 'Estudiantes', valor: 'cantidad' },
            { titulo: 'Porcentaje', valor: 'pct' },
          ],
        }}
      >
        <GraficoVariacion datos={datos?.variacion} />
      </TarjetaGrafico>

      <TarjetaGrafico
        titulo="Nivel alcanzado frente al esperado"
        subtitulo="Promedio Raz-Kids de cada grado y el nivel esperado para ese grado"
        ayuda="Compara el nivel Raz-Kids promedio que alcanzó cada grado con el nivel esperado para él. Una barra azul por debajo de la gris indica un grado que va detrás de lo esperado (RN-013)."
        nombre="alcanzado-vs-esperado"
        csv={{
          filas: datos?.alcanzado_vs_esperado ?? [],
          columnas: [
            { titulo: 'Grado', valor: 'grado' },
            { titulo: 'Evaluados', valor: 'n' },
            { titulo: 'Alcanzado (orden)', valor: 'alcanzado' },
            { titulo: 'Esperado (orden)', valor: 'esperado' },
          ],
        }}
      >
        <GraficoAlcanzadoEsperado datos={datos?.alcanzado_vs_esperado} catalogoRazkids={catalogoRazkids} />
      </TarjetaGrafico>

      <TarjetaGrafico
        titulo="Fluidez frente a Comprensión"
        subtitulo="Porcentaje de estudiantes en cada nivel, por dimensión"
        ayuda="Las dos dimensiones de la rúbrica lado a lado y nunca promediadas (RN-008): un grupo puede leer con fluidez y aún no comprender lo que lee, y un promedio lo escondería."
        nombre="fluidez-vs-comprension"
        csv={{
          filas: datos?.fluidez_vs_comprension ?? [],
          columnas: [
            { titulo: 'Nivel', valor: 'nivel' },
            { titulo: 'Fluidez (%)', valor: 'fluidez' },
            { titulo: 'Comprensión (%)', valor: 'comprension' },
          ],
        }}
      >
        <GraficoFluidezComprension datos={datos?.fluidez_vs_comprension} />
      </TarjetaGrafico>

      <TarjetaGrafico
        titulo="Evolución del programa"
        subtitulo="Porcentaje en Logrado o Destacado, por programa"
        ayuda="Cómo cambia a lo largo del año la proporción de estudiantes en Logrado o Destacado en cada programa. Un corte con menos de cinco evaluaciones no se dibuja."
        nombre="evolucion-por-programa"
        csv={{
          filas: datos?.evolucion_programas ?? [],
          columnas: [
            { titulo: 'Periodo', valor: 'periodo' },
            { titulo: 'Alfabetización (%)', valor: 'p1' },
            { titulo: 'Comprensión Lectora (%)', valor: 'p2' },
          ],
        }}
      >
        <GraficoLineasPct
          datos={datos?.evolucion_programas}
          series={[1, 2].map((id) => ({ clave: `p${id}`, nombre: SERIES_PROGRAMA[id].nombre, color: SERIES_PROGRAMA[id].color }))}
        />
      </TarjetaGrafico>

      <TarjetaGrafico
        titulo="Cobertura del registro por colegio"
        subtitulo="Estudiantes evaluados en el corte, frente a la meta del 100 %"
        ayuda="Qué parte de los estudiantes de cada colegio ya tiene su evaluación del corte. Un logro bajo con poca cobertura no significa que al colegio le vaya mal: significa que todavía no cargó los datos."
        nombre="cobertura-por-colegio"
        csv={{
          filas: datos?.colegios ?? [],
          columnas: [
            { titulo: 'Colegio', valor: 'colegio' },
            { titulo: 'Estudiantes', valor: 'estudiantes' },
            { titulo: 'Evaluados', valor: 'evaluados' },
            { titulo: 'Cobertura (%)', valor: 'cobertura' },
          ],
        }}
      >
        <GraficoCobertura datos={datos?.colegios} />
      </TarjetaGrafico>
    </div>
  )
}
