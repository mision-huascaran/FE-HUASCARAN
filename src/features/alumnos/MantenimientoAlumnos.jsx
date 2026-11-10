// Cubre: RF-002, RN-019 · Sección "Alumnos" de la matriz.
//
// Lo usan dos roles con el mismo componente: el Docente, acotado a sus colegios
// y secciones asignadas, y el Supervisor, sobre todos (D1). El recorte real lo
// hace el servidor; aquí solo se evita ofrecer lo que acabaría en 403.
//
// Al crear un alumno el backend crea su expediente en la misma transacción, así
// que aquí no hay una segunda llamada que pudiera quedarse a medias.
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
import Mantenimiento, { avisoSinConexion } from '../../components/mantenimiento/Mantenimiento'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'
import { consultaDetalleColegio } from '../../hooks/consultaColegio'
import ImportarNominaModal from './ImportarNominaModal'
import {
  actualizarAlumno,
  cambiarEstadoAlumno,
  crearAlumno,
  filtrarAlumnos,
  listarAlumnosAdmin,
  listarAsignaciones,
  listarAuditoria,
  listarColegiosAdmin,
  listarGradosAdmin,
  listarProgramasAdmin,
  cambiaDeGrupo,
  fechaDeCreacion,
  obtenerAlumno,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
import { hoy } from '../../lib/relojServidor'
import useConexion from '../../hooks/useConexion'
import useFiltrosGuardados from '../../hooks/useFiltrosGuardados'
import usePrecarga from '../../hooks/usePrecarga'
import useSessionStore from '../../store/sessionStore'
import { alcanceDe } from '../../auth/permisos'
import { ROLES } from '../../auth/roles'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

/**
 * El ciclo y la sección YA NO SE PIDEN.
 *
 * El backend calcula el ciclo a partir del subprograma y el grado
 * (Alfabetización siempre III; Comprensión Lectora: 2.º III, 3.º y 4.º IV,
 * 5.º y 6.º V), y la sección la hereda el alumno de su colegio. Enviarlos
 * sería inventar datos que el servidor va a ignorar o rechazar.
 *
 * Nota histórica: el ciclo EBR se pedía aparte del grado (RN-004) y no se deducía
 * del grado, aunque lo habitual sea que coincidan.
 */
const CICLOS = [
  { value: 1, label: 'III' },
  { value: 2, label: 'IV' },
  { value: 3, label: 'V' },
]

/**
 * El identificador del alumno, venga como venga.
 *
 * El simulador lo llama `id_alumno` y el backend `id`. Leer solo el primero
 * mandaba `PATCH /alumnos/undefined`, que el servidor rechazaba con un 422 y
 * el mensaje "Los datos enviados no son válidos": imposible de relacionar con
 * la causa desde la pantalla.
 */
const idDeAlumno = (alumno) => alumno?.id_alumno ?? alumno?.id


export default function MantenimientoAlumnos() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const soloSusSecciones = alcanceDe('alumnos', idRol) === 'asignado'
  // "Importar nómina" es exclusiva del Supervisor (CU014): la ingesta masiva
  // y las correcciones administrativas son suyas; el Docente ni la ve.
  const esSupervisor = idRol === ROLES.SUPERVISOR
  const [importando, setImportando] = useState(false)

  // CU014: los filtros se guardan en LocalStorage y se borran al cerrar sesión.
  const [filtros, setFiltros] = useFiltrosGuardados('alumnos', { estado: 'activo' })
  // Copia de IndexedDB: sin conexión, la tabla se lee de aquí en solo lectura.
  const precarga = usePrecarga()

  /**
   * D63 — SOLO COLEGIOS ACTIVOS en el filtro.
   *
   * El backend dejó de devolver alumnos de colegios inactivos, así que
   * ofrecer uno inactivo lleva a una lista vacía —no a un error— y el
   * Supervisor no entiende por qué: el colegio está ahí, el filtro responde,
   * y no sale nadie. Se ofrece lo que puede dar resultados.
   */
  const { data: colegiosEnLinea = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'colegios', 'activos'],
    queryFn: async () => (await listarColegiosAdmin({ estado: 'activo' })).items,
    ...SIEMPRE,
    enabled: enLinea,
  })
  const { data: gradosEnLinea = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'grados'], queryFn: listarGradosAdmin, ...SIEMPRE, enabled: enLinea })
  const { data: programas = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'programas'], queryFn: listarProgramasAdmin, ...SIEMPRE, enabled: enLinea })
  const { data: asignacionesEnLinea, isSuccess: asignacionesCargadas } = useQuery({
    queryKey: ['admin', 'asignaciones'],
    queryFn: listarAsignaciones,
    enabled: soloSusSecciones && enLinea,
  })
  const colegios = useMemo(
    () => (colegiosEnLinea.length ? colegiosEnLinea : (precarga?.colegios ?? [])),
    [colegiosEnLinea, precarga],
  )
  const grados = useMemo(
    () => (gradosEnLinea.length ? gradosEnLinea : (precarga?.grados ?? [])),
    [gradosEnLinea, precarga],
  )
  const asignaciones = useMemo(
    () => asignacionesEnLinea ?? precarga?.asignaciones ?? [],
    [asignacionesEnLinea, precarga],
  )

  /**
   * Las SECCIONES de cada grado, que solo trae el detalle del colegio.
   *
   * El listado (`ColegioItem`) no las tiene, y desde T3 `colegio.seccion`
   * desapareció: cada grado tiene las suyas. Se piden los detalles de los
   * colegios que esta persona puede elegir —uno o dos para un Docente, los
   * nueve para el Supervisor—.
   *
   * D110 — Ya no se cachean para siempre: el Supervisor añade secciones desde
   * otro equipo, y con la copia eterna "Nuevo alumno" seguía ofreciendo solo
   * las de antes. Se vuelven a pedir al abrir la pantalla (`consultaColegio`).
   */
  const detalles = useQueries({
    queries: colegios.map((c) => consultaDetalleColegio(c.id_colegio, { enabled: enLinea })),
  })

  const seccionesPorGrado = useMemo(() => {
    const mapa = {}
    for (const { data } of detalles) {
      if (!data) continue
      for (const g of data.grados ?? []) {
        mapa[`${data.id_colegio}|${g.id_grado}`] = g.secciones ?? []
      }
    }
    return mapa
  // `detalles` es un array nuevo en cada render; lo que importa es su contenido.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalles.map((d) => d.data?.id_colegio).join(), detalles.filter((d) => d.data).length])

  const seccionesDe = useCallback(
    (valores) => seccionesPorGrado[`${valores?.id_colegio}|${valores?.id_grado}`] ?? [],
    [seccionesPorGrado],
  )

  /**
   * El Docente solo puede elegir entre lo que tiene asignado: fuera de ahí el
   * servidor responde "no pertenece a un colegio y grado que tengas asignado".
   *
   * `GET /me/asignaciones` las agrupa por colegio y con los grados como
   * objetos, pero `normalizarAsignacion` ya deja la forma plana que se usa
   * aquí: `id_colegio` numérico y `grados` como lista de ids. Hay que leerla
   * así y no del objeto original — `colegio` ya es el NOMBRE, no el id.
   */
  const permitidos = useMemo(() => {
    if (!soloSusSecciones) return { colegios, grados }

    const idsColegio = new Set(asignaciones.map((a) => Number(a.id_colegio)))
    const idsGrado = new Set(asignaciones.flatMap((a) => (a.grados ?? []).map(Number)))

    return {
      colegios: colegios.filter((c) => idsColegio.has(Number(c.id_colegio))),
      grados: grados.filter((g) => idsGrado.has(Number(g.id_grado))),
    }
  }, [soloSusSecciones, asignaciones, colegios, grados])

  /**
   * Los GRADOS que de verdad tiene cada colegio, no todos los que existen.
   *
   * `permitidos.grados` es el catálogo entero (o el del Docente); un colegio
   * nuevo o pequeño no necesariamente lo imparte completo. El detalle del
   * colegio (el mismo que arma `seccionesPorGrado`) ya trae su propia lista
   * de grados, así que de ahí sale el filtro.
   */
  const gradosPorColegio = useMemo(() => {
    const mapa = {}
    for (const { data } of detalles) {
      if (!data) continue
      mapa[data.id_colegio] = new Set((data.grados ?? []).map((g) => Number(g.id_grado)))
    }
    return mapa
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalles.map((d) => d.data?.id_colegio).join(), detalles.filter((d) => d.data).length])

  const gradosDe = useCallback(
    (valores) => {
      const delColegio = gradosPorColegio[valores?.id_colegio]
      if (!delColegio) return []
      return permitidos.grados.filter((g) => delColegio.has(Number(g.id_grado)))
    },
    [gradosPorColegio, permitidos.grados],
  )

  const opciones = (lista, clave) => lista.map((x) => ({ value: x[clave], label: x.nombre }))

  /**
   * Semana 14 — el alumno con la PERTENENCIA PENDIENTE: el que todavía no
   * tiene ningún intervalo en su historial (de una importación, o de antes de
   * que el backend modelara la pertenencia). `registro.pertenencia_pendiente`
   * es la señal del backend; se respalda con la señal antigua (activo y sin
   * `pertenece_desde`) por si llegara un registro de un origen que todavía no
   * la manda.
   */
  const esPendiente = (registro) =>
    Boolean(registro?.pertenencia_pendiente) || (registro?.activo !== false && !registro?.pertenece_desde)

  /** ¿Se EDITA a un pendiente? Solo entonces el grupo deja de ser obligatorio de entrada. */
  const editandoPendiente = ({ modo, registro, detalleListo } = {}) =>
    modo === 'editar' && detalleListo && esPendiente(registro)

  /**
   * Con un pendiente, el grupo (grado, subprograma, sección) solo se exige
   * COMPLETO si se informó el subprograma o la sección — el grado puede venir
   * prellenado de la nómina sin que eso obligue a completar el resto (CU014).
   */
  const grupoDebeCompletarse = (valores) => Boolean(valores?.id_programa || valores?.id_seccion)
  const grupoCompleto = (valores) => Boolean(valores?.id_grado && valores?.id_programa && valores?.id_seccion)

  /**
   * Los campos del popup, memorizados.
   *
   * Iban en línea, así que eran un array NUEVO en cada render, y el popup se
   * repoblaba a mitad de escritura: al terminar la precarga de una actividad o
   * tras inactivar a alguien, lo tecleado desaparecía. El popup ya no depende
   * de la identidad de este array, pero memorizarlo evita además rehacer el
   * formulario entero cada vez que la tabla se refresca.
   */
  const campos = useMemo(
    () => [
      { nombre: 'nombres', etiqueta: 'Nombres', requerido: true },
      { nombre: 'apellidos', etiqueta: 'Apellidos', requerido: true },
      /**
       * DNI opcional (semana 14): 8 dígitos exactos cuando se informa, único
       * entre alumnos (el backend lo rechaza con 409 `dni_duplicado`, que
       * `conDniLegible` convierte en un error de este campo). Vacío no es un
       * error: muchos alumnos —y todos los recién importados— no lo tienen.
       */
      {
        nombre: 'dni',
        etiqueta: 'DNI',
        placeholder: '8 dígitos',
        validar: (v) => (/^\d{8}$/.test(String(v ?? '').trim()) ? null : 'El DNI debe tener exactamente 8 dígitos.'),
      },
      {
        nombre: 'id_colegio',
        etiqueta: 'Colegio',
        tipo: 'select',
        requerido: true,
        // Con una sola opción no hay nada que elegir (U27).
        unicaPorDefecto: true,
        opciones: opciones(permitidos.colegios, 'id_colegio'),
      },
      {
        nombre: 'id_grado',
        etiqueta: 'Grado',
        tipo: 'select',
        /**
         * Con un pendiente, el grado NO es obligatorio de entrada —puede venir
         * ya puesto desde la nómina, o quedarse vacío—, pero se vuelve
         * obligatorio en cuanto se informa el subprograma o la sección: el
         * backend exige el grupo completo o ninguno (semana 14).
         */
        requerido: (valores, contexto) => !editandoPendiente(contexto) || grupoDebeCompletarse(valores),
        // Con una sola opción no hay nada que elegir (U27).
        unicaPorDefecto: true,
        // Solo los grados que el colegio elegido de verdad tiene, no el
        // catálogo entero: un colegio no ofrece necesariamente los seis.
        opciones: (valores) => opciones(gradosDe(valores), 'id_grado'),
        ayuda: 'Los que tiene el colegio elegido',
      },
      /**
       * LA SECCIÓN SE ELIGE. Dejó de ser un atributo heredado del colegio
       * cuando T3 la convirtió en entidad por grado: un grado nace con
       * "Única", pero el Supervisor puede añadir más.
       *
       * Con una sola, el desplegable la deja puesta y no hay nada que decidir.
       * Con varias es obligatoria, y si no se manda el servidor responde 422.
       */
      {
        nombre: 'id_seccion',
        etiqueta: 'Sección',
        tipo: 'select',
        /**
         * Normalmente NO es obligatoria aquí: con una sola, el servidor la
         * asigna igual aunque no se mande, y decide por su cuenta si hace
         * falta con varias. Con un pendiente es distinto: en cuanto se
         * informa el subprograma o la propia sección, el grupo tiene que
         * quedar completo (semana 14).
         */
        requerido: (valores, contexto) => editandoPendiente(contexto) && grupoDebeCompletarse(valores),
        unicaPorDefecto: true,
        opciones: (valores) =>
          seccionesDe(valores).map((x) => ({ value: String(x.id), label: x.nombre })),
        ayuda: 'Las del colegio y grado elegidos',
      },
      {
        nombre: 'ciclo',
        etiqueta: 'Ciclo',
        soloLectura: true,
        ayuda: 'Lo calcula el sistema según el subprograma y el grado',
      },
      {
        nombre: 'id_programa',
        etiqueta: 'Subprograma',
        tipo: 'select',
        // Misma regla que el grado: obligatorio salvo con un pendiente que
        // todavía no informó ni el subprograma ni la sección (semana 14).
        requerido: (valores, contexto) => !editandoPendiente(contexto) || grupoDebeCompletarse(valores),
        // Con una sola opción no hay nada que elegir (U27).
        unicaPorDefecto: true,
        opciones: opciones(programas, 'id_programa'),
      },
      /**
       * DESDE CUÁNDO pertenece al grupo. Es lo que sostiene el historial de
       * pertenencia: sin esa fecha no se puede saber quién estaba en un aula
       * el día de una clase, y de eso dependen las tablas históricas de
       * Lectura, Rúbrica y Registro de Vuelo.
       *
       * El tope es hoy según el reloj del SERVIDOR, no el del equipo: una
       * fecha futura la rechaza el backend con "Selecciona la fecha de hoy o
       * una fecha anterior."
       */
      {
        nombre: 'pertenece_desde',
        etiqueta: 'Pertenece al grupo desde',
        tipo: 'fecha',
        /**
         * Al crear, siempre obligatoria. Al editar a un pendiente (el campo
         * solo se ve en ese caso, ver `visible`), solo cuando el grupo ya
         * quedó completo: pedirla antes sería forzar una fecha para un grupo
         * que todavía no existe (semana 14, "Con pertenece_desde solo…").
         */
        requerido: (valores, { modo } = {}) => modo === 'nuevo' || grupoCompleto(valores),
        max: hoy(),
        /**
         * D65 — SE PIDE TAMBIÉN AL EDITAR si al alumno le falta.
         *
         * Al crear siempre; al editar, solo cuando el alumno está activo y no
         * tiene intervalo de pertenencia (un pendiente, por importación o por
         * ser de antes de que el backend modelara el historial): sin esa
         * fecha no se sabe quién estaba en el aula el día de una clase, y el
         * alumno se cae de las tablas históricas de Lectura, Rúbrica y
         * Registro de Vuelo. El formulario es el único sitio donde se puede
         * arreglar.
         *
         * Con el alumno INACTIVO no se pregunta: ahí no hay grupo en curso, y
         * volver a uno es justo lo que hace "Activar" con su fecha efectiva.
         * Pedirlo en los dos sitios daría dos fechas para un mismo hecho.
         */
        visible: (valores, { modo, registro, detalleListo } = {}) =>
          modo === 'nuevo' || (modo === 'editar' && detalleListo && registro?.activo !== false && esPendiente(registro)),
        // La fecha propuesta es la de creación del alumno, que es la única
        // fecha que se sabe cierta; sin ella —un importado no trae
        // `fecha_registro` propia, por ejemplo— se propone hoy, tal como pide
        // CU014 ("en caso contrario, propone la fecha actual").
        porDefecto: (registro) => fechaDeCreacion(registro) || hoy(),
        ayuda: 'Desde qué día está en este colegio, grado y sección',
      },
      /**
       * MOVER DE GRUPO exige decir desde cuándo; corregir una tilde, no.
       *
       * Por eso el campo no está siempre: aparece solo cuando alguno de los
       * cuatro campos que forman el grupo —colegio, grado, sección,
       * subprograma— es distinto del que tenía el alumno al abrir. Si se pone
       * siempre, se acaba rellenando con hoy por inercia y el historial queda
       * con fechas que no pasaron.
       *
       * El mínimo es el inicio de su grupo actual, que llega en el detalle: el
       * backend rechaza una fecha anterior con "ese día empezó su grupo
       * actual". Si el detalle aún no cargó, se deja al servidor validarlo.
       */
      {
        nombre: 'cambio_grupo_desde',
        etiqueta: 'Cambia de grupo desde',
        tipo: 'fecha',
        requerido: true,
        soloEn: 'editar',
        max: hoy(),
        min: (valores) => valores?.pertenece_desde || undefined,
        /**
         * NO SE PIDE JUNTO A "Pertenece al grupo desde" (tanda L1).
         *
         * A un alumno sin pertenencia se le pregunta desde cuándo pertenece, y
         * con esa fecha el backend abre el intervalo **con el grupo final**.
         * Pedir además la del cambio sería pedir dos fechas para el mismo
         * hecho, y el servidor rechaza que viajen las dos.
         */
        visible: (valores, { modo, registro, detalleListo } = {}) => {
          const sinPertenencia = modo === 'editar' && detalleListo && registro?.activo !== false && esPendiente(registro)
          return !sinPertenencia && cambiaDeGrupo(registro, valores)
        },
        ayuda: 'Desde qué día pertenece a su nuevo grupo',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [permitidos.colegios, permitidos.grados, programas, seccionesDe, gradosDe],
  )

  const consulta = useQuery({
    queryKey: ['alumnos', 'mantenimiento', filtros, enLinea, Boolean(precarga)],
    queryFn: async () => {
      // CU014 sin conexión: la tabla en solo lectura desde IndexedDB. Antes se
      // pedía igual al servidor, fallaba, y la tabla quedaba en "Sin registros"
      // aunque los alumnos estuvieran descargados.
      if (!enLinea) return filtrarAlumnos(precarga?.alumnos ?? [], filtros)
      return (await listarAlumnosAdmin(filtros)).items
    },
    /**
     * D61 — SIN ESTO, TANSTACK QUERY PAUSA LA CONSULTA ÉL SOLO.
     *
     * Al perder la conexión el `queryKey` cambia (lleva `enLinea`) y arranca
     * una consulta NUEVA; con el `networkMode` de por defecto ('online'),
     * TanStack Query ve el navegador sin red y la deja en pausa SIN LLEGAR A
     * LLAMAR a `queryFn`, así que la rama de arriba nunca corre y la pantalla
     * se queda cargando hasta reconectar. Aquí el "sin conexión" ya lo decide
     * `enLinea`, a mano: no hace falta que la librería también lo decida.
     */
    networkMode: 'always',
  })

  const sinAsignaciones = soloSusSecciones && enLinea && asignacionesCargadas && asignaciones.length === 0

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['alumnos'] })
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) =>
      popup.modo === 'nuevo' ? crearAlumno(valores) : actualizarAlumno(idDeAlumno(popup.registro), valores),
    onSuccess: (_d, { popup }) => {
      refrescar()
      toast.success(
        popup.modo === 'nuevo' ? 'Alumno registrado' : 'Alumno actualizado',
        popup.modo === 'nuevo' ? 'Se creó su expediente automáticamente.' : undefined,
      )
    },
    onError: (error) => toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  const estado = useMutation({
    // La baja lógica tiene ruta propia (`/desactivar`, `/activar`), como en
    // Colegios: un PATCH con `{activo}` no cambia el estado.
    mutationFn: ({ alumno, activo, fecha }) =>
      cambiarEstadoAlumno(idDeAlumno(alumno), activo, {
        aplicarDesde: fecha,
        // Semana 14: un pendiente no tiene grupo en curso, así que el cuerpo
        // va vacío en vez de con una fecha que no significa nada para él.
        pendiente: esPendiente(alumno),
      }),
    onSuccess: (_d, { activo }) => {
      refrescar()
      toast.success(activo ? 'Alumno activado' : 'Alumno inactivado', 'Su historial académico se conserva.')
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', mensajeDeError(error)),
  })

  return (
    <>
      <Mantenimiento
        seccion="alumnos"
        entidad="alumno"
        titulo="Alumnos"
        consulta={consulta}
        guardando={guardado.isPending}
        // D8: la LISTA se lee de la caché sin conexión; lo que exige red es crear
        // y editar, para no generar ids en conflicto. Por eso no va `soloOnline`.
        sinConexion={!enLinea}
        // CU014 — "Importar nómina", junto a "Agregar", solo para el
        // Supervisor. Exclusivamente en línea, igual que crear y editar.
        accionesExtra={
          esSupervisor ? (
            <Button
              variant="outline"
              iconLeft={Upload}
              disabled={!enLinea}
              title={!enLinea ? avisoSinConexion('alumnos') : undefined}
              onClick={() => setImportando(true)}
            >
              Importar nómina
            </Button>
          ) : null
        }
        motivoSinNuevo={sinAsignaciones ? 'No tiene asignaciones activas: no hay colegio ni grado en los que registrar alumnos.' : null}
        valoresFiltro={filtros}
        onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
        cargarAuditoria={(id) => listarAuditoria('alumno', id)}
        // `mutateAsync` y no `mutate`: la plantilla cierra el popup solo si la
        // promesa se resuelve, y lo deja abierto con los datos si falla.
        onGuardar={(valores, popup) => guardado.mutateAsync({ valores, popup })}
        // El detalle trae `pertenece_desde`, que es el mínimo de la fecha de
        // cambio de grupo. El popup lo pide al abrirse.
        cargarDetalle={obtenerAlumno}
        onCambiarEstado={(alumno, activo, fecha) => estado.mutate({ alumno, activo, fecha })}
        /**
         * Alumnos es la única sección que pregunta DESDE CUÁNDO. El backend lo
         * exige —sin cuerpo responde 422— porque de esa fecha depende el
         * historial de pertenencia, y de él, quién aparece en cada tabla
         * histórica de Lectura, Rúbrica y Registro de Vuelo.
         */
        fechaEfectiva={{
          etiqueta: 'Fecha efectiva',
          ayuda: 'Desde qué día aplica el cambio, que puede no ser hoy',
        }}
        filtros={[
          { nombre: 'q', tipo: 'busqueda', etiqueta: 'Buscar', placeholder: 'Nombre o código' },
          { nombre: 'id_colegio', etiqueta: 'Colegio', opciones: opciones(permitidos.colegios, 'id_colegio') },
          { nombre: 'id_grado', etiqueta: 'Grado', opciones: opciones(permitidos.grados, 'id_grado') },
          { nombre: 'id_ciclo', etiqueta: 'Ciclo', opciones: CICLOS },
          { nombre: 'id_programa', etiqueta: 'Subprograma', opciones: opciones(programas, 'id_programa') },
          // Semana 14 — "Definida" o "Pendiente": quién tiene ya un intervalo
          // en su historial de pertenencia y quién todavía no (un importado
          // sin completar, por ejemplo).
          {
            nombre: 'pertenencia',
            etiqueta: 'Pertenencia',
            opciones: [
              { value: 'definida', label: 'Definida' },
              { value: 'pendiente', label: 'Pendiente' },
            ],
          },
        ]}
        campos={campos}
        columnas={[
          {
            key: 'nombre',
            header: 'Alumno',
            sortable: true,
            className: 'font-medium text-ink-900',
            /**
             * CU014/CU015: el NOMBRE abre el detalle del alumno (resumen,
             * lectura, rúbrica y vuelo). Antes era un "Ver detalle" en una
             * columna aparte, junto al "Ver" de Acciones: dos accesos con casi
             * el mismo nombre en la misma fila (auditoría de UX #737, U06).
             */
            render: (a) => (
              <>
                <Link
                  to={`/estudiantes/${idDeAlumno(a)}`}
                  title="Ver detalle del alumno"
                  className="font-semibold text-brand-700 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {a.nombre}
                </Link>
                {/* Semana 14: el que todavía no tiene ningún intervalo de
                    pertenencia, para que se note sin tener que abrirlo. */}
                {a.pertenencia_pendiente && (
                  <Badge tone="warning" className="ml-2 align-middle">
                    Pertenencia pendiente
                  </Badge>
                )}
              </>
            ),
          },
          // El "–" cuando no tiene DNI lo pone `etiquetaDe` (CU014).
          { key: 'dni', header: 'DNI', align: 'center', sortable: true, render: (a) => etiquetaDe(a.dni) },
          /**
           * `sortValue` en TODAS las que se ordenan, y no es opcional: estos
           * campos llegan como texto desde el simulador y como objeto
           * `{id, nombre}` desde el backend. La tabla ordena por `row[key]`, así
           * que sin esto comparaba objetos entre sí y el clic en la cabecera no
           * hacía nada. `etiquetaDe` resuelve las dos formas.
           */
          {
            key: 'colegio',
            header: 'Colegio',
            sortable: true,
            sortValue: (a) => etiquetaDe(a.colegio),
            render: (a) => etiquetaDe(a.colegio),
          },
          {
            key: 'grado',
            header: 'Grado',
            align: 'center',
            sortable: true,
            // Por número, no por texto: por orden alfabético "10.º" iría antes
            // que "2.º". Hoy solo hay seis grados, pero el criterio es el mismo.
            sortValue: (a) => Number(String(etiquetaDe(a.grado)).replace(/\D/g, '')) || 0,
            render: (a) => etiquetaDe(a.grado),
          },
          {
            key: 'seccion',
            header: 'Sección',
            align: 'center',
            sortable: true,
            sortValue: (a) => etiquetaDe(a.seccion),
            render: (a) => etiquetaDe(a.seccion),
          },
          {
            key: 'programa',
            header: 'Subprograma',
            sortable: true,
            sortValue: (a) => etiquetaDe(a.programa ?? a.subprograma),
            render: (a) => etiquetaDe(a.programa ?? a.subprograma),
          },
        ]}
      />
      {esSupervisor && (
        <ImportarNominaModal open={importando} onClose={() => setImportando(false)} onImportado={refrescar} />
      )}
    </>
  )
}
