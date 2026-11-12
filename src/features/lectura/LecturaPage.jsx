// Cubre: CU023 a CU026 · Seguimiento de Lectura, rehecho en la tanda 7.
//
// LO QUE CAMBIÓ DE RAÍZ: antes era una grilla de filas sueltas, una por alumno
// y semana. Ahora la unidad es la TABLA SEMANAL: un objeto que existe o no
// existe, se crea a mano, tiene su versión y se puede marcar "no realizada".
//
// Por eso la pantalla tiene TRES estados y no uno:
//
//   1. Filtros incompletos — no hay tabla que buscar todavía.
//   2. La tabla no existe — y eso NO es un error. Se ofrece crearla, diciendo
//      a qué clase quedará atada, porque crearla congela la lista de alumnos
//      de esa clase y eso no se puede deshacer sin consecuencias.
//   3. La tabla existe — se editan sus filas.
//
// Y la lectura DEPENDE DE LA ASISTENCIA: sin presente o tardanza en la clase de
// referencia no hay libros que registrar. La asistencia se muestra pero no se
// edita aquí; su sitio es el módulo de Asistencia, y duplicar el control haría
// que el docente marcara la falta dos veces.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck, CalendarPlus, Users } from 'lucide-react'
import AvisoActividades from '../../components/layout/AvisoActividades'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import AvisoConflictos from '../../components/layout/AvisoConflictos'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import selectsDelGrupo from '../../components/filtros/selectsDelGrupo'
import ModalObservacionLectura from './ModalObservacionLectura'
import ModalNoRealizada from './ModalNoRealizada'
import ModalHabilitarRegistro from './ModalHabilitarRegistro'
import ModalCambiarClase from './ModalCambiarClase'
import TablaLectura from './TablaLectura'
import useFiltrosDeGrupo, { MESES, esSemanaFutura, etiquetaDeSemanaDeGrupo } from '../../hooks/useFiltrosDeGrupo'
import useTablaLectura from './useTablaLectura'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { erroresDeCampo, mensajeDeError } from '../../api/client'
import { ACCION, puede } from '../../auth/permisos'
import { SIN_ACTIVIDAD } from '../../api/resources/sincronizacion'
import { esFutura } from '../../lib/relojServidor'
import { ROLES } from '../../auth/roles'
import { useActividadEnCurso } from '../../store/actividadStore'
import { MODULOS } from '../../auth/habilitaciones'
import useEscrituraConActividad from '../../hooks/useEscrituraConActividad'
import useSessionStore from '../../store/sessionStore'
import useConexion from '../../hooks/useConexion'

/** Crear la tabla y marcarla no realizada no se encolan: congelan listas. */
export const REQUIERE_CONEXION = 'Esta acción requiere conexión'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

const FECHA_LARGA = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
const comoFecha = (iso) => (iso ? FECHA_LARGA.format(new Date(`${iso}T12:00:00`)) : null)

/** Lo que dice el estado vacío de una tabla por crear: un solo mensaje, sin contradicciones (U02). */
function descripcionPorCrear(clase, futura) {
  if (!clase) return 'La semana no tiene una clase programada: hace falta elegir la clase de referencia para poder crearla.'
  if (futura) return `La clase de referencia es el ${comoFecha(clase.fecha)}. Podrás crear la tabla a partir de ese día.`
  return `Se creará sobre la clase del ${comoFecha(clase.fecha)}, con los alumnos que estaban en ella ese día.`
}

/**
 * Una semana que todavía no empieza se ve, pero no se elige (U02): no tiene
 * clase dictada, y abrirla solo llevaba a "la clase todavía no se ha dictado".
 */
const opcionDeSemana = (s) => {
  const futura = esSemanaFutura(s)
  return {
    value: s.id_semana,
    label: futura ? `${etiquetaDeSemanaDeGrupo(s)} (próxima)` : etiquetaDeSemanaDeGrupo(s),
    disabled: futura,
  }
}

