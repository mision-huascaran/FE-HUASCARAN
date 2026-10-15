// Cubre: CU022 · Registrar asistencias de alumnos.
//
// YA NO ES UNA DEMO: el backend publica `GET /asistencias` y `PUT /asistencias`.
//
// Una CLASE es fecha + colegio + grado + subprograma. La SECCIÓN no viaja al
// servidor: es un atributo del colegio ("Única") que el alumno hereda, así que
// el filtro solo sirve para que el docente se ubique.
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
import { CheckCheck, CalendarX2 } from 'lucide-react'
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
import { listarSeccionesDe, obtenerClase } from '../../api/resources/asistencia'
import { listarDocentes } from '../../api/resources/administracion'
import { motivoDe } from '../../api/client'
import { useColegios, useGrados, useProgramas } from '../../hooks/useCatalogos'
import { ACCION, puede } from '../../auth/permisos'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

// Literales de CU022, tal cual los da el caso de uso.
const SIN_ACTIVIDAD = 'Inicia una actividad de trabajo para habilitar el registro de datos.'
const SIN_ALUMNOS = 'No hay alumnos matriculados o activos en esta clase para la fecha seleccionada.'
const NO_LECTIVO = 'La fecha seleccionada no corresponde a un día lectivo válido del periodo vigente.'

export default function AsistenciaPage() {
  const toast = useToast()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const conActividad = Boolean(useActividadStore((s) => s.sesion))
  const puedeEditar = puede('asistencia', idRol, ACCION.EDITAR)

  const { filtros, cambiar } = useFiltrosAsistencia()
  const [observando, setObservando] = useState(null)

  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()

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

  useEffect(() => {
    if (!filtros.idGrado && grados.length) cambiar('grado', String(grados[0].id_grado))
  }, [grados, filtros.idGrado, cambiar])

  useEffect(() => {
    if (!filtros.idPrograma && programas.length) cambiar('subprograma', String(programas[0].id_programa))
  }, [programas, filtros.idPrograma, cambiar])

  const { data: secciones = [] } = useQuery({
    queryKey: ['asistencia', 'secciones', filtros.idColegio, filtros.idGrado],
    queryFn: () => listarSeccionesDe({ idColegio: filtros.idColegio, idGrado: filtros.idGrado }),
    enabled: Boolean(filtros.idColegio && filtros.idGrado),
  })

  // CU022, paso 3: con una sola aula se rellena sola; con varias se deja vacía
  // a propósito, porque elegir por el docente sería registrar otra clase.
  useEffect(() => {
    if (!filtros.seccion && secciones.length === 1) cambiar('seccion', secciones[0])
  }, [secciones, filtros.seccion, cambiar])

  const listos = Boolean(
    filtros.idColegio && filtros.idGrado && filtros.seccion && filtros.idPrograma && filtros.fecha,
  )

  const clase = useQuery({
    queryKey: ['asistencia', 'clase', filtros.idColegio, filtros.idGrado, filtros.idPrograma, filtros.fecha],
    queryFn: () =>
      obtenerClase({
        idColegio: filtros.idColegio,
        idGrado: filtros.idGrado,
        idPrograma: filtros.idPrograma,
        fecha: filtros.fecha,
      }),
    enabled: listos,
    // Un día no lectivo responde 422: es una respuesta legítima del contrato,
    // no un fallo de red, así que reintentarlo solo retrasa el aviso.
    retry: false,
  })

  const alumnos = useMemo(() => clase.data?.alumnos ?? [], [clase.data])
  // El día lectivo lo decide el SERVIDOR (CU022, Restricciones): llega como un
  // 422 con `motivo: 'fecha_no_lectiva'`.
  const diaNoLectivo = motivoDe(clase.error) === 'fecha_no_lectiva'

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
        secciones={secciones}
        programas={programas}
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

      {listos && !diaNoLectivo && !clase.isLoading && alumnos.length === 0 && (
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
            onObservar={setObservando}
          />
        </Card>
      )}

      <ModalObservacion
        alumno={observando}
        onGuardar={guardarObservacion}
        onCerrar={() => setObservando(null)}
      />
    </div>
  )
}
