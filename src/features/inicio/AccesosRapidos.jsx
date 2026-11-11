import { ArrowRight, BookOpenCheck, ClipboardCheck, Plane } from 'lucide-react'
import { Link } from 'react-router-dom'
import IconoTinte from '../../components/ui/IconoTinte'

/** Los tres módulos de registro del docente (CU023, CU029, CU031). */
const ACCESOS = [
  {
    to: '/seguimiento-lectura',
    icon: BookOpenCheck,
    titulo: 'Seguimiento de Lectura',
    descripcion: 'La tabla semanal de tu grupo: LSN, LSL y observaciones.',
  },
  {
    to: '/rubrica',
    icon: ClipboardCheck,
    titulo: 'Rúbrica',
    descripcion: 'Fluidez y comprensión de cada alumno, una vez al mes.',
  },
  {
    to: '/registro-vuelo',
    icon: Plane,
    titulo: 'Registro de Vuelo',
    descripcion: 'El nivel colocado de cada alumno en cada periodo académico.',
  },
]

export default function AccesosRapidos() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {ACCESOS.map(({ to, icon, titulo, descripcion }) => (
        <Link
          key={to}
          to={to}
          className="sicedu-tarjeta sicedu-elevable group flex items-center gap-3.5 rounded-xl border border-line/80 bg-surface-0 p-4 shadow-card hover:border-brand-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 sm:items-start sm:p-5"
        >
          <IconoTinte icon={icon} tono="neutro" tamano="md" />
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-900">
              {titulo}
              <ArrowRight
                className="h-4 w-4 shrink-0 text-brand-700 transition-transform duration-150 group-hover:translate-x-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                aria-hidden="true"
              />
            </h3>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-500 sm:text-sm">{descripcion}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
