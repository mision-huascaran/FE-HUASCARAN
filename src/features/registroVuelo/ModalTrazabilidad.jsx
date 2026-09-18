// Cubre: RF-024, RN-014, RN-015
import { ArrowRight, Bot, Check, TriangleAlert, User } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import LevelChip from '../../components/ui/LevelChip'
import Modal from '../../components/ui/Modal'
import cn from '../../lib/cn'
import { formatearFechaHora } from '../../lib/format'

/**
 * Detalle y trazabilidad de una evaluación (P8).
 *
 * Es la pantalla que demuestra la revisión humana: deja ver lado a lado lo que
 * propuso el sistema y lo que decidió el docente, y por qué. RN-014: los dos
 * valores conviven, ninguno sobreescribe al otro.
 */
const ESTILO_HITO = {
  sistema: { Icon: Bot, punto: 'bg-info-600', texto: 'text-info-600', fondo: 'bg-info-100' },
  docente: { Icon: User, punto: 'bg-warning-600', texto: 'text-warning-600', fondo: 'bg-warning-100' },
  confirmado: { Icon: Check, punto: 'bg-success-600', texto: 'text-success-600', fondo: 'bg-success-100' },
}

export default function ModalTrazabilidad({ open, onClose, fila }) {
  const evaluacion = fila?.evaluacion
  if (!evaluacion) return null

  const hayDiferencia = evaluacion.nivel_ajustado !== evaluacion.nivel_sugerido
  const hitos = evaluacion.trazabilidad ?? []
  const ultimo = hitos.at(-1)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="max-w-4xl"
      title={fila.nombre}
      subtitle={`${fila.codigo} · ${fila.grado_nombre} · ${fila.colegio}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Periodo {evaluacion.periodo ?? evaluacion.id_periodo}</Badge>
          {evaluacion.ajustado_por_docente && <Badge tone="warning">Modificado por docente</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TarjetaDato titulo="Nivel anterior" valor={<LevelChip letra={evaluacion.nivel_inicial_razkids} />} />
          <TarjetaDato titulo="Prueba aplicada" valor={<LevelChip letra={evaluacion.nivel_prueba} />} />
          <TarjetaDato
            titulo="Resultado"
            valor={
              <span className="font-display text-lg font-bold tabular-nums text-ink-900">
                {evaluacion.aciertos} / {evaluacion.total}
              </span>
            }
          />
          <TarjetaDato titulo="Fluidez" valor={<LevelChip nivel={evaluacion.fluidez} />} />
          <TarjetaDato titulo="Comprensión" valor={<LevelChip nivel={evaluacion.comprension} />} />
        </div>

        <section>
          <h3 className="text-base font-semibold text-ink-900">Decisión y trazabilidad</h3>
          <div className="mt-3 grid grid-cols-1 items-center gap-3 lg:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-xl border border-info-600/20 bg-info-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-info-600">Sugerencia del sistema</p>
              <div className="mt-2 flex items-center gap-2">
                <LevelChip letra={evaluacion.nivel_sugerido} />
                <span className="text-xs text-ink-700">Calculado automáticamente</span>
              </div>
            </div>

            <div className="flex items-center justify-center">
              {hayDiferencia ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-600/20 bg-danger-100 px-3 py-1 text-xs font-semibold text-danger-600">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Diferencia detectada
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              ) : (
                <ArrowRight className="h-5 w-5 text-ink-400" aria-hidden="true" />
              )}
            </div>

            <div
              className={cn(
                'rounded-xl border p-4',
                hayDiferencia ? 'border-warning-600/20 bg-warning-100' : 'border-success-600/20 bg-success-100',
              )}
            >
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  hayDiferencia ? 'text-warning-600' : 'text-success-600',
                )}
              >
                Decisión del docente
              </p>
              <div className="mt-2 flex items-center gap-2">
                <LevelChip letra={evaluacion.nivel_ajustado} />
                <span className="text-xs text-ink-700">
                  {hayDiferencia ? 'Cambio manual' : 'Confirmó la sugerencia'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* RN-015: cuando hay diferencia, la justificación escrita es obligatoria. */}
        {hayDiferencia && (
          <section className="rounded-xl border border-warning-500 bg-surface-0 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning-600">
              Justificación del docente
            </p>
            <p className="mt-2 text-sm text-ink-700">
              {evaluacion.justificacion ?? 'Sin justificación registrada.'}
            </p>
          </section>
        )}

        <section className="rounded-xl bg-info-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-info-600">
            Justificación del sistema
          </p>
          <p className="mt-2 text-sm text-ink-700">{fila.calculo?.motivo ?? '—'}</p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-ink-900">Línea de tiempo</h3>
          <ol className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
            {hitos.map((hito, i) => {
              const estilo = ESTILO_HITO[hito.tipo] ?? ESTILO_HITO.sistema
              return (
                <li key={`${hito.tipo}-${hito.fecha}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', estilo.fondo)}>
                    <estilo.Icon className={cn('h-4 w-4', estilo.texto)} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{hito.titulo}</p>
                    <p className="text-xs text-ink-500">{formatearFechaHora(hito.fecha)}</p>
                    <p className="truncate text-xs text-ink-500">{hito.autor}</p>
                  </div>
                  {i < hitos.length - 1 && (
                    <span className="mt-4 hidden h-px flex-1 bg-line lg:block" aria-hidden="true" />
                  )}
                </li>
              )
            })}
          </ol>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p className="text-xs text-ink-500">
              Última modificación: {ultimo?.autor ?? '—'} · {formatearFechaHora(ultimo?.fecha)}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
              {[
                ['sistema', 'Sistema'],
                ['docente', 'Docente'],
                ['confirmado', 'Confirmado'],
              ].map(([tipo, etiqueta]) => (
                <span key={tipo} className="inline-flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', ESTILO_HITO[tipo].punto)} aria-hidden="true" />
                  {etiqueta}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}

function TarjetaDato({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-line bg-surface-0 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{titulo}</p>
      <div className="mt-2">{valor}</div>
    </div>
  )
}
