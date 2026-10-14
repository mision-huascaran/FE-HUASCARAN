// Virtual Scrolling para la lista de asistencia (CU022).
//
// Un colegio grande pasa de los 60 alumnos y la pantalla está pensada para un
// móvil en el aula: pintar todas las filas con su Segmented Control hace que
// cada toque se note lento. Aquí solo se montan las que caben en la ventana,
// más un margen arriba y abajo para que al arrastrar no aparezcan huecos.
//
// Está escrito a mano, sin librería, por una razón práctica: el proyecto no
// tiene ninguna de virtualización y meter una dependencia nueva por sesenta
// líneas no compensa. Las filas son de alto fijo, que es el caso fácil.
import { useCallback, useEffect, useRef, useState } from 'react'

/** Filas de más que se montan fuera de la vista, arriba y abajo. */
const MARGEN = 6

/**
 * @param total  cuántas filas hay en la lista completa.
 * @param altoFila alto en píxeles de cada fila.
 * @param altoVista alto del área visible; solo se usa antes de medir el nodo.
 */
export default function useVentanaVirtual({ total, altoFila = 56, altoVista = 480 }) {
  const contenedor = useRef(null)
  const [desplazamiento, setDesplazamiento] = useState(0)
  const [alto, setAlto] = useState(altoVista)

  const alDesplazar = useCallback((evento) => setDesplazamiento(evento.currentTarget.scrollTop), [])

  // El alto real solo se conoce una vez montado. En jsdom vale 0, así que se
  // conserva el de respaldo o las pruebas no verían ninguna fila.
  useEffect(() => {
    const medido = contenedor.current?.clientHeight
    if (medido) setAlto(medido)
  }, [])

  const visibles = Math.ceil(alto / altoFila)
  const desde = Math.max(0, Math.floor(desplazamiento / altoFila) - MARGEN)
  const hasta = Math.min(total, desde + visibles + MARGEN * 2)

  return {
    contenedor,
    alDesplazar,
    desde,
    hasta,
    // Espaciadores: mantienen la barra de desplazamiento del tamaño que
    // tendría la lista entera, para que arrastrarla signifique lo mismo.
    huecoArriba: desde * altoFila,
    huecoAbajo: Math.max(0, (total - hasta) * altoFila),
  }
}
