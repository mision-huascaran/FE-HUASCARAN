// "Resultados de aprendizaje" (CU033 paso 6, CU035 paso 6).
//
// Separado por subprograma y por dimensión: nivel global, Fluidez Lectora y
// Comprensión Lectora. Las tres reglas que gobiernan este bloque, todas
// literales del CU:
//
//  1. "PENDIENTES DE EVALUAR" VA APARTE Y NO RECIBE NIVEL. "El sistema no
//     asigna un nivel de desempeño a partir de una evaluación incompleta ni de
//     la pertenencia del alumno a un subprograma."
//  2. LA CONDICIÓN SE DETERMINA POR DIMENSIÓN. Un alumno puede tener resultado
//     en Fluidez y seguir pendiente en Comprensión, así que cada dimensión
//     lleva su propio recuento. No se reutiliza el de al lado.
//  3. LOS PORCENTAJES SE CALCULAN SOBRE LOS EVALUADOS Y SE DICE QUE ES ASÍ.
//     Ese "sobre N evaluados" del pie no es una nota al margen: sin él, un
//     "60 % en Logrado" se lee como del total de alumnos.
import { useQuery } from '@tanstack/react-query'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import { obtenerResultadosAprendizaje } from '../../api/resources/dashboard'
import BloqueDashboard from './BloqueDashboard'
import { SIN_EVALUACIONES_COMPLETAS, etiquetaDeEstado, formatearPorcentaje } from './estados'

function Dimension({ dimension }) {
  const niveles = dimension.niveles ?? []
  const aviso = etiquetaDeEstado(dimension)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-ink-900">{dimension.nombre}</h4>
        {aviso && <Badge tone="warning">{aviso}</Badge>}
      </div>

      {/* El servidor manda TODOS los niveles aunque nadie esté evaluado: sin
          evaluados, la tabla de ceros no se pinta y se dice por qué. */}
      {niveles.length === 0 || !dimension.evaluados ? (
        <EmptyState
          title={dimension.mensaje ?? SIN_EVALUACIONES_COMPLETAS}
          description={`${dimension.pendientes ?? 0} alumnos pendientes de evaluar.`}
        />
      ) : (
        <DataTable
          paginated={false}
          rows={niveles}
          getRowId={(n) => n.nombre}
          columns={[
            { key: 'nombre', header: 'Nivel de desempeño' },
            { key: 'cantidad', header: 'Alumnos', align: 'right' },
            {
              key: 'porcentaje',
              header: '% de evaluados',
              align: 'right',
              render: (n) => formatearPorcentaje(n.porcentaje),
            },
          ]}
          footNote={`Deben evaluarse ${dimension.a_evaluar ?? 0} · evaluados ${dimension.evaluados ?? 0} · pendientes de evaluar ${dimension.pendientes ?? 0}. Los porcentajes se calculan sobre los ${dimension.evaluados ?? 0} alumnos con evaluación completa.`}
        />
      )}
    </div>
  )
}

export default function BloqueResultados({ filtros, contexto, hayCambios }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'resultados', filtros],
    queryFn: () => obtenerResultadosAprendizaje(filtros),
    enabled: Boolean(filtros),
  })

  const programas = consulta.data?.programas ?? []

  return (
    <BloqueDashboard
      titulo="Resultados de aprendizaje"
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(consulta.data) && programas.length === 0}
    >
      <div className="flex flex-col gap-6">
        {programas.map((programa) => (
          <section key={programa.id_programa} className="flex flex-col gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-500">{programa.nombre}</h3>
            {(programa.dimensiones ?? []).map((dimension) => (
              <Dimension key={dimension.clave} dimension={dimension} />
            ))}
          </section>
        ))}

        {(consulta.data?.colegios_sin_informacion?.length ?? 0) > 0 && (
          <p className="text-xs text-warning-600">
            Sin información y fuera de los recuentos:{' '}
            {consulta.data.colegios_sin_informacion.map((c) => c.nombre).join(', ')}.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