export default function LecturaPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const esDocente = idRol === ROLES.PROFESOR
  // D114 — La fuente única de la actividad (la misma que la cabecera).
  const { enCurso: conActividad } = useActividadEnCurso()
  const puedeEditar = puede('lectura', idRol, ACCION.EDITAR)

  const [observando, setObservando] = useState(null)
  const [justificando, setJustificando] = useState(false)
  const [habilitando, setHabilitando] = useState(false)
  const [cambiandoClase, setCambiandoClase] = useState(false)

  // El año escolar en curso. La tabla lo exige, y no se puede deducir del mes:
  // enero y febrero pertenecen al año anterior en algunos colegios.
  const { data: anios = [] } = useQuery({
    queryKey: ['anios-escolares'],
    queryFn: listarAniosEscolares,
    ...SIEMPRE,
  })
  const anioEscolar = useMemo(() => anioVigente(anios), [anios])
  const idAnioEscolar = anioEscolar?.id ?? null

  /**
   * Los meses que YA EMPEZARON, no los doce.
   *
   * Antes de este cambio se ofrecía diciembre estando en noviembre: el
   * docente lo elegía, `semanas` venía vacío y se topaba con "Sin clases este
   * mes" sin entender por qué, si el mes ni siquiera había llegado. Mejor no
   * ofrecerlo.
   *
   * `anioEscolar.nombre` es el año civil (`db.ANIO_LECTIVO` en el simulador,
   * "2026"…). Es una aproximación: si el año escolar de un colegio cruzara de
   * diciembre a enero (el comentario de más arriba lo deja abierto), enero y
   * febrero de ESE año escolar serían en realidad del año civil siguiente, y
   * esta cuenta los mostraría como si ya hubieran pasado. No hay en el
   * catálogo de años escolares más que `{id, nombre, vigente}`: sin fechas de
   * inicio y fin por año no hay de dónde sacar el caso exacto.
   */
  const mesesDisponibles = useMemo(() => {
    if (!anioEscolar?.nombre) return MESES
    return MESES.filter((m) => !esFutura(`${anioEscolar.nombre}-${String(m.value).padStart(2, '0')}-01`))
  }, [anioEscolar])

  const { colegios, grados, secciones, programas, semanas, filtros, grupoValido, cambiar } = useFiltrosDeGrupo({
    esDocente,
    idAnioEscolar,
  })

  /**
   * La semana elegida, SOLO si es una de las del mes. Mientras llegan las
   * semanas de un mes nuevo, o si la URL trae una semana de otro mes, no hay
   * semana elegida y la tabla no se pide: se pediría con una semana que el
   * filtro ya descartó.
   */
  const semanaElegida = useMemo(
    () => semanas.find((s) => String(s.id_semana) === String(filtros.idSemana)) ?? null,
    [semanas, filtros.idSemana],
  )

  const {
    tabla,
    cargando,
    error,
    porCrear,
    sinAlumnos,
    crear,
    creando,
    marcarNoRealizada,
    marcando,
    habilitarRegistro,
    habilitando: habilitandoRegistro,
    errorAlHabilitar,
    cambiarClase,
    cambiandoClase: guardandoClase,
    guardarFila,
  } = useTablaLectura(filtros, { grupoValido: grupoValido && Boolean(semanaElegida) })

  /*
   * EL FILTRO MES YA NO SIGUE A LA TABLA. Lo movía un efecto al `mes` de la
   * tabla (tanda B), y con una semana ya elegida eso impedía ir a un mes
   * pasado: la tabla que llegaba era la de la semana vieja y devolvía el
   * filtro a su mes. Ahora el mes lo elige el docente y la semana se busca
   * dentro de él; una semana que cae en dos meses aparece en el mes donde la
   * pone `GET /semanas`, sin mover el filtro.
   */

  // Un solo estado vacío a la vez (U07): sin clases en el mes no hay filtro que completar.
  const sinClasesEsteMes = Boolean(filtros.idSeccion) && semanas.length === 0

  const listos = Boolean(
    filtros.idColegio &&
      filtros.idGrado &&
      filtros.idSeccion &&
      filtros.idPrograma &&
      filtros.mes &&
      filtros.idSemana &&
      idAnioEscolar,
  )

  /**
   * Quién escribe lo dice el servidor en `escritura.permitida` —cubre el rol,
   * la habilitación y el permiso excepcional—, y la actividad abierta se
   * comprueba aquí porque es del cliente.
   */
  // D114 — Con una actividad que el servidor aún no conoce, su "no" no cuenta.
  const escritura = useEscrituraConActividad({
    escritura: tabla?.escritura ?? porCrear?.escritura ?? null,
    registra: puedeEditar,
    modulo: MODULOS.LECTURA,
    idColegio: filtros.idColegio,
    idGrado: filtros.idGrado,
    fecha: tabla?.clase_referencia?.fecha ?? porCrear?.claseSugerida?.fecha ?? null,
  })
  const puedeEscribir = Boolean(escritura?.permitida) && puedeEditar && conActividad
  const soloLectura = !puedeEscribir

  const enLinea = useConexion()
  const guardar = (fila, cambios) =>
    guardarFila({ idAlumno: fila.id_alumno, cambios, version: fila.version })

  /**
   * POR QUÉ NO SE PUEDE CREAR LA TABLA, dicho en el propio estado vacío.
   *
   * Antes el botón simplemente NO APARECÍA: la pantalla decía "Esta semana aún
   * no tiene tabla de lectura. Se creará sobre la clase del 2 de noviembre" y
   * ahí se acababa. Sin botón y sin motivo, Seguimiento de Lectura parece
   * averiado —no hay nada que pulsar y nada que leer—, que es justo lo que
   * reportó el Docente.
   *
   * Ahora el botón se muestra siempre y, cuando no se puede, va deshabilitado
   * con su razón al lado. Es lo mismo que ya hacen CU029 y CU030 con
   * "Registrar evaluaciones", y lo que pide D59: un control habilitado que no
   * puede funcionar miente, pero uno que desaparece sin explicación también.
   */
  const claseFutura = esFutura(porCrear?.claseSugerida?.fecha)
  const motivoParaNoCrear = (() => {
    if (!porCrear?.claseSugerida) return 'Elige antes la clase de referencia de esta semana.'
    if (!puedeEditar) return 'Tu rol consulta esta pantalla, no registra en ella.'
    if (!conActividad) return SIN_ACTIVIDAD
    if (escritura?.permitida === false) return escritura.motivo ?? 'No tienes habilitación para esta semana.'
    /**
     * CU024 exige que la fecha efectiva de la clase sea lectiva y NO futura.
     * La fecha ya viene en el 404, así que se dice antes de pulsar en vez de
     * dejar que el servidor responda "La clase de referencia todavía no se ha
     * realizado" cuando ya es tarde.
     */
    if (claseFutura) return 'La clase de referencia todavía no se ha dictado. Podrás crear la tabla a partir de esa fecha.'
    if (!enLinea) return REQUIERE_CONEXION
    return null
  })()

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Seguimiento de Lectura</h1>
        <p className="mt-1 text-sm text-ink-500">
          Registro semanal de lectura de cada alumno.
        </p>
      </header>

      {puedeEditar && !conActividad && <AvisoActividades />}
      {/* El servidor dice POR QUÉ no se puede escribir. Si la actividad ya se
          avisó arriba no se repite: es el mismo motivo dicho dos veces. */}
      {escritura?.permitida === false && escritura.motivo && conActividad && (
        <AvisoActividades mensaje={escritura.motivo} />
      )}
      {escritura?.permitida && escritura.aviso_permiso && <AvisoActividades mensaje={escritura.aviso_permiso} />}
      {soloLectura && conActividad && escritura?.permitida && <AvisoModoConsulta />}
      <AvisoConflictos modulo="lectura" />

      {/* El MES va antes que la semana: las semanas que se ofrecen son las que
          tienen clase de este grupo en ese mes, y no las del año entero. */}
      <FilterBar>
        {selectsDelGrupo({ filtros, cambiar, colegios, grados, secciones, programas, esDocente })}
        <Select
          ancho="corto"
          label="Mes"
          value={filtros.mes}
          onChange={(e) => cambiar('mes', e.target.value)}
          options={mesesDisponibles}
        />
        <Select
          label="Semana"
          value={filtros.idSemana}
          placeholder={semanas.length ? 'Selecciona' : 'Sin clases este mes'}
          onChange={(e) => cambiar('semana', e.target.value)}
          options={semanas.map(opcionDeSemana)}
        />
      </FilterBar>

      {!listos && !sinClasesEsteMes && (
        <Card>
          <EmptyState
            title="Completa los filtros"
            description="La tabla se arma con colegio, grado, sección, subprograma, mes y semana."
          />
        </Card>
      )}

      {/* Una semana SIN CLASES del grupo no tiene tabla ni obligación: no es un
          hueco que el docente tenga que rellenar. */}
      {sinClasesEsteMes && (
        <Card>
          <EmptyState
            title="Sin clases este mes"
            description="Este grupo no tiene clases en el mes seleccionado, así que no hay lectura que registrar."
          />
        </Card>
      )}

      {/*
        ESTE ES EL ESTADO QUE ANTES SE VEÍA COMO UN ERROR. La tabla no existe
        todavía, y crearla es lo único que se puede hacer aquí. Se dice a qué
        clase quedará atada porque crearla CONGELA la lista de alumnos de esa
        clase: no es un detalle, es la consecuencia.
      */}
      {listos && porCrear && !cargando && (
        <Card>
          <EmptyState
            icon={BookOpenCheck}
            title={
              claseFutura
                ? 'La clase de esta semana todavía no se ha dictado'
                : 'Esta semana aún no tiene tabla de lectura'
            }
            description={descripcionPorCrear(porCrear.claseSugerida, claseFutura)}
            action={
              porCrear.claseSugerida ? (
                <div className="flex flex-col items-center gap-1">
                  <Button
                    iconLeft={CalendarPlus}
                    loading={creando}
                    disabled={Boolean(motivoParaNoCrear)}
                    onClick={() => crear({})}
                  >
                    Crear la tabla de esta semana
                  </Button>
                  {/* El motivo VISIBLE, no en un tooltip: CU029 lo pide así
                      para el botón hermano de Rúbrica, y aquí vale igual. */}
                  {/* Con la clase en el futuro, el motivo ya es la descripción: un solo mensaje (U02). */}
                  {motivoParaNoCrear && !claseFutura && (
                    <p className="max-w-sm text-xs text-ink-500">{motivoParaNoCrear}</p>
                  )}
                </div>
              ) : null
            }
          />
        </Card>
      )}

      {/* Tanda M (D101): el texto del servidor, tal cual, y sin "Crear tabla". */}
      {listos && sinAlumnos && !cargando && (
        <Card>
          <EmptyState icon={Users} title={sinAlumnos} />
        </Card>
      )}

      {listos && error && (
        <Card>
          <EmptyState title="No se pudo cargar la tabla" description={mensajeDeError(error)} />
        </Card>
      )}

      {listos && tabla && (
        <TablaLectura
          tabla={tabla}
          soloLectura={soloLectura}
          marcando={marcando}
          habilitando={habilitandoRegistro}
          sinConexion={!enLinea}
          onGuardarFila={guardar}
          onObservar={setObservando}
          onNoRealizada={() => setJustificando(true)}
          onHabilitarRegistro={() => setHabilitando(true)}
          onCambiarClase={() => setCambiandoClase(true)}
        />
      )}

      <ModalObservacionLectura
        fila={observando}
        soloLectura={soloLectura || tabla?.estado === 'no_realizada'}
        onGuardar={(texto) => {
          const fila = observando
          setObservando(null)
          guardar(fila, { observacion: texto || null })
        }}
        onCerrar={() => setObservando(null)}
      />

      <ModalNoRealizada
        open={justificando}
        guardando={marcando}
        onGuardar={(motivo) => {
          setJustificando(false)
          marcarNoRealizada(motivo)
        }}
        onCerrar={() => setJustificando(false)}
      />

      <ModalHabilitarRegistro
        open={habilitando}
        guardando={habilitandoRegistro}
        // El 422 llega en `errores[].campo = "motivo"`, así que el mensaje va
        // debajo de su campo y no en un aviso general (D62).
        error={erroresDeCampo(errorAlHabilitar).motivo}
        onConfirmar={(motivo) => {
          setHabilitando(false)
          habilitarRegistro(motivo)
        }}
        onCerrar={() => setHabilitando(false)}
      />

      <ModalCambiarClase
        open={cambiandoClase}
        semana={semanaElegida}
        filtros={filtros}
        claseActual={tabla?.clase_referencia}
        guardando={guardandoClase}
        onConfirmar={(eleccion) => {
          setCambiandoClase(false)
          cambiarClase(eleccion)
        }}
        onCerrar={() => setCambiandoClase(false)}
      />
    </div>
  )
}
