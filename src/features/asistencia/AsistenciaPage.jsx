// Cubre: CU022 · Registrar asistencias de alumnos.
//
// YA NO ES UNA DEMO: el backend publica `GET /asistencias` y `PUT /asistencias`.
//
// Una CLASE es colegio + grado + SECCIÓN + fecha. El subprograma NO entra: una
// clase reúne a los alumnos de Alfabetización y a los de Comprensión Lectora que
// estén en esa aula, y cada uno trae el suyo. El filtro de subprograma de esta
// pantalla es visual, y cambiarlo no puede perder marcas ya puestas.
//
// DE DÓNDE SALEN LOS DESPLEGABLES, que es lo que hacía fallar la pantalla:
//
//   · El Docente solo puede consultar las aulas que tiene asignadas: cualquier
//     otra responde 403 `aula_fuera_de_alcance`. Así que sus colegios salen de
//     `GET /me/asignaciones`, no del catálogo general. Antes salían del
//     simulador: nueve colegios ficticios con ids de otra base.
//   · El grado y el subprograma los dice el COLEGIO, no un catálogo global.
//     `GET /colegios/{id}` trae los suyos con id y nombre, y es la única fuente
//     que los da con id: `/me/asignaciones` los manda por texto.
//   · Y el subprograma se acota además al GRADO. Un docente con 3.º de
//     Alfabetización y 4.º de Comprensión Lectora podía elegir 3.º +
//     Comprensión Lectora, que no es ninguna de sus aulas, y el servidor le
//     respondía 403 con razón.
//
// Lo que la separa de las demás grillas:
//
//   · NO HAY BOTÓN DE GUARDAR. Cada clic manda su propio micro-paquete
//     (Auto-save) y, si falla, el control vuelve solo a donde estaba.
//   · Cuatro estados por alumno: presente, tardanza, ausente y SIN MARCAR. Una
//     clase nueva nace entera sin marcar, que no es lo mismo que todos ausentes.
//   · La lista va con Virtual Scrolling: está pensada para un móvil en el aula
//     y un colegio grande pasa de los sesenta alumnos.
//   · Quién puede escribir lo decide el SERVIDOR, no esta pantalla. Desde la
//     tanda 6 ya no es un `editable` suelto sino un bloque `escritura` que
//     además dice POR QUÉ no se puede —sin habilitación, sin actividad, o
//     porque es el Supervisor, que siempre consulta en solo lectura— y si lo
//     que habilita es un permiso excepcional.
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCheck, CalendarX2, Ban } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import AvisoActividades from '../../components/layout/AvisoActividades'
import AvisoConflictos from '../../components/layout/AvisoConflictos'
import FiltrosAsistencia from './FiltrosAsistencia'
import ListaAsistencia from './ListaAsistencia'
import ModalObservacion from './ModalObservacion'
import useFiltrosAsistencia from './useFiltrosAsistencia'
import useAutoguardado from './useAutoguardado'
import { useToast } from '../../components/ui/Toast'
import { MOTIVO_FECHA, esMotivoDeFecha, obtenerClase } from '../../api/resources/asistencia'
import { listarDocentes, listarMisAsignaciones, obtenerColegio } from '../../api/resources/administracion'
import { obtenerMisHabilitaciones } from '../../api/resources/habilitaciones'
import { ahora } from '../../lib/relojServidor'
import { mensajeDeError, motivoDe } from '../../api/client'
import { useColegiosReales } from '../../hooks/useCatalogos'
import { ACCION, puede } from '../../auth/permisos'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

// Literales de CU022, tal cual los da el caso de uso.
const SIN_ALUMNOS = 'No hay alumnos matriculados o activos en esta clase para la fecha seleccionada.'
const NO_LECTIVO = 'La fecha seleccionada no corresponde a un día lectivo válido del periodo vigente.'

