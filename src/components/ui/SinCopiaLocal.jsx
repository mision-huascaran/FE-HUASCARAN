// Sin conexión y sin copia de ESTO en el equipo (RNF-001).
//
// Una consulta sin red y sin nada guardado queda en pausa, sin datos ni error.
// Las pantallas lo tomaban por una respuesta vacía: Asistencias decía "No hay
// alumnos matriculados" de una clase que sí los tiene, y Lectura, Rúbrica y
// Vuelo no mostraban nada. No es una clase vacía: es que no está en el equipo.
import { WifiOff } from 'lucide-react'
import Card from './Card'
import EmptyState from './EmptyState'

/** @param que 'clase' | 'tabla' — lo que no está guardado. */
export default function SinCopiaLocal({ que = 'clase' }) {
  return (
    <Card>
      <EmptyState
        icon={WifiOff}
        title={`Esta ${que} no está guardada en este equipo`}
        description="Conéctate a internet para cargarla."
      />
    </Card>
  )
}

/** ¿La consulta espera la red sin tener nada que mostrar? */
export const sinCopiaLocal = (consulta) => Boolean(consulta?.isPaused) && consulta?.data === undefined
