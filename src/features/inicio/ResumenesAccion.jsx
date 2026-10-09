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
import { CheckCircle2, CloudOff } from 'lucide-react'
import Card from '../../components/ui/Card'
import { obtenerInicioDocente } from '../../api/resources/inicio'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'

/** Lista de textos únicos, en orden, lista para pintar. */
const unirUnicos = (valores) => [...new Set(valores.filter(Boolean))].join(', ') || '—'

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
  const totales = data.totales ?? {}
  const grados = asignaciones.flatMap((a) => (a.grados ?? []).map((g) => g.nombre ?? g))
  // CU010 pide también los ciclos. Si `totales` no los trae, salen de cada grado.
  const ciclos = totales.ciclos ?? asignaciones.flatMap((a) => (a.grados ?? []).flatMap((g) => g.ciclos ?? []))

  const frases = []

  // Solo si el backend los manda. Hoy no llegan (§12 del contrato).
  if (data.evaluados != null && data.alumnos != null) {
    frases.push({
      id: 'evaluados',
      icono: CheckCircle2,
      tono: 'text-success-600',
      texto: `Has evaluado a ${data.evaluados} de ${data.alumnos} alumnos.`,
    })
  }

  // Este sí sale de la cola local, así que funciona aunque no haya red. Es la
  // única señal de que el trabajo del aula no se ha perdido.
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
