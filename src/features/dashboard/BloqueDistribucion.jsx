// "Distribución de alumnos por subprograma" (CU033, paso 5). Solo Supervisor.
//
// La dona y la tabla usan LOS MISMOS DATOS y los mismos criterios: el CU lo
// pide expresamente ("Los gráficos y sus tablas de apoyo utilizan los mismos
// datos y criterios de cálculo"), y es la clase de cosa que se rompe sola en
// cuanto la tabla recalcula un porcentaje por su cuenta. Aquí no se recalcula
// nada: los porcentajes llegan del servidor con su decimal.
//
// LA FECHA DE CORTE SE MUESTRA, y no es un detalle: la distribución mira la
// pertenencia histórica "al finalizar el periodo seleccionado" o, si está en
// curso, a la fecha de consulta. Sin esa fecha, dos consultas del mismo PA en
// semanas distintas dan números distintos y parece un error.
import { useQuery } from '@tanstack/react-query'
import { PieChart } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import { obtenerDistribucionSubprograma } from '../../api/resources/dashboard'
import { formatearFecha } from '../../lib/format'
import BloqueDashboard from './BloqueDashboard'
import Grafica from './graficas/Grafica'
import GraficaDona from './graficas/GraficaDona'
import { SIN_INFORMACION, formatearPorcentaje } from './estados'

export default function BloqueDistribucion({ filtros, contexto, hayCambios, anioEscolar }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'distribucion', filtros],
    queryFn: () => obtenerDistribucionSubprograma(filtros),
    enabled: Boolean(filtros),
  })

  const datos = consulta.data
  const partes = datos?.subprogramas ?? []
  const corte = datos?.fechas_corte?.[0]?.fecha
  const sinInformacion = datos?.colegios_sin_informacion ?? []

  return (
    <BloqueDashboard
      titulo="Distribución de alumnos por subprograma"
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(datos) && (datos.sin_datos === true || partes.length === 0)}
      acciones={
        corte && (
          <Badge tone="neutral" icon={PieChart}>
            Pertenencia al {formatearFecha(corte)}
          </Badge>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <Grafica
          titulo="Distribución de alumnos por subprograma"
          contexto={[...contexto, corte ? `Pertenencia al ${formatearFecha(corte)}` : null]}
          anioEscolar={anioEscolar}
          hayDatos={partes.length > 0}
        >
          <GraficaDona partes={partes} total={datos?.total} />
        </Grafica>

        <DataTable
          paginated={false}
          rows={partes}
          getRowId={(f) => f.id_programa}
          columns={[
            { key: 'nombre', header: 'Subprograma' },
            {
              key: 'cantidad',
              header: 'Alumnos',
              align: 'right',
              render: (f) => (f.cantidad == null ? SIN_INFORMACION : f.cantidad),
            },
            {
              key: 'porcentaje',
              header: '% del total',
              align: 'right',
              render: (f) => formatearPorcentaje(f.porcentaje),
            },
          ]}
          footNote={
            datos?.total != null
              ? `Total de alumnos considerados: ${datos.total}. Los porcentajes se calculan sobre ese total.`
              : undefined
          }
        />

        {/* Un colegio cuyo periodo no empezó NO suma y se nombra: pintarlo
            como 0 alumnos sería decir que no tiene ninguno. */}
        {sinInformacion.length > 0 && (
          <p className="text-xs text-warning-600">
            Sin información y fuera del total:{' '}
            {sinInformacion.map((c) => c.nombre).join(', ')}. Todavía no empezaron el periodo seleccionado.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
