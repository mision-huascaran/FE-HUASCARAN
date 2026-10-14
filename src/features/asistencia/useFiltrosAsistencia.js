// Filtros de Asistencia, conservados en localStorage (CU022, paso 4).
//
// localStorage guarda filtros y preferencias de navegación, nunca registros de
// negocio. Al volver al módulo, el docente recupera el contexto donde lo dejó.
//
// LA SECCIÓN VUELVE. Se había quitado cuando el backend dejó de tratarla como
// entidad propia, pero CU022 la pide de nuevo como filtro obligatorio: no es
// una tabla, es el aula a la que pertenece el alumno dentro de su colegio y
// grado. Se rellena sola cuando solo hay una, que es el caso corriente.
//
// La FECHA arranca en hoy según el reloj del SERVIDOR, no el del dispositivo
// (ver `lib/relojServidor.js`): CU022 prohíbe fiarse de la hora local.
import { useCallback, useState } from 'react'
import { hoy } from '../../lib/relojServidor'

const CLAVE = 'sicedu.filtros.asistencia'

const CAMPO = {
  docente: 'idDocente',
  colegio: 'idColegio',
  grado: 'idGrado',
  seccion: 'seccion',
  subprograma: 'idPrograma',
  fecha: 'fecha',
}

const VACIOS = { idDocente: '', idColegio: '', idGrado: '', seccion: '', idPrograma: '', fecha: '' }

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

export default function useFiltrosAsistencia() {
  /**
   * Lo guardado se FUSIONA con la forma por defecto en vez de sustituirla: un
   * `localStorage` escrito por una versión anterior no traía `idPrograma`, y
   * dejaba el campo en `undefined` en vez de en cadena vacía.
   */
  const [filtros, setFiltros] = useState(() => {
    const guardados = leer() ?? {}
    // Una fecha futura guardada —reloj del equipo cambiado, o el día siguiente
    // tras dejar la pestaña abierta— no puede resucitar: CU022 no permite
    // registrar en el futuro.
    const fecha = guardados.fecha && guardados.fecha <= hoy() ? guardados.fecha : hoy()
    return { ...VACIOS, ...guardados, fecha }
  })

  // Estable: los efectos que eligen el primer colegio y grado lo llevan como
  // dependencia, y si cambiara en cada render se evaluarían sin parar.
  const cambiar = useCallback((campo, valor) => {
    setFiltros((previos) => {
      const siguiente = { ...previos, [CAMPO[campo]]: valor }
      // Cambiar de colegio o de grado invalida la sección: las aulas son de ese
      // colegio y ese grado, y "B" no significa lo mismo en otro sitio.
      if (campo === 'colegio' || campo === 'grado') siguiente.seccion = ''
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
