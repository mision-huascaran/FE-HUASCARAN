// "Hay una versión nueva" (D43).
//
// No recarga solo. Un despliegue en mitad de una jornada no puede tirar lo que
// el docente esté escribiendo: se avisa, se queda ahí, y recarga cuando él lo
// decide. Lo que no se pierde en ningún caso es la cola de envíos, que vive en
// IndexedDB y sobrevive a la recarga.
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Button from '../ui/Button'
import { alHaberVersionNueva, aplicarVersionNueva } from '../../lib/actualizacion'

export default function AvisoVersionNueva() {
  const [hayVersion, setHayVersion] = useState(false)

  useEffect(() => alHaberVersionNueva(setHayVersion), [])

  if (!hayVersion) return null

  return (
    // <output> ya tiene el rol `status`: se anuncia sin interrumpir.
    <output
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-surface-0 px-4 py-3 text-sm shadow-card"
    >
      <span className="text-ink-700">Hay una versión nueva de SICEDU.</span>
      <Button size="sm" iconLeft={RefreshCw} onClick={aplicarVersionNueva}>
        Actualizar
      </Button>
    </output>
  )
}
