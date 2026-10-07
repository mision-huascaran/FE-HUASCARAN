// Filtros de Asistencia, conservados en localStorage.
//
// El documento es explícito: localStorage guarda filtros y preferencias de
// navegación, nunca registros de negocio. Al volver al módulo, el docente
// recupera el contexto donde lo dejó.
import { useCallback, useState } from 'react'

const CLAVE = 'sicedu.filtros.asistencia'
const HOY = () => new Date().toISOString().slice(0, 10)

const CAMPO = {
  docente: 'idDocente',
  colegio: 'idColegio',
  ciclo: 'idCiclo',
  grado: 'idGrado',
  seccion: 'idSeccion',
  fecha: 'fecha',
}

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

const VACIOS = { idDocente: '', idColegio: '', idCiclo: '', idGrado: '', idSeccion: '', fecha: '' }

export default function useFiltrosAsistencia() {
  /**
   * Lo guardado se FUSIONA con la forma por defecto en vez de sustituirla: un
   * `localStorage` escrito por una versión anterior no traía `idDocente`, y
   * dejaba el campo en `undefined` en vez de en cadena vacía.
   */
  const [filtros, setFiltros] = useState(() => ({ ...VACIOS, fecha: HOY(), ...leer() }))

  // Estable: los efectos que eligen el primer colegio y grado lo llevan como
  // dependencia, y si cambiara en cada render se evaluarían sin parar.
  const cambiar = useCallback((campo, valor) => {
    setFiltros((previos) => {
      const siguiente = { ...previos, [CAMPO[campo]]: valor }
      // Cambiar de colegio invalida la sección: no son del mismo plantel.
      if (campo === 'colegio') siguiente.idSeccion = ''
      try {
        localStorage.setItem(CLAVE, JSON.stringify(siguiente))
      } catch {
        // Almacenamiento bloqueado: se sigue con los filtros en memoria.
      }
      return siguiente
    })
  }, [])

  return { filtros, cambiar }
}
