// Cubre: CU022 · Registrar asistencias de alumnos.
//
// YA NO ES UNA DEMO: el backend publica `GET /asistencias` y `PUT /asistencias`.
//
// Una CLASE es fecha + colegio + grado + subprograma, y nada más: la sección no
// está en el contrato y ya no se pide.
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
//   · Quién puede escribir lo decide el SERVIDOR con `editable`, no esta
//     pantalla: es `true` solo para el Docente en un día lectivo del periodo
//     vigente. El Supervisor lo recibe siempre en `false` (CU021).
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCheck, CalendarX2, Ban } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import AvisoActividades from '../../components/layout/AvisoActividades'
import FiltrosAsistencia from './FiltrosAsistencia'
import ListaAsistencia from './ListaAsistencia'
import ModalObservacion from './ModalObservacion'
import useFiltrosAsistencia from './useFiltrosAsistencia'
import useAutoguardado from './useAutoguardado'
import { useToast } from '../../components/ui/Toast'
import { obtenerClase } from '../../api/resources/asistencia'
import { listarDocentes, listarMisAsignaciones, obtenerColegio } from '../../api/resources/administracion'
import { mensajeDeError, motivoDe } from '../../api/client'
import { useColegiosReales } from '../../hooks/useCatalogos'
import { ACCION, puede } from '../../auth/permisos'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

// Literales de CU022, tal cual los da el caso de uso.
const SIN_ACTIVIDAD = 'Inicia una actividad de trabajo para habilitar el registro de datos.'
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

  const colegios = useMemo(
    () =>
      esDocente
        ? asignaciones.map((a) => ({ id_colegio: a.id_colegio, nombre: a.colegio }))
        : todosLosColegios,
    [esDocente, asignaciones, todosLosColegios],
  )

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
    if (!esDocente || !asignacion) return delColegio
    const mios = new Set((asignacion.grados ?? []).map(String))
    return delColegio.filter((g) => mios.has(String(g.id_grado)))
  }, [colegio, esDocente, asignacion])

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

  useEffect(() => {
    if (!programas.length) return
    if (programas.some((p) => String(p.id_programa) === String(filtros.idPrograma))) return
    cambiar('subprograma', String(programas[0].id_programa))
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

  const listos = Boolean(
    filtros.idColegio && filtros.idGrado && filtros.idSeccion && filtros.idPrograma && filtros.fecha,
  )

  const claveClase = useMemo(
    () => [
      'asistencia',
      'clase',
      filtros.idColegio,
      filtros.idGrado,
      filtros.idSeccion,
      filtros.idPrograma,
      filtros.fecha,
    ],
    [filtros.idColegio, filtros.idGrado, filtros.idSeccion, filtros.idPrograma, filtros.fecha],
  )

  const clase = useQuery({
    queryKey: claveClase,
    queryFn: () =>
      obtenerClase({
        idColegio: filtros.idColegio,
        idGrado: filtros.idGrado,
        idSeccion: filtros.idSeccion,
        idPrograma: filtros.idPrograma,
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

  const alumnos = useMemo(() => clase.data?.alumnos ?? [], [clase.data])
  // El día lectivo lo decide el SERVIDOR (CU022, Restricciones): llega como un
  // 422 con `motivo: 'fecha_no_lectiva'`.
  const motivo = motivoDe(clase.error)
  const diaNoLectivo = motivo === 'fecha_no_lectiva'
  const rechazo = clase.isError && !diaNoLectivo ? (RECHAZO[motivo] ?? {}) : null

  /**
   * Quién escribe lo dice el servidor con `editable`, y encima tiene que haber
   * una actividad abierta. Son dos condiciones distintas: `editable` cubre el
   * rol y la fecha; la actividad, el requisito de CU010.
   */
  const autoguardado = Boolean(clase.data?.editable) && puedeEditar && conActividad
  const soloLectura = !autoguardado

  const { marcaDe, marcar, observar, marcarTodosPresentes, sinMarcar } = useAutoguardado({
    alumnos,
    fecha: filtros.fecha,
    idPrograma: filtros.idPrograma,
    activo: autoguardado,
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

  const hayLista = listos && !diaNoLectivo && alumnos.length > 0

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Asistencia</h1>
        <p className="mt-1 text-sm text-ink-500">
          Se guarda sola: cada marca se registra al momento, sin botón de guardar.
        </p>
      </header>

      {puedeEditar && !conActividad && <AvisoActividades mensaje={SIN_ACTIVIDAD} />}

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
            description="La clase se arma con colegio, grado, sección, subprograma y fecha."
          />
        </Card>
      )}

      {listos && diaNoLectivo && (
        <Card>
          <EmptyState icon={CalendarX2} title="Día no lectivo" description={NO_LECTIVO} />
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
