// "Consolidado de libros leídos" (CU034, y el resumen de libros de CU035).
//
// Lo que distingue este bloque de una tabla de sumas:
//
//  · CADA CANTIDAD SE ATRIBUYE AL MES DE SU CLASE DE REFERENCIA, no al mes en
//    que se registró ni al de la sincronización. Eso lo resuelve el servidor;
//    aquí lo importante es que los meses llegan CON SU AÑO, porque el
//    calendario escolar puede abarcar dos.
//  · EL PROMEDIO ES POR ALUMNO DE LAS LISTAS HISTÓRICAS, contando a cada
//    alumno una sola vez por colegio. Se muestra con dos decimales y se ordena
//    con el valor sin redondear, que es lo que hace el servidor: por eso la
//    tabla se pinta en el orden en que llega.
//  · UN COLEGIO SIN INFORMACIÓN SUFICIENTE NO ES UN CERO: va aparte, sin
//    posición. "No se añaden filas de totales que repitan la información del
//    resumen y del gráfico", así que la tabla no lleva fila de totales.
//  · "No realizada" APORTA 0, y ese 0 es un dato confirmado, distinto del
//    hueco de un mes sin registros esperados.
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Eye } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import { obtenerLibros } from '../../api/resources/dashboard'
import { formatearFecha } from '../../lib/format'
import BloqueDashboard from './BloqueDashboard'
import Grafica from './graficas/Grafica'
import GraficaBarras from './graficas/GraficaBarras'
import {
  SIN_INFORMACION,
  SIN_REGISTROS_LECTURA,
  TOTAL_PARCIAL,
  celda,
  etiquetaDeEstado,
  formatearCantidad,
  formatearIndice,
  sinInformacion,
} from './estados'

export default function BloqueLibros({ filtros, contexto, hayCambios, anioEscolar, alcance, onColegio }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'libros', filtros],
    queryFn: () => obtenerLibros(filtros),
    enabled: Boolean(filtros),
  })

  const datos = consulta.data
  const resumen = datos?.resumen
  const meses = datos?.meses ?? []
  const colegios = datos?.colegios ?? []
  const sinInfo = datos?.sin_informacion ?? []
  const aviso = etiquetaDeEstado(resumen)

  // Las columnas de meses se construyen con lo que llega, no con un calendario
  // escrito aquí: el año escolar no siempre empieza en marzo.
  const columnasDeMes = meses.map((mes) => ({
    key: `${mes.anio}-${mes.mes}`,
    header: mes.anio && meses.some((m) => m.anio !== mes.anio) ? `${mes.nombre}` : mes.nombre.split(' ')[0],
    align: 'right',
    render: (fila) => {
      const suyo = fila.meses?.find((m) => m.mes === mes.mes && m.anio === mes.anio)
      return celda(suyo, 'cantidad')
    },
  }))

  return (
    <BloqueDashboard
      titulo={`Consolidado de libros leídos ${alcance}`}
      contexto={[
        ...contexto,
        datos?.consultado_hasta ? `Consultado hasta el ${formatearFecha(datos.consultado_hasta)}` : null,
      ]}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(datos) && sinInformacion(resumen, 'total') && colegios.length === 0}
      mensajeVacio={SIN_REGISTROS_LECTURA}
      acciones={aviso && <Badge tone="warning">{aviso}</Badge>}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={BookOpen}
            label={resumen?.provisional ? TOTAL_PARCIAL : 'Total de libros leídos'}
            value={celda(resumen, 'total', formatearCantidad)}
          />
          <StatCard label="Alumnos incluidos" value={celda(resumen, 'alumnos', formatearCantidad)} />
          <StatCard
            label="Promedio por alumno"
            value={celda(resumen, 'promedio', formatearIndice)}
            hint={resumen?.provisional ? 'Provisional: hay registros incompletos' : undefined}
          />
        </div>

        <Grafica
          titulo={`Libros leídos por mes ${alcance}`}
          contexto={contexto}
          anioEscolar={anioEscolar}
          hayDatos={meses.some((m) => !sinInformacion(m, 'cantidad'))}
          avisos={[resumen?.provisional ? `${TOTAL_PARCIAL}: faltan registros esperados en el intervalo.` : null]}
        >
          <GraficaBarras datos={meses} campo="cantidad" />
        </Grafica>

        <DataTable
          paginated={false}
          stickyFirstColumn
          rows={colegios}
          getRowId={(c) => c.id_colegio}
          columns={[
            {
              key: 'nombre',
              header: 'Colegio',
              render: (c) => (
                <span className="flex items-center gap-2">
                  {c.posicion != null && <span className="text-xs text-ink-400">{c.posicion}.</span>}
                  {c.nombre}
                  {c.provisional && <Badge tone="warning">Provisional</Badge>}
                </span>
              ),
            },
            ...columnasDeMes,
            {
              key: 'total',
              header: 'Total por colegio',
              align: 'right',
              render: (c) => celda(c, 'total', formatearCantidad),
            },
            {
              key: 'alumnos',
              header: 'Alumnos incluidos',
              align: 'right',
              render: (c) => celda(c, 'alumnos', formatearCantidad),
            },
            {
              key: 'promedio',
              header: 'Promedio por alumno',
              align: 'right',
              render: (c) => celda(c, 'promedio', formatearIndice),
            },
            ...(onColegio
              ? [
                  {
                    key: 'acciones',
                    header: '',
                    render: (c) => (
                      <Button size="sm" variant="ghost" iconLeft={Eye} onClick={() => onColegio(c)}>
                        Ver grados
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
          footNote="Los colegios se ordenan de mayor a menor por el promedio de libros leídos por alumno, calculado con el valor sin redondear. Cada alumno se cuenta una sola vez por colegio en el intervalo consultado."
        />

        {sinInfo.length > 0 && (
          <p className="text-xs text-warning-600">
            {SIN_INFORMACION} y sin posición: {sinInfo.map((c) => c.nombre).join(', ')}. No tienen registros
            suficientes para calcular el promedio, que no es lo mismo que tener cero libros.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
