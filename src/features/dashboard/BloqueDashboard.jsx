// El marco de cada bloque del dashboard: carga, error, vacío y contexto.
//
// Existe porque los tres CU repiten la misma regla para los nueve bloques: "Si
// el problema afecta únicamente a un bloque, el aviso aparece dentro de ese
// bloque. Los demás conservan los resultados cargados correctamente." Un
// dashboard que se cae entero porque un indicador falló es justo lo contrario.
//
// Lo que este componente garantiza, bloque a bloque:
//
//   · UN ERROR NO SE PINTA COMO AUSENCIA DE DATOS NI COMO CEROS. Lleva su
//     literal y su "Reintentar", y si había resultados anteriores se quedan
//     visibles marcados como "Información no actualizada" —no como resultados
//     de la selección nueva—.
//   · EL 422 `calendario_no_configurado` DICE QUÉ COLEGIOS FALTAN. El CU
//     prohíbe excluirlos en silencio o usar el calendario de otro.
//   · "CAMBIOS SIN APLICAR" se repite en cada bloque, porque el contexto que
//     se lee es el de la cabecera del bloque, no el de la barra de filtros que
//     puede quedar fuera de la pantalla.
import { AlertTriangle, CalendarX, RefreshCw } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import { colegiosSinCalendario } from '../../api/resources/dashboard'
import {
  CAMBIOS_SIN_APLICAR,
  ERROR_CONSULTA,
  INFORMACION_NO_ACTUALIZADA,
  SIN_CALENDARIO,
  SIN_DATOS_SELECCION,
} from './estados'

export default function BloqueDashboard({
  titulo,
  /** Año, periodo, colegios y fecha de la consulta MOSTRADA. */
  contexto = [],
  consulta,
  /** `true` cuando la respuesta llegó bien pero no trae nada que pintar. */
  vacio = false,
  mensajeVacio = SIN_DATOS_SELECCION,
  hayCambios = false,
  acciones,
  children,
}) {
  const sinCalendario = colegiosSinCalendario(consulta?.error)
  // Con datos anteriores en memoria y un error nuevo, lo que se ve es viejo.
  const desactualizado = consulta?.isError && Boolean(consulta?.data)

  return (
    <Card
      title={titulo}
      subtitle={contexto.filter(Boolean).join(' · ') || undefined}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {hayCambios && <Badge tone="warning">{CAMBIOS_SIN_APLICAR}</Badge>}
          {desactualizado && <Badge tone="warning">{INFORMACION_NO_ACTUALIZADA}</Badge>}
          {acciones}
        </div>
      }
    >
      {consulta?.isLoading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {!consulta?.isLoading && consulta?.isError && (
        <>
          {sinCalendario.length > 0 ? (
            <EmptyState
              icon={CalendarX}
              title={SIN_CALENDARIO}
              description={`Sin calendario: ${sinCalendario.map((c) => c.nombre).join(', ')}.`}
            />
          ) : (
            <EmptyState
              icon={AlertTriangle}
              title={ERROR_CONSULTA}
              action={
                <Button variant="outline" iconLeft={RefreshCw} onClick={() => consulta.refetch()}>
                  Reintentar
                </Button>
              }
            />
          )}
          {/* Lo anterior se conserva debajo del aviso, nunca en su lugar. */}
          {desactualizado && <div className="mt-4 opacity-60">{children}</div>}
        </>
      )}

      {!consulta?.isLoading && !consulta?.isError && (vacio ? <EmptyState title={mensajeVacio} /> : children)}
    </Card>
  )
}
