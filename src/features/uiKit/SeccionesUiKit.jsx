import { Card, Logo } from '../../components/ui'
import imgHeaderHome from '../../assets/img_header_home.jpg'

/**
 * Comprobación de los dos assets oficiales (§4.4): el logo debe verse blanco
 * sobre navy y azul sobre fondo claro con el mismo componente, y la fotografía
 * solo se usa con su velo, exclusivamente en el panel izquierdo del login.
 */
export function MarcaCard() {
  return (
    <Card title="Marca y assets" subtitle="logo_MH.png · img_header_home.jpg">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-6 rounded-xl bg-navy-900 p-5">
            <Logo tone="light" size="lg" />
            <Logo tone="light" size="md" showLabel={false} />
          </div>
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-surface-0 p-5">
            <Logo tone="dark" size="lg" />
            <Logo tone="dark" size="md" showLabel={false} />
          </div>
          <p className="text-xs text-ink-500">
            <span>
              El PNG entregado es blanco con canal alfa. Se usa como máscara CSS y el relleno lo pone
            </span>
            <code className="mx-1 rounded bg-surface-100 px-1">currentColor</code>, de modo que un
            mismo componente sirve en los dos fondos.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative h-56 overflow-hidden rounded-xl">
            <img
              src={imgHeaderHome}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-[52%_30%]"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-navy-900/85 via-navy-900/10 to-navy-900/50"
            />
            <div className="absolute inset-0 flex flex-col justify-between p-5">
              <Logo tone="light" />
              <div>
                <p className="font-display text-xl font-bold leading-snug text-white">
                  El avance lector de cada estudiante, en un solo lugar
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['413 estudiantes', '9 colegios', 'Callejón de Huaylas'].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-ink-500">
            Tratamiento exacto del panel izquierdo del login (P1). Esta fotografía no se usa como
            fondo en ninguna otra pantalla.
          </p>
        </div>
      </div>
    </Card>
  )
}

// El color se pinta con su valor literal y no con una clase `bg-${token}`:
// Tailwind solo genera las clases que encuentra escritas completas en el código.
const GRUPOS_PALETA = [
  { nombre: 'navy', tonos: [['navy-900', '#0A2249'], ['navy-800', '#0E2E5E'], ['navy-700', '#123A75']] },
  {
    nombre: 'brand',
    tonos: [['brand-700', '#10428F'], ['brand-600', '#1D4ED8'], ['brand-500', '#2563EB'], ['brand-100', '#E6EEFB'], ['brand-50', '#F2F6FD']],
  },
  { nombre: 'ink', tonos: [['ink-900', '#0F1E3D'], ['ink-700', '#33415A'], ['ink-500', '#5B6577'], ['ink-400', '#8A94A6']] },
  {
    nombre: 'surface / line',
    tonos: [['surface-0', '#FFFFFF'], ['surface-50', '#F5F8FD'], ['surface-100', '#EEF2F9'], ['line', '#E2E8F2'], ['line-strong', '#CFD8E6']],
  },
  {
    nombre: 'estado',
    tonos: [['success-600', '#17795A'], ['warning-600', '#946200'], ['danger-600', '#B3261E'], ['info-600', '#1D4ED8']],
  },
  {
    nombre: 'lvl',
    tonos: [['lvl-preinicio', '#6D28D9'], ['lvl-inicio', '#B3261E'], ['lvl-proceso', '#946200'], ['lvl-logrado', '#17795A'], ['lvl-destacado', '#10428F']],
  },
]

export function PaletaTab() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
      {GRUPOS_PALETA.map((g) => (
        <Card key={g.nombre} title={g.nombre}>
          <div className="flex flex-wrap gap-3">
            {g.tonos.map(([token, hex]) => (
              <div key={token} className="w-28">
                <div className="h-12 rounded-lg border border-line" style={{ backgroundColor: hex }} />
                <p className="mt-1 text-xs font-medium text-ink-700">{token}</p>
                <p className="text-xs tabular-nums text-ink-400">{hex}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

export function TipografiaTab() {
  return (
    <Card className="mt-6" title="Escala tipográfica" subtitle="Poppins para títulos · Inter para interfaz">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">H1 · text-2xl md:text-3xl font-bold</p>
          <h1 className="text-2xl font-bold md:text-3xl">Registro de vuelo</h1>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">H2 · text-xl font-semibold</p>
          <h2 className="text-xl font-semibold">Histórico de evaluaciones</h2>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">H3 · text-base font-semibold</p>
          <h3 className="text-base font-semibold">Sugerencia calculada</h3>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Cuerpo · text-sm</p>
          <p className="text-sm">
            El sistema sugirió F al considerar 4/5, Fluidez en proceso y Comprensión lograda.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Números · tabular-nums</p>
          <p className="text-sm tabular-nums">413 estudiantes · 9 colegios · 18 semanas</p>
        </div>
      </div>
    </Card>
  )
}

