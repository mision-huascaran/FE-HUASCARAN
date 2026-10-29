// Vista de detalle de un colegio (CU013).
//
// Es una VISTA INTERNA de la SPA, no una ruta aparte: conserva el sidebar y
// reemplaza el listado en el área principal. Por eso "Volver a Colegios" no
// navega, sino que devuelve el control al listado, que conserva sus filtros y
// su página porque nunca llegó a desmontarse.
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import ProgramacionDeClases from './ProgramacionDeClases'
import { obtenerColegio } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'

export default function DetalleColegio({ colegio, onVolver }) {
  /**
   * La ficha completa, que es la única que trae grados, secciones y
   * subprogramas CON SU ID. La fila del listado solo trae lo que se pinta en
   * la tabla, y los filtros de la programación necesitan los ids.
   */
  const consulta = useQuery({
    queryKey: ['colegio', colegio?.id_colegio],
    queryFn: () => obtenerColegio(colegio.id_colegio),
    enabled: Boolean(colegio?.id_colegio),
  })

  const ficha = consulta.data ?? colegio

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-ink-900 md:text-3xl">{ficha?.nombre}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {[ficha?.departamento, ficha?.provincia, ficha?.distrito].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button variant="outline" iconLeft={ArrowLeft} onClick={onVolver}>
          Volver a Colegios
        </Button>
      </header>

      {/* Una sola pestaña hoy. Se deja el título porque CU013 la nombra y
          porque el detalle crecerá: el Supervisor tiene que saber qué mira. */}
      <h2 className="text-base font-semibold text-ink-900">Programación de clases</h2>

      {consulta.isLoading && <Skeleton className="h-40 w-full" />}

      {consulta.isError && (
        <Card>
          <EmptyState title="No se pudo cargar el colegio" description={mensajeDeError(consulta.error)} />
        </Card>
      )}

      {!consulta.isLoading && !consulta.isError && <ProgramacionDeClases colegio={ficha} />}
    </div>
  )
}
