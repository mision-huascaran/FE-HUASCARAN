// Filtros de Asistencia, conservados en localStorage (CU022, paso 4).
//
// localStorage guarda filtros y preferencias de navegación, nunca registros de
// negocio. Al volver al módulo, el docente recupera el contexto donde lo dejó.
//
// LA SECCIÓN VUELVE, y ahora con datos detrás. Se quitó cuando el contrato no
// la tenía —el desplegable nacía vacío y, siendo obligatorio, la clase no se
// pedía jamás—. Con T3 es una entidad por grado y `GET /asistencias` la recibe
// como `id_seccion`: la clase es colegio × grado × sección.
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
  seccion: 'idSeccion',
  subprograma: 'idPrograma',
  fecha: 'fecha',
}

const VACIOS = { idDocente: '', idColegio: '', idGrado: '', idSeccion: '', idPrograma: '', fecha: '' }

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
    /**
     * EL AULA TAMBIÉN PUEDE LLEGAR POR LA URL, y por el mismo motivo.
     *
     * Lo necesita el detalle de asistencia del Dashboard (CU033, paso 8): al
     * pulsar una clase se abre CU022 "en modo consulta, con los filtros
     * correspondientes precargados". Si solo viajara la fecha, el Supervisor
     * aterrizaría en el día correcto pero en el aula que miró la última vez, y
     * leería como de esa clase unos datos que son de otra.
     */
    const aula = Object.entries(CAMPO).reduce((acumulado, [parametro, campo]) => {
      const valor = parametros.get(parametro)
      return valor ? { ...acumulado, [campo]: valor } : acumulado
    }, {})
    delete aula.fecha
    // Una fecha futura —reloj del equipo cambiado, o el día siguiente tras
    // dejar la pestaña abierta— no puede resucitar: CU022 no permite registrar
    // en el futuro.
    const fecha = candidata && candidata <= hoy() ? candidata : hoy()
    return { ...VACIOS, ...guardados, ...aula, fecha }
  })

  // Estable: los efectos que eligen el primer colegio y grado lo llevan como
  // dependencia, y si cambiara en cada render se evaluarían sin parar.
  const cambiar = useCallback((campo, valor) => {
    setFiltros((previos) => {
      const siguiente = { ...previos, [CAMPO[campo]]: valor }
      // Las aulas son de ese colegio y ese grado: la "A" de uno no es la "A"
      // del otro, así que cambiar cualquiera de los dos invalida la elegida.
      if (campo === 'colegio' || campo === 'grado') siguiente.idSeccion = ''
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
