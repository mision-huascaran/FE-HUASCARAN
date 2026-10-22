// Los descriptores pedagógicos de la rúbrica (CU029).
//
// NO SE ESCRIBEN EN EL CÓDIGO, y esto es RN-011: son material pedagógico de
// Misión Huascarán, los mantienen ellos y cambian sin que nadie toque el
// front. Copiarlos aquí los habría congelado en la versión del día que se
// escribió la pantalla, y nadie se habría enterado de que estaban viejos.
//
// Un subprograma que no se dicta en ese ciclo —Alfabetización en IV o V—
// responde lista vacía: eso no es un fallo, es que esa combinación no existe.
import { useQuery } from '@tanstack/react-query'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import { obtenerCriterios } from '../../api/resources/rubricaMensual'

export default function PanelCriterios({ open, idPrograma, idCiclo, ciclo, nombrePrograma, onCerrar }) {
  const { data: criterios = [], isLoading } = useQuery({
    queryKey: ['rubrica', 'criterios', { idPrograma, idCiclo }],
    queryFn: () => obtenerCriterios({ idPrograma, idCiclo }),
    enabled: open && Boolean(idPrograma && idCiclo),
    staleTime: Infinity,
  })

  // Vienen en orden —Fluidez y luego Comprensión, de menor a mayor— y se
  // respeta: es el orden en que se lee una rúbrica.
  const dimensiones = criterios.reduce((grupos, c) => {
    const previos = grupos[c.dimension] ?? []
    return { ...grupos, [c.dimension]: [...previos, c] }
  }, {})

  return (
    <Modal
      open={open}
      onClose={onCerrar}
      title="Criterios de la rúbrica"
      subtitle={[nombrePrograma, ciclo ? `Ciclo ${ciclo}` : null].filter(Boolean).join(' · ')}
      footer={
        <Button variant="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
      }
    >
      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && criterios.length === 0 && (
        <EmptyState
          title="Sin criterios para esta combinación"
          description="Este subprograma no se dicta en el ciclo del grado seleccionado."
        />
      )}

      {!isLoading &&
        Object.entries(dimensiones).map(([dimension, niveles]) => (
          <section key={dimension} className="mb-5 last:mb-0">
            <h4 className="mb-2 text-sm font-semibold text-ink-900">{dimension}</h4>
            <dl className="flex flex-col gap-2">
              {niveles.map((n) => (
                <div key={`${dimension}-${n.valor}`} className="rounded-lg border border-line px-3 py-2">
                  <dt className="text-sm font-medium text-ink-900">
                    {n.valor} · {n.nombre}
                  </dt>
                  <dd className="mt-0.5 text-sm text-ink-500">{n.descriptor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
    </Modal>
  )
}
