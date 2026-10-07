// CU010 — Resúmenes de Acción del Módulo de Inicio del Docente.
//
// Frases cortas sobre el avance real: cuántos alumnos lleva evaluados y cuántos
// cambios quedan sin sincronizar. Lo segundo importa especialmente sin red,
// porque es la única señal de que el trabajo del aula no se ha perdido.
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CloudOff } from 'lucide-react'
import Card from '../../components/ui/Card'
import { obtenerResumenDocente } from '../../api/resources/inicio'
import useSessionStore from '../../store/sessionStore'
import useSyncStore from '../../store/syncStore'

export default function ResumenesAccion() {
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const pendientes = useSyncStore((s) => s.pendientes)

  const { data } = useQuery({
    queryKey: ['inicio', 'docente', idDocente],
    queryFn: () => obtenerResumenDocente(idDocente),
    enabled: Boolean(idDocente),
  })

  if (!data) return null

  const frases = [
    {
      id: 'evaluados',
      icono: CheckCircle2,
      tono: 'text-success-600',
      texto: `Has evaluado a ${data.evaluados} de ${data.alumnos} alumnos.`,
    },
  ]

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
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Colegios</dt>
          <dd className="mt-1 text-ink-900">{data.colegios.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Grados</dt>
          <dd className="mt-1 text-ink-900">{data.grados.join(', ') || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Subprograma</dt>
          <dd className="mt-1 text-ink-900">{data.subprograma}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">Alumnos</dt>
          <dd className="mt-1 text-ink-900">{data.alumnos}</dd>
        </div>
      </dl>

      <ul className="mt-5 flex flex-col gap-2 border-t border-line pt-4">
        {frases.map((frase) => (
          <li key={frase.id} className="flex items-center gap-2 text-sm text-ink-700">
            <frase.icono className={`h-4 w-4 shrink-0 ${frase.tono}`} aria-hidden="true" />
            {frase.texto}
          </li>
        ))}
      </ul>
    </Card>
  )
}
