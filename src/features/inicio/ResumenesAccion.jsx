// CU010 — Asignaciones y Resúmenes de Acción del Inicio del Docente.
//
// La forma la fija `GET /inicio/docente`:
//
//   asignaciones: [{ colegio, grados: [{ nombre, cantidad_alumnos, ciclos,
//                    subprogramas }] }]
//   totales:      { ciclos, subprogramas, cantidad_alumnos }
//
// Los RESÚMENES DE ACCIÓN ("Has evaluado X de Y") todavía no los manda el
// backend: dependen de las grillas, que no existen. Se pintan solo si llegan,
// en vez de inventar un 0 que diría que no se ha evaluado a nadie.
//
// Todo se lee con respaldo (`?? []`) a propósito: este componente reventó la
// pantalla entera con un `.join` sobre un campo que el contrato renombró, y una
// pantalla en blanco es mucho peor que un guion.
import { useQuery } from '@tanstack/react-query'
import { CloudOff, KeyRound } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import { obtenerInicioDocente } from '../../api/resources/inicio'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'
import { formatearFechaHora } from '../../lib/format'

/** Lista de textos únicos, en orden, lista para pintar. */
const unirUnicos = (valores) => [...new Set(valores.filter(Boolean))].join(', ') || '—'

/** El backend manda `{id, nombre}` donde la pantalla quiere un texto. */
const etiquetaDeCampo = (valor) => (valor != null && typeof valor === 'object' ? (valor.nombre ?? '—') : (valor ?? '—'))

/** Los módulos, con el nombre que ve la gente. */
const ETIQUETA_MODULO = {
  asistencias: 'Asistencias',
  lectura: 'Seguimiento de Lectura',
  rubrica: 'Rúbrica',
  registro_vuelo: 'Registro de Vuelo',
}

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{etiqueta}</dt>
      <dd className="mt-1 text-ink-900">{children}</dd>
    </div>
  )
}

export default function ResumenesAccion() {
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const pendientes = useSyncStore((s) => s.pendientes)

  const { data } = useQuery({
    queryKey: ['inicio', 'docente', idDocente],
    queryFn: obtenerInicioDocente,
    enabled: Boolean(idDocente),
  })

  if (!data) return null

  const asignaciones = data.asignaciones ?? []
  const permisos = data.permisos_vigentes ?? []
  const totales = data.totales ?? {}
  const grados = asignaciones.flatMap((a) => (a.grados ?? []).map((g) => g.nombre ?? g))
  // CU010 pide también los ciclos. Si `totales` no los trae, salen de cada grado.
  const ciclos = totales.ciclos ?? asignaciones.flatMap((a) => (a.grados ?? []).flatMap((g) => g.ciclos ?? []))

  const frases = []

  /**
   * LISTA CERRADA (CU010).
   *
   * El caso de uso enumera los Resúmenes de Acción y hoy solo contempla UNO:
   * los registros offline pendientes. Los de avance académico "se incorporarán
   * en futuras entregas conforme se aprueben sus reglas de cálculo", así que
   * pintar un "Has evaluado X de Y" aquí sería adelantarse a una fórmula que
   * todavía no está decidida.
   *
   * Sale de la cola local, no del servidor: por eso funciona sin conexión, que
   * es justo cuando importa. Es la única señal de que el trabajo del aula no se
   * ha perdido.
   */
  if (pendientes > 0) {
    frases.push({
      id: 'pendientes',
      icono: CloudOff,
      tono: 'text-warning-600',
      texto: `Tienes ${pendientes} registro${pendientes === 1 ? '' : 's'} offline pendiente${pendientes === 1 ? '' : 's'} de sincronizar.`,
    })
  }

  return (
    <Card title="Mis asignaciones">
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
        <Dato etiqueta="Colegios">{unirUnicos(asignaciones.map((a) => a.colegio?.nombre ?? a.colegio))}</Dato>
        <Dato etiqueta="Grados">{unirUnicos(grados)}</Dato>
        <Dato etiqueta="Ciclos">{unirUnicos(ciclos)}</Dato>
        <Dato etiqueta="Subprograma">{unirUnicos(totales.subprogramas ?? [])}</Dato>
        <Dato etiqueta="Alumnos">{totales.cantidad_alumnos ?? 0}</Dato>
      </dl>

      {/* CU010 — PERMISOS DE CORRECCIÓN VIGENTES.
          Van debajo del resumen y como bloque aparte a propósito: los grupos
          a los que el Docente solo llega por un permiso NO suman a sus
          asignaciones ni al conteo de alumnos. Mezclarlos cuadraría mal los
          números y, peor, haría creer que ese grupo es suyo. */}
      {permisos.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink-900">Permisos de corrección vigentes</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {permisos.map((p) => (
              <li key={p.id_permiso} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-700">
                <KeyRound className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
                <span className="font-medium text-ink-900">{etiquetaDeCampo(p.colegio)}</span>
                <span>· {etiquetaDeCampo(p.grado)}</span>
                <span>· {etiquetaDeCampo(p.anio_escolar)}</span>
                <span>· {p.periodo}</span>
                <Badge tone="warning">{ETIQUETA_MODULO[p.modulo] ?? p.modulo}</Badge>
                {/* La hora oficial del Perú, que es la que fija CU010. */}
                <span className="text-xs text-ink-500">Hasta el {formatearFechaHora(p.fin)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {asignaciones.length === 0 && (
        <p className="mt-4 text-sm text-ink-500">
          No tiene asignaciones académicas vigentes en este periodo.
        </p>
      )}

      {frases.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          {frases.map((frase) => {
            const Icono = frase.icono
            return (
              <li key={frase.id} className="flex items-center gap-2 text-sm text-ink-700">
                <Icono className={`h-4 w-4 shrink-0 ${frase.tono}`} aria-hidden="true" />
                {frase.texto}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
