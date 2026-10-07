// Pantalla "Requiere conexión" de la estrategia offline.
//
// Solo para las secciones que el documento marca como SOLO ONLINE: Usuarios,
// Colegios, Dashboard y las sesiones del Supervisor. No se muestran datos de
// caché porque serían de un momento indeterminado, y estas pantallas deciden
// permisos y altas: un dato viejo aquí lleva a crear algo contra un id que ya
// no existe.
//
// Las tres grillas del aula NO pasan por aquí: esas sí se editan sin red.
import { WifiOff } from 'lucide-react'
import EmptyState from '../ui/EmptyState'

export default function RequiereConexion({ seccion }) {
  return (
    <EmptyState
      icon={WifiOff}
      title="Requiere conexión"
      description={`${seccion} necesita internet para mostrarse. Los cambios del aula (Rúbrica, Seguimiento de Lectura y Registro de Vuelo) sí funcionan sin conexión y se enviarán al reconectar.`}
    />
  )
}
