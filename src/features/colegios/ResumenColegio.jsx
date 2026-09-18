// Cubre: RF-007, RF-008, RN-002, RN-004
import { Award, CalendarCheck, TrendingUp, Users } from 'lucide-react'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import { BarraSegmentada, GraficoLineasPct, TarjetaGrafico } from '../../components/charts'
import { COLORES, COLOR_PRINCIPAL, formatoPct } from '../../components/charts/tema'
import Ranking from './Ranking'

/**
 * Cuerpo del detalle de un colegio (P13). Lo reutiliza la consulta de otros
 * colegios del profesor (RF-003), que es la misma información en solo lectura.
 */
export default function ResumenColegio({ detalle }) {
  const { indicadores: ind, grados = [], evolucion = [], aulas = [] } = detalle

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Estudiantes" value={ind.estudiantes} hint={`${ind.evaluados} evaluados en el corte`} />
        <StatCard icon={Award} label="En Logrado o Destacado" value={formatoPct(ind.pct_logro)} />
        <StatCard icon={CalendarCheck} label="Cobertura" value={formatoPct(ind.cobertura)} />
        <StatCard
          icon={TrendingUp}
          label="Subió de nivel"
          value={formatoPct(ind.pct_subio)}
          hint={ind.pct_subio == null ? 'Primer corte: no hay con qué comparar' : 'Frente al corte anterior'}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TarjetaGrafico
          titulo="Evolución frente al promedio"
          subtitulo="% en Logrado o Destacado: este colegio y el promedio de los nueve"
          ayuda="Compara el colegio con el promedio de los nueve colegios del programa en cada corte. La línea punteada es la referencia."
          nombre={`evolucion-${detalle.colegio.abreviatura}`}
          csv={{
            filas: evolucion,
            columnas: [
              { titulo: 'Periodo', valor: 'periodo' },
              { titulo: 'Colegio (%)', valor: 'colegio' },
              { titulo: 'Promedio de los nueve (%)', valor: 'promedio' },
            ],
          }}
        >
          <GraficoLineasPct
            datos={evolucion}
            series={[
              { clave: 'colegio', nombre: detalle.colegio.nombre, color: COLOR_PRINCIPAL },
              { clave: 'promedio', nombre: 'Promedio de los nueve', color: COLORES.referencia, punteada: true },
            ]}
          />
        </TarjetaGrafico>

        <Card title="Ranking de aulas" subtitle="% en Logrado o Destacado dentro del colegio (RF-008)">
          <Ranking filas={aulas} conPodio={false} unidad="aula" />
        </Card>
      </div>

      <Card title="Grados" subtitle="Distribución por nivel, docente asignado y cobertura del corte" padded={false}>
        <DataTable
          getRowId={(g) => g.id_grado}
          rows={grados}
          paginated={false}
          columns={[
            { key: 'grado', header: 'Grado', className: 'font-medium text-ink-900' },
            { key: 'distribucion', header: 'Distribución', render: (g) => <BarraSegmentada conteos={g.conteos} /> },
            { key: 'pct_logro', header: '% logro', align: 'right', render: (g) => formatoPct(g.pct_logro) },
            {
              key: 'cobertura',
              header: 'Cobertura',
              align: 'right',
              render: (g) => `${formatoPct(g.cobertura)} (${g.evaluados}/${g.estudiantes})`,
            },
            { key: 'docente', header: 'Docente', render: (g) => <span className="text-xs text-ink-500">{g.docente}</span> },
          ]}
        />
      </Card>
    </div>
  )
}
