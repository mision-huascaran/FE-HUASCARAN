// Cubre: RF-005, RF-009, RF-010, RN-002, RNF-004
import { useQuery } from '@tanstack/react-query'
import { Award, BookOpen, CalendarCheck, School, TrendingUp, Users } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import { GraficoLineasPct, TarjetaGrafico } from '../../components/charts'
import { SERIES_PROGRAMA, formatoPct } from '../../components/charts/tema'
import Ranking from '../colegios/Ranking'
import BloqueDescargas from '../reportes/BloqueDescargas'
import { obtenerPanelEjecutivo } from '../../api/resources/dashboard'
import { mensajeDeError } from '../../api/client'
import useFiltrosStore from '../../store/filtrosStore'
import cn from '../../lib/cn'

/** Signo explícito solo cuando sube: "+3 pp", "-1 pp". */
const conSigno = (valor) => (valor > 0 ? `+${valor}` : String(valor))

/** Sin corte anterior no hay avance que colorear. */
function tonoDelAvance(avance) {
  if (avance == null) return ''
  return avance >= 0 ? 'text-success-600' : 'text-danger-600'
}

/**
 * Panel ejecutivo (P17), pensado para proyector: números grandes y pocos.
 *
 * Es de lectura pura: no tiene ni un formulario de captura, y si el rol 3 llega
 * por URL a una pantalla de registro, `RoleRoute` lo manda a /403 (RNF-004).
 * Pendiente: las funcionalidades propias de Directivos están "a definir" en el
 * diseño (§13); este panel es una propuesta.
 */
export default function PanelEjecutivoPage() {
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const consulta = useQuery({
    queryKey: ['panel-ejecutivo', idPeriodo],
    queryFn: () => obtenerPanelEjecutivo({ periodo: idPeriodo }),
    enabled: Boolean(idPeriodo),
  })

  const d = consulta.data
  const ind = d?.indicadores

  if (consulta.isError) return <EmptyState title="No se pudo cargar el panel" description={mensajeDeError(consulta.error)} />

  const avance = ind?.avance_pp
  const textoAvance = avance == null ? '—' : `${conSigno(avance)} pp`
  const tonoAvance = tonoDelAvance(avance)
  const indicadores = ind
    ? [
        { Icon: Users, label: 'Estudiantes atendidos', valor: ind.estudiantes },
        { Icon: Award, label: 'En Logrado o Destacado', valor: formatoPct(ind.pct_logro) },
        {
          Icon: TrendingUp,
          label: 'Avance frente al corte anterior',
          valor: textoAvance,
          tono: tonoAvance,
        },
        { Icon: School, label: 'Colegios con datos al día', valor: `${ind.colegios_al_dia} de ${ind.total_colegios}`, pie: `≥ ${ind.umbral_al_dia} % de registro en la última semana cerrada` },
        { Icon: BookOpen, label: 'Libros leídos en el año', valor: ind.libros_anio.toLocaleString('es-PE') },
        { Icon: CalendarCheck, label: 'Asistencia promedio', valor: formatoPct(ind.asistencia_promedio) },
      ]
    : []

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Panel ejecutivo</h1>
        <p className="mt-1 text-sm text-ink-500">Los indicadores de alto nivel del programa de lectoescritura.</p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {!ind
          ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="card" />)
          : indicadores.map(({ Icon, label, valor, tono, pie }) => (
              <div key={label} className="rounded-xl border border-line bg-surface-0 p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
                </div>
                <p className={cn('mt-4 font-display text-4xl font-bold tabular-nums text-ink-900 md:text-5xl', tono)}>{valor}</p>
                {pie && <p className="mt-2 text-xs text-ink-500">{pie}</p>}
              </div>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <TarjetaGrafico
          titulo="Evolución anual por programa"
          subtitulo="% en Logrado o Destacado en cada corte"
          ayuda="Cómo avanza cada programa a lo largo de los cuatro cortes diagnósticos del año."
          nombre="evolucion-anual-por-programa"
          csv={{
            filas: d?.evolucion_programas ?? [],
            columnas: [
              { titulo: 'Periodo', valor: 'periodo' },
              { titulo: 'Alfabetización (%)', valor: 'p1' },
              { titulo: 'Comprensión Lectora (%)', valor: 'p2' },
            ],
          }}
        >
          <GraficoLineasPct
            datos={d?.evolucion_programas}
            series={[1, 2].map((id) => ({ clave: `p${id}`, nombre: SERIES_PROGRAMA[id].nombre, color: SERIES_PROGRAMA[id].color }))}
          />
        </TarjetaGrafico>

        <Card title="Ranking de colegios" subtitle="% en Logrado o Destacado">
          {d ? <Ranking filas={d.ranking} /> : <Skeleton variant="table" rows={5} />}
        </Card>
      </div>

      <BloqueDescargas />
    </div>
  )
}
