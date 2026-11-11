// CU011 — Alertas Operativas del Supervisor.
//
// El contrato las entrega como `{tipo, mensaje, critica}` y el mensaje viene
// YA REDACTADO ("Sincronización Olvidada - Luis Mendoza: Registros vencidos,
// último inicio de sesión hace más de 3 días."). Se pinta tal cual: anteponerle
// un "Atención:" nuestro duplicaba el encabezado que ya trae.
//
// UN BLOQUE QUE SE DESPLIEGA. La cabecera se ve siempre, con la cuenta de
// críticas y avisos, y la lista es lo único que se abre. Arranca cerrado y
// recuerda si el usuario lo dejó abierto (`alertasAbiertas.js`).
//
// Las críticas van primero y en rojo, pero nunca solo con color: CU011 exige
// que el color vaya acompañado de icono y etiqueta, porque quien no lo
// distingue se quedaría sin la alerta. Los avisos van en ámbar.
import { useId, useState } from 'react'
import { AlertTriangle, ChevronDown, Info } from 'lucide-react'
import { guardarAlertasAbiertas, leerAlertasAbiertas } from './alertasAbiertas'

const CRITICA = {
  marca: 'border-l-danger-600',
  icono: AlertTriangle,
  colorIcono: 'text-danger-600',
  etiqueta: 'Crítica',
}

const NORMAL = {
  marca: 'border-l-warning-600',
  icono: Info,
  colorIcono: 'text-warning-600',
  etiqueta: 'Aviso',
}

const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`

/** "3 críticas · 2 avisos", sin la parte que esté en cero. */
function Resumen({ criticas, avisos }) {
  if (!criticas && !avisos) return <span className="text-ink-500">Sin alertas</span>
  return (
    <span className="text-ink-700">
      {criticas > 0 && <span className="whitespace-nowrap font-semibold text-danger-600">{plural(criticas, 'crítica', 'críticas')}</span>}
      {criticas > 0 && avisos > 0 && <span aria-hidden="true"> · </span>}
      {avisos > 0 && <span className="whitespace-nowrap">{plural(avisos, 'aviso', 'avisos')}</span>}
    </span>
  )
}

export default function AlertasInactividad({ alertas = [], desactualizadas = false }) {
  const idLista = useId()
  const [abiertas, setAbiertas] = useState(leerAlertasAbiertas)

  const criticas = alertas.filter((a) => a.critica)
  const avisos = alertas.filter((a) => !a.critica)
  const hayAlertas = alertas.length > 0

  const alternar = () => {
    setAbiertas((antes) => {
      guardarAlertasAbiertas(!antes)
      return !antes
    })
  }

  return (
    <section aria-labelledby={`${idLista}-titulo`} className="sicedu-tarjeta rounded-xl border border-line/80 bg-surface-0 shadow-card">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <AlertTriangle className="h-5 w-5 shrink-0 text-ink-500" aria-hidden="true" strokeWidth={1.9} />
        {/* En el teléfono el resumen va debajo del título; en pantallas
            anchas, a su lado. */}
        <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <h2 id={`${idLista}-titulo`} className="text-[15px] font-semibold leading-snug text-ink-900">
            Alertas
          </h2>
          <p className="text-sm">
            <Resumen criticas={criticas.length} avisos={avisos.length} />
          </p>
        </div>
        {hayAlertas && (
          <button
            type="button"
            aria-expanded={abiertas}
            aria-controls={idLista}
            onClick={alternar}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-700 hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {abiertas ? 'Ocultar alertas' : 'Ver alertas'}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-150 ${abiertas ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </header>

      {hayAlertas && (
        // `hidden` y la clase: `flex` le gana al atributo en la hoja de estilos.
        <ul
          id={idLista}
          hidden={!abiertas}
          className={`${abiertas ? 'flex' : 'hidden'} flex-col gap-2 border-t border-line/70 px-4 py-3 sm:px-5`}
          aria-label="Alertas operativas"
        >
          {[...criticas, ...avisos].map((alerta, i) => {
            const tono = alerta.critica ? CRITICA : NORMAL
            const Icono = tono.icono
            return (
              <li
                key={`${alerta.tipo}-${i}`}
                className={`flex items-start gap-2 rounded-r-lg border-l-4 py-1.5 pl-3 pr-1 text-sm text-ink-700 ${tono.marca}`}
              >
                <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${tono.colorIcono}`} aria-hidden="true" />
                <span>
                  <strong className="font-semibold text-ink-900">{`${tono.etiqueta}: `}</strong>
                  {alerta.mensaje}
                  {desactualizadas && <span className="ml-1 text-xs text-ink-500">(puede estar desactualizada)</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
