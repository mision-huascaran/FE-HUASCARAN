// Filtros de Asistencia, conservados en localStorage (CU022, paso 4).
//
// localStorage guarda filtros y preferencias de navegación, nunca registros de
// negocio. Al volver al módulo, el docente recupera el contexto donde lo dejó.
//
// LA SECCIÓN SE VA, esta vez de verdad. CU022 la pide como filtro, pero el
// contrato no la tiene en ninguna parte: `GET /asistencias` recibe colegio,
// grado, subprograma y fecha, `AlumnoAsistencia` no trae aula y `/secciones` se
// retiró. Las opciones salían del simulador, así que contra el backend real el
// desplegable nacía vacío y, siendo obligatorio, la clase no se pedía jamás.
//
// La FECHA arranca en hoy según el reloj del SERVIDOR, no el del dispositivo
// (ver `lib/relojServidor.js`): CU022 prohíbe fiarse de la hora local.
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { hoy } from '../../lib/relojServidor'

const CLAVE = 'sicedu.filtros.asistencia'

const CAMPO = {
  docente: 'idDocente',
  colegio: 'idColegio',
  grado: 'idGrado',
  subprograma: 'idPrograma',
  fecha: 'fecha',
}

const VACIOS = { idDocente: '', idColegio: '', idGrado: '', idPrograma: '', fecha: '' }

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    return crudo ? JSON.parse(crudo) : null
  } catch {
    return null
  }
}

export default function useFiltrosAsistencia() {
  const [parametros] = useSearchParams()

  /**
   * Lo guardado se FUSIONA con la forma por defecto en vez de sustituirla: un
   * `localStorage` escrito por una versión anterior no traía `idPrograma`, y
   * dejaba el campo en `undefined` en vez de en cadena vacía.
   */
  const [filtros, setFiltros] = useState(() => {
    const guardados = leer() ?? {}
    /**
     * `?fecha=` manda sobre lo guardado: así llega el atajo "Ver Asistencias"
     * del Supervisor (CU021), que abre la jornada EXACTA de una actividad. Si
     * ganara el localStorage, el atajo llevaría al día que el Supervisor miró
     * la última vez, que es justo lo que no quiere ver.
     */
    const deLaUrl = parametros.get('fecha')
    const candidata = deLaUrl || guardados.fecha
    // Una fecha futura —reloj del equipo cambiado, o el día siguiente tras
    // dejar la pestaña abierta— no puede resucitar: CU022 no permite registrar
    // en el futuro.
    const fecha = candidata && candidata <= hoy() ? candidata : hoy()
    return { ...VACIOS, ...guardados, fecha }
  })

  // Estable: los efectos que eligen el primer colegio y grado lo llevan como
  // dependencia, y si cambiara en cada render se evaluarían sin parar.
  const cambiar = useCallback((campo, valor) => {
    setFiltros((previos) => {
      const siguiente = { ...previos, [CAMPO[campo]]: valor }
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