/**
 * Lo que el servidor rechaza, dicho con palabras.
 *
 * Sin esto, un 403 o un 422 dejaban la pantalla enseñando "No hay alumnos
 * matriculados en esta clase": el mismo cartel que cuando el aula existe y está
 * vacía. El docente leía que su clase no tiene alumnos cuando lo que pasaba era
 * que esa aula no es suya o que el grado no se dicta en ese colegio.
 */
const RECHAZO = {
  aula_fuera_de_alcance: {
    titulo: 'Esa aula no está a su cargo',
    texto: 'Solo puede registrar la asistencia de los colegios y grados que tiene asignados este periodo.',
  },
  colegio_inexistente: { titulo: 'El colegio no existe' },
  grado_no_ofrecido: { titulo: 'Ese grado no se dicta en este colegio' },
  programa_no_ofrecido: { titulo: 'Ese subprograma no se dicta en esta clase' },
}

export default function AsistenciaPage() {
  const toast = useToast()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const conActividad = Boolean(useActividadStore((s) => s.sesion))
  const puedeEditar = puede('asistencia', idRol, ACCION.EDITAR)

  const { filtros, cambiar } = useFiltrosAsistencia()
  const [observando, setObservando] = useState(null)

  // El Docente ve sus aulas; el Supervisor, todas (CU021: solo de lectura).
  const esDocente = puedeEditar

  const { data: asignaciones = [] } = useQuery({
    queryKey: ['me', 'asignaciones'],
    queryFn: listarMisAsignaciones,
    enabled: esDocente,
    ...SIEMPRE,
  })

  // `GET /colegios` es de administración: pedirlo como Docente sería un 403.
  const { data: todosLosColegios = [] } = useColegiosReales(!esDocente)

  /**
   * EL AULA DE UN PERMISO VIGENTE TAMBIÉN ES SUYA (D56).
   *
   * El contrato es explícito: "los grupos a los que solo llega por un permiso
   * NO suman a `asignaciones`". Como estos filtros se armaban solo con
   * `GET /me/asignaciones`, el colegio del permiso no salía en el desplegable
   * y el Docente no tenía forma de abrir la pantalla donde usarlo, que es lo
   * único para lo que se le dio.
   *
   * Salen del paquete offline, que desde la tanda I trae los nombres: así el
   * aula se ofrece también sin conexión, que es cuando hace falta.
   */
  const { data: habilitaciones } = useQuery({
    queryKey: ['me', 'habilitaciones'],
    queryFn: obtenerMisHabilitaciones,
    enabled: esDocente,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  /** Solo los VIGENTES ahora: un permiso programado todavía no habilita nada. */
  const permisos = useMemo(() => {
    const momento = ahora().getTime()
    return (habilitaciones?.permisos ?? []).filter(
      (p) => Date.parse(p.inicio) <= momento && momento <= Date.parse(p.fin),
    )
  }, [habilitaciones])

  const colegios = useMemo(() => {
    if (!esDocente) return todosLosColegios
    const vistos = new Map()
    asignaciones.forEach((a) => vistos.set(String(a.id_colegio), { id_colegio: a.id_colegio, nombre: a.colegio }))
    permisos.forEach((p) => {
      const id = p.colegio?.id ?? p.id_colegio
      if (id == null || vistos.has(String(id))) return
      vistos.set(String(id), { id_colegio: id, nombre: p.colegio?.nombre ?? `Colegio ${id}` })
    })
    return [...vistos.values()]
  }, [esDocente, asignaciones, permisos, todosLosColegios])

  // El colegio dice qué grados ofrece y con qué subprogramas, los dos con id.
  const { data: colegio } = useQuery({
    queryKey: ['colegio', 'detalle', filtros.idColegio],
    queryFn: () => obtenerColegio(filtros.idColegio),
    enabled: Boolean(filtros.idColegio),
    ...SIEMPRE,
  })

  const asignacion = useMemo(
    () => asignaciones.find((a) => String(a.id_colegio) === String(filtros.idColegio)),
    [asignaciones, filtros.idColegio],
  )

  const grados = useMemo(() => {
    const delColegio = colegio?.grados ?? []
    if (!esDocente) return delColegio

    const mios = new Set((asignacion?.grados ?? []).map(String))
    // Y los grados de sus permisos vigentes EN ESTE colegio (D56).
    permisos
      .filter((p) => String(p.colegio?.id ?? p.id_colegio ?? '') === String(filtros.idColegio))
      .forEach((p) => {
        const id = p.grado?.id ?? p.id_grado
        if (id != null) mios.add(String(id))
      })

    if (!mios.size) return delColegio
    const cruce = delColegio.filter((g) => mios.has(String(g.id_grado)))
    return cruce.length ? cruce : delColegio
  }, [colegio, esDocente, asignacion, permisos, filtros.idColegio])

  /**
   * Las secciones del grado elegido, que solo trae el detalle del colegio.
   *
   * `colegio.seccion` desapareció con T3: ahora cada grado tiene las suyas, y
   * `GET /asistencias` recibe `id_seccion` porque la clase es colegio × grado
   * × sección, sin subprograma —el subprograma es del alumno—.
   */
  const secciones = useMemo(
    () => grados.find((g) => String(g.id_grado) === String(filtros.idGrado))?.secciones ?? [],
    [grados, filtros.idGrado],
  )

  /**
   * Los subprogramas que esta aula tiene DE VERDAD.
   *
   * El colegio los da con id; la asignación, solo los nombres de los que tienen
   * alumnos en ese grado. Se cruzan por nombre porque es lo único que comparten
   * —de ahí la petición al backend de que `GradoACargo.subprogramas` pase a
   * traer id y nombre—. Si el cruce no casa, se ofrecen todos los del colegio:
   * dejar el desplegable vacío sería peor que ofrecer uno de más.
   */
  const programas = useMemo(() => {
    const delColegio = colegio?.programas ?? []
    if (!esDocente || !asignacion) return delColegio
    const grado = (asignacion.detalle_grados ?? []).find((g) => String(g.id_grado) === String(filtros.idGrado))
    const suyos = new Set(grado?.subprogramas ?? [])
    if (!suyos.size) return delColegio
    const cruce = delColegio.filter((p) => suyos.has(p.nombre))
    return cruce.length ? cruce : delColegio
  }, [colegio, esDocente, asignacion, filtros.idGrado])

  const { data: docentes = [] } = useQuery({
    queryKey: ['admin', 'docentes'],
    queryFn: listarDocentes,
    enabled: !puedeEditar,
    ...SIEMPRE,
  })

  /**
   * Un `<select>` sin marcador de posición PINTA su primera opción aunque el
   * estado esté vacío. Por eso se eligen de verdad, en vez de dejar que la
   * pantalla aparente un colegio que el filtro no tiene.
   */
  useEffect(() => {
    if (!filtros.idColegio && colegios.length) cambiar('colegio', String(colegios[0].id_colegio))
  }, [colegios, filtros.idColegio, cambiar])

  /**
   * El grado y el subprograma DEPENDEN del colegio, así que no basta con
   * rellenarlos cuando están vacíos: si el que había guardado no está en la
   * lista nueva, hay que cambiarlo. Dejarlo valdría por una clase que el
   * servidor va a rechazar, y el docente vería un 403 sin tocar nada.
   */
  useEffect(() => {
    if (!grados.length) return
    if (grados.some((g) => String(g.id_grado) === String(filtros.idGrado))) return
    cambiar('grado', String(grados[0].id_grado))
  }, [grados, filtros.idGrado, cambiar])

  /**
   * El subprograma ya NO se elige solo.
   *
   * Antes era obligatorio para armar la clase, así que había que proponer uno.
   * Ahora es un filtro: su valor por defecto es "todos", que es lo que de
   * verdad tiene el aula. Lo único que se hace es limpiarlo si deja de ser
   * válido al cambiar de colegio.
   */
  useEffect(() => {
    if (!filtros.idPrograma || !programas.length) return
    if (programas.some((p) => String(p.id_programa) === String(filtros.idPrograma))) return
    cambiar('subprograma', '')
  }, [programas, filtros.idPrograma, cambiar])

  /**
   * Con UNA sección se elige sola; con varias se deja vacía a propósito.
   *
   * Es la misma regla que CU023 da para Lectura: adivinar el aula haría
   * registrar la asistencia de la clase equivocada, y son clases distintas.
   */
  useEffect(() => {
    if (!secciones.length) return
    if (secciones.some((x) => String(x.id) === String(filtros.idSeccion))) return
    cambiar('seccion', secciones.length === 1 ? String(secciones[0].id) : '')
  }, [secciones, filtros.idSeccion, cambiar])

  /**
   * La clase se arma SIN subprograma: colegio, grado, sección y fecha.
   *
   * El subprograma es un filtro de la vista —delimita a quién se ve— y no
   * forma parte de la identidad de la clase (CU022). Exigirlo aquí dejaría la
   * pantalla sin cargar mientras no se eligiera uno, para una clase que ya
   * está completamente determinada.
   */
  const listos = Boolean(filtros.idColegio && filtros.idGrado && filtros.idSeccion && filtros.fecha)

  const claveClase = useMemo(
    () => [
      'asistencia',
      'clase',
      filtros.idColegio,
      filtros.idGrado,
      filtros.idSeccion,
      filtros.fecha,
    ],
    [filtros.idColegio, filtros.idGrado, filtros.idSeccion, filtros.fecha],
  )

  const clase = useQuery({
    queryKey: claveClase,
    queryFn: () =>
      obtenerClase({
        idColegio: filtros.idColegio,
        idGrado: filtros.idGrado,
        idSeccion: filtros.idSeccion,
        fecha: filtros.fecha,
      }),
    enabled: listos,
    // Un día no lectivo responde 422: es una respuesta legítima del contrato,
    // no un fallo de red, así que reintentarlo solo retrasa el aviso.
    retry: false,
    /**
     * Siempre fresca al entrar. La clase cambia por fuera de esta pantalla —un
     * alumno dado de alta o de baja en Alumnos, una marca guardada desde otro
     * dispositivo, y CU022 dice que gana la más reciente—, y con el minuto de
     * caché general se veía la lista vieja. Sin conexión no se pierde nada: la
     * consulta se pausa y se sigue viendo lo que ya estaba.
     */
    staleTime: 0,
  })

  const todosLosAlumnos = useMemo(() => clase.data?.alumnos ?? [], [clase.data])

  /**
   * El filtro Subprograma recorta LO QUE SE VE, no lo que se pide.
   *
   * La clase trae a los alumnos de Alfabetización y de Comprensión Lectora que
   * estén en esa aula, porque es una sola clase. Elegir un subprograma deja ver
   * solo a unos, pero las marcas de los demás siguen ahí: CU022 pide
   * expresamente que cambiar el filtro conserve las asistencias registradas.
   */
  const alumnos = useMemo(
    () =>
      filtros.idPrograma
        ? todosLosAlumnos.filter((a) => String(a.id_programa) === String(filtros.idPrograma))
        : todosLosAlumnos,
    [todosLosAlumnos, filtros.idPrograma],
  )
  /**
   * Quién escribe lo dice el servidor en `escritura.permitida`, que ya cubre
   * el rol, la fecha y la habilitación. La actividad abierta se comprueba
   * también aquí porque es del cliente: el servidor no sabe si hay una hasta
   * que llega la escritura, y para entonces el docente ya rellenó la pantalla.
   */
  const datosClase = clase.data?.clase
  const escritura = clase.data?.escritura

  /**
   * ESA FECHA NO TIENE CLASE (CU022, flujo "Identificar la clase seleccionada").
   *
   * El servidor lo dice con `etiqueta: null`. Entonces no se habilita la lista:
   * primero hay que decidir que se va a registrar una CLASE ADICIONAL, y eso lo
   * decide el Docente, no la pantalla. Marcar sin decidirlo acababa en un
   * rechazo `sin_clase_programada` después de haber rellenado media tabla.
   */
  const sinClase = Boolean(clase.data) && !datosClase?.etiqueta
  const [registrandoAdicional, setRegistrandoAdicional] = useState(false)

  // La decisión es de ESTA clase: cambiar de fecha o de aula la olvida, o se
  // registrarían adicionales en días que el docente ni miró.
  useEffect(() => setRegistrandoAdicional(false), [filtros.idColegio, filtros.idGrado, filtros.idSeccion, filtros.fecha])

  const autoguardado =
    Boolean(escritura?.permitida) && puedeEditar && conActividad && (!sinClase || registrandoAdicional)
  const soloLectura = !autoguardado

  /**
   * La fecha la sigue rechazando el SERVIDOR con un 422, como antes; lo que
   * cambió es que ya no es un motivo sino CUATRO, y cada uno se dice distinto.
   * No es un fallo: es un estado de la pantalla, así que no pasa por `RECHAZO`.
   */
  const motivo = motivoDe(clase.error)
  const fechaRechazada = esMotivoDeFecha(motivo)
  const rechazo = clase.isError && !fechaRechazada ? (RECHAZO[motivo] ?? {}) : null

  const { marcaDe, marcar, observar, marcarTodosPresentes, sinMarcar } = useAutoguardado({
    alumnos,
    fecha: filtros.fecha,
    // La clase entera: el servidor la identifica por su clave cuando todavía
    // no tiene `id_clase`, porque una habitual puede no tener fila aún.
    idColegio: filtros.idColegio,
    idGrado: filtros.idGrado,
    idSeccion: filtros.idSeccion,
    activo: autoguardado,
    // CU022: la clase adicional se crea AL GUARDAR la primera asistencia, no
    // al pulsar el botón. Por eso la marca viaja con el aviso, y pulsar no
    // deja ningún registro vacío detrás.
    adicional: sinClase && registrandoAdicional,
    claveClase,
  })

  const marcarTodos = () => {
    const cuantos = marcarTodosPresentes()
    toast.success(
      `${cuantos} alumno${cuantos === 1 ? '' : 's'} marcado${cuantos === 1 ? '' : 's'} como presente`,
      'No se tocaron los que ya tenían una marca puesta a mano.',
    )
  }

  const guardarObservacion = async (texto) => {
    const alumno = observando
    setObservando(null)
    await observar(alumno, texto)
  }

  const hayLista = listos && !fechaRechazada && alumnos.length > 0

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Asistencia</h1>
        <p className="mt-1 text-sm text-ink-500">
          Se guarda sola: cada marca se registra al momento, sin botón de guardar.
        </p>
      </header>

      {puedeEditar && !conActividad && <AvisoActividades />}

      {/*
        El servidor dice POR QUÉ no se puede escribir, con el texto ya
        redactado: sin habilitación vigente, o que el Supervisor consulta en
        solo lectura. Sin pintarlo, la pantalla se quedaba muda en solo lectura
        y el docente no sabía si era su permiso, la fecha o un fallo.

        Si la actividad ya se avisó arriba no se repite: es el mismo motivo
        dicho dos veces.
      */}
      {escritura?.permitida === false && escritura.motivo && conActividad && (
        <AvisoActividades mensaje={escritura.motivo} />
      )}

      {/* Una corrección excepcional SÍ hay que anunciarla: el docente está
          escribiendo en un periodo cerrado y con fecha de caducidad. */}
      {escritura?.permitida && escritura.aviso_permiso && <AvisoActividades mensaje={escritura.aviso_permiso} />}

      {/*
        Lo que el servidor rechazó y sigue sin resolverse.

        Faltaba aquí, y era el único de los cuatro módulos sin él: una marca
        rechazada después de recargar la página no la veía nadie, y el docente
        solo se enteraba mirando Sesiones, donde su actividad salía en "Error"
        sin decir de qué.
      */}
      <AvisoConflictos modulo="asistencias" />

      <FiltrosAsistencia
        filtros={filtros}
        cambiar={cambiar}
        colegios={colegios}
        grados={grados}
        programas={programas}
        secciones={secciones}
        docentes={docentes}
        eligeDocente={!puedeEditar}
      />

      {!listos && (
        <Card>
          <EmptyState
            title="Complete los filtros"
            description="La clase se arma con colegio, grado, sección y fecha."
          />
        </Card>
      )}

      {/*
        La clase se nombra sola. El servidor manda la `etiqueta` —"Clase
        programada", "Clase reprogramada", "Clase adicional"— y un `aviso` ya
        redactado cuando hay algo que explicar: que la clase de ese dia se
        trasladó a otro, o que registrar una adicional NO completa la
        asistencia de la trasladada. Eso último es justo lo que un docente
        daría por supuesto al contrario, así que se dice.
      */}
      {(datosClase?.etiqueta || datosClase?.aviso || registrandoAdicional) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {/*
            La etiqueta del servidor o, si todavía no hay clase y el Docente
            decidió registrar una adicional, la que tendrá al guardarse.
          */}
          <span className="rounded-full bg-ink-100 px-3 py-1 font-medium text-ink-700">
            {datosClase?.etiqueta ?? 'Clase adicional'}
          </span>
          {datosClase?.aviso && <span className="text-ink-500">{datosClase.aviso}</span>}

          {/*
            CU022: "Antes de habilitar la lista para escritura, presenta el
            botón 'Registrar clase adicional'".

            La clase se crea AL GUARDAR la primera asistencia, no al pulsar:
            pulsar no deja ningún registro vacío detrás. Y no sustituye
            ninguna validación —sesión, actividad, calendario, habilitación
            siguen decidiendo—, por eso solo sale cuando lo demás ya deja
            escribir.
          */}
          {sinClase && !registrandoAdicional && puedeEditar && conActividad && escritura?.permitida && (
            <Button size="sm" variant="secondary" onClick={() => setRegistrandoAdicional(true)}>
              Registrar clase adicional
            </Button>
          )}
        </div>
      )}

      {listos && fechaRechazada && (
        <Card>
          <EmptyState
            icon={CalendarX2}
            title="No se puede registrar en esta fecha"
            // El `detail` del servidor primero: el de `fecha_no_lectiva` lleva
            // dentro el motivo concreto —fin de semana, feriado, suspensión—
            // que aquí no hay forma de saber.
            description={mensajeDeError(clase.error, MOTIVO_FECHA[motivo] ?? NO_LECTIVO)}
          />
        </Card>
      )}

      {/* Un rechazo del servidor NO es una clase vacía. Se dice cuál fue. */}
      {rechazo && (
        <Card>
          <EmptyState
            icon={Ban}
            title={rechazo.titulo ?? 'No se pudo cargar la clase'}
            description={rechazo.texto ?? mensajeDeError(clase.error)}
          />
        </Card>
      )}

      {listos && !clase.isError && !clase.isLoading && alumnos.length === 0 && (
        <Card>
          <EmptyState title="Sin alumnos en esta clase" description={SIN_ALUMNOS} />
        </Card>
      )}

      {hayLista && (
        <Card
          title={`${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'}`}
          padded={false}
          actions={
            // CU022: el botón de lote se OCULTA para el Supervisor, no se
            // deshabilita. Y no tiene nada que hacer si no queda nadie sin marcar.
            autoguardado && sinMarcar > 0 ? (
              <Button iconLeft={CheckCheck} onClick={marcarTodos}>
                Marcar todos como presentes
              </Button>
            ) : null
          }
        >
          <ListaAsistencia
            alumnos={alumnos}
            marcaDe={marcaDe}
            soloLectura={soloLectura}
            onMarcar={marcar}
            // El último texto vive en el estado del autoguardado, no en `alumno`.
            onObservar={(alumno) => setObservando({ ...alumno, observacion: marcaDe(alumno).observacion })}
          />
        </Card>
      )}

      <ModalObservacion
        alumno={observando}
        soloLectura={soloLectura}
        onGuardar={guardarObservacion}
        onCerrar={() => setObservando(null)}
      />
    </div>
  )
}
