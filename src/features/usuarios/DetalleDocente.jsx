// CU016 / CU028 — Detalle del Docente, dentro de la misma SPA.
//
// No es un modal ni una ruta aparte: reemplaza el listado en el área principal
// y conserva el sidebar, como pide CU016. "Volver a Usuarios" devuelve al
// listado con sus filtros y su página, que es la razón de que esto sea estado
// de la pantalla y no una navegación.
//
// Solo existe para los Docentes: Supervisores y Directivos no tienen permisos
// de corrección ni nada más que enseñar aquí.
import { ArrowLeft } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Tabs from '../../components/ui/Tabs'
import PermisosDeCorreccion from './PermisosDeCorreccion'

/** Iniciales para el avatar, que se genera en el cliente. */
const iniciales = (nombre) =>
  String(nombre ?? '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export default function DetalleDocente({ docente, colegios, onVolver }) {
  const nombre = docente?.nombre ?? docente?.nombre_completo ?? '—'
  const activo = docente?.activo !== false

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" iconLeft={ArrowLeft} onClick={onVolver} className="self-start">
        Volver a Usuarios
      </Button>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-base font-bold text-white"
            >
              {iniciales(nombre)}
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink-900 md:text-2xl">{nombre}</h1>
              {docente?.correo && <p className="text-sm text-ink-500">{docente.correo}</p>}
            </div>
          </div>
          <Badge tone={activo ? 'success' : 'neutral'}>{activo ? 'Activo' : 'Inactivo'}</Badge>
        </div>
      </Card>

      {/* Una sola pestaña por ahora. Se deja el componente porque CU016 la
          nombra como tal y porque el detalle del Docente va a crecer. */}
      <Tabs value="permisos" onChange={() => {}} items={[{ value: 'permisos', label: 'Permisos de corrección' }]} />

      <PermisosDeCorreccion docente={docente} colegios={colegios} />
    </div>
  )
}
