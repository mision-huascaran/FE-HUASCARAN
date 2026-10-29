// "Evolución de la cobertura de Alumnos" (CU033 paso 9) y la evolución anual
// del Directivo (CU035 paso 8).
//
// ES ANUAL, Y NO CAMBIA CON EL FILTRO DE PERIODO ACADÉMICO. El CU lo repite dos
// veces, y el contrato lo convierte en un 422 si se manda el periodo: de eso se
// encarga `parametrosDe(filtros, 'prohibido')` en el recurso.
//
// Dos reglas de lectura que el bloque tiene que respetar:
//
//  · UN ALUMNO QUE CAMBIÓ DE COLEGIO SE CUENTA UNA SOLA VEZ en el total anual,
//    y los PA NO SE SUMAN para obtener la cobertura del año. Por eso el total
//    anual puede ser menor que la suma de los periodos, y por eso el pie de la
//    tabla lo explica: si no, parece un error de cuadre.
//  · UN AÑO SIN INFORMACIÓN NO SE DIBUJA COMO CERO. Solo aparecen los años con
//    datos, y el año en curso va marcado como parcial.
import { useQuery } from '@tanstack/react-query'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import { obtenerEvolucionAnual } from '../../api/resources/dashboard'
import BloqueDashboard from './BloqueDashboard'
import Grafica from './graficas/Grafica'
import GraficaLineas from './graficas/GraficaLineas'
import { SIN_INFORMACION, formatearCantidad } from './estados'

const NOTA =
  'Cuenta alumnos únicos atendidos durante el año escolar según su pertenencia histórica, y los colegios con al menos un alumno atendido. Un alumno que cambió de colegio o de subprograma se cuenta una sola vez, y los periodos académicos no se suman para obtener el total del año.'

export default function BloqueEvolucion({ filtros, contexto, hayCambios, anioEscolar, conLibros = false }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'evolucion-anual', filtros],
    queryFn: () => obtenerEvolucionAnual(filtros),
    enabled: Boolean(filtros),
  })

  const anios = consulta.data?.anios ?? []
  const mensaje = consulta.data?.mensaje

  return (
    <BloqueDashboard
      titulo={conLibros ? 'Evolución anual de alumnos atendidos y libros leídos' : 'Evolución de la cobertura de Alumnos'}
      // El contexto NO lleva el periodo: este bloque es anual y decir "Tercer
      // periodo" aquí haría leer cifras anuales como si fueran del PA.
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(consulta.data) && anios.length === 0}
      acciones={anios.some((a) => a.parcial) && <Badge tone="warning">Parcial</Badge>}
    >
      <div className="flex flex-col gap-5">
        <Grafica
          titulo="Alumnos atendidos por año escolar"
          contexto={contexto}
          anioEscolar={anioEscolar}
          hayDatos={anios.length > 0}
          avisos={[mensaje]}
        >
          <GraficaLineas datos={anios} campo="alumnos_atendidos" sufijo="" />
        </Grafica>

        {conLibros && (
          <Grafica
            titulo="Libros leídos por año escolar"
            contexto={contexto}
            anioEscolar={anioEscolar}
            hayDatos={anios.some((a) => a.libros != null)}
            avisos={[mensaje]}
          >
            <GraficaLineas datos={anios} campo="libros" sufijo="" />
          </Grafica>
        )}

        <DataTable
          paginated={false}
          rows={anios}
          getRowId={(a) => a.id_anio_escolar}
          columns={[
            {
              key: 'nombre',
              header: 'Año escolar',
              render: (a) => (
                <span className="flex items-center gap-2">
                  {a.nombre}
                  {a.parcial && <Badge tone="warning">Parcial</Badge>}
                </span>
              ),
            },
            // `colegios_atendidos`, el número: en el backend `colegios` es una
            // lista por colegio (ver `adaptarEvolucion`).
            {
              key: 'alumnos_atendidos',
              header: 'Alumnos atendidos',
              align: 'right',
              render: (a) => formatearCantidad(a.alumnos_atendidos),
            },
            {
              key: 'colegios_atendidos',
              header: 'Colegios atendidos',
              align: 'right',
              render: (a) => formatearCantidad(a.colegios_atendidos),
            },
            ...(conLibros
              ? [
                  {
                    key: 'libros',
                    header: 'Libros leídos',
                    align: 'right',
                    render: (a) => (a.libros == null ? SIN_INFORMACION : formatearCantidad(a.libros)),
                  },
                ]
              : []),
          ]}
          footNote={NOTA}
        />

        {/* Con un solo año no hay evolución que mostrar, y se dice: una línea
            de un punto parece una gráfica rota. */}
        {mensaje && <p className="text-xs text-ink-500">{mensaje}</p>}
      </div>
    </BloqueDashboard>
  )
}
