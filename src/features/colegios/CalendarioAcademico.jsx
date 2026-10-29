// CU027 — Calendario académico. Vista interna del módulo de Colegios.
//
// No es una ruta: reemplaza el listado en el área principal y conserva el
// sidebar, igual que el detalle del Docente. "Volver a Colegios" devuelve con
// los filtros y la página intactos, que es la razón de que esto sea estado de
// la pantalla y no una navegación.
//
// LO QUE SE CONFIGURA AQUÍ sostiene medio sistema: de estas fechas salen el
// periodo de cada colegio, qué día es lectivo, cuándo una asignación es
// retroactiva y qué periodos admiten un permiso excepcional. Por eso el
// servidor avisa cuando un cambio dejaría registros ya guardados fuera de su
// periodo —`calendario_incompatible`—, y por eso ese aviso se muestra entero
// en vez de resumirlo en un "no se pudo guardar".
//
// TRES ESTADOS, NO TRES BOTONES A LA VEZ: consulta, creación y edición. El CU
// lo pide expresamente ("no aparecen todos simultáneamente"), y tiene sentido:
// con los cuatro visibles nadie sabe en cuál está.
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { ahora } from '../../lib/relojServidor'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import {
  actualizarCalendario,
  crearCalendarioGeneral,
  crearCalendarioParticular,
  esPeriodoActual,
  nombreDePeriodo,
  obtenerCalendario,
  ochoPeriodos,
  textoDePeriodoActual,
  volverAlGeneral,
} from '../../api/resources/calendarios'
import {
  ModalConfirmarActualizacion,
  ModalDescartarCambios,
  ModalUsarGeneral,
  ModalVersionActual,
} from './ModalesDelCalendario'
import useFiltrosGuardados from '../../hooks/useFiltrosGuardados'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { erroresDeCampo, mensajeDeError, motivoDe } from '../../api/client'
import { formatearFecha } from '../../lib/format'
import useConexion from '../../hooks/useConexion'

const ALCANCES = [
  { value: 'general', label: 'General' },
  { value: 'colegio', label: 'Por colegio' },
]

/** Las ocho filas vacías, para empezar a crear uno desde cero. */
const periodosVacios = () => ochoPeriodos([])

/** Solo lo que el contrato acepta de cada periodo. */
const periodosParaGuardar = (periodos) =>
  periodos.map(({ tipo, numero, fecha_inicio, fecha_fin }) => ({ tipo, numero, fecha_inicio, fecha_fin }))

/** Las ocho fechas, completas, y cada día no lectivo con su motivo: un periodo a medias no es un calendario. */
const estaCompleto = (periodos, dias) =>
  periodos.every((p) => p.fecha_inicio && p.fecha_fin) && dias.every((d) => d.motivo?.trim())

/** Lo que se edita al empezar: vacío para crear, lo vigente para editar. */
function borradorPara(modo, calendario) {
  if (modo === 'crear') return { periodos: periodosVacios(), dias: [] }
  return { periodos: ochoPeriodos(calendario?.periodos), dias: calendario?.dias_no_lectivos ?? [] }
}

export default function CalendarioAcademico({ colegios = [], onVolver }) {
  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()

  /**
   * Los filtros se guardan y se restauran (CU027, D70).
   *
   * Volver al calendario y encontrarlo en "General" del año vigente cuando se
   * estaba mirando un colegio concreto obliga a rehacer la selección cada vez.
   */
  const [filtros, setFiltros] = useFiltrosGuardados('calendario', {
    alcance: 'general',
    idColegio: '',
    anio: '',
  })
  const { alcance, idColegio, anio } = filtros
  const cambiarFiltro = (cambio) => setFiltros((previos) => ({ ...previos, ...cambio }))
  const setAlcance = (valor) => cambiarFiltro({ alcance: valor, idColegio: '' })
  const setIdColegio = (valor) => cambiarFiltro({ idColegio: valor })
  const setAnio = (valor) => cambiarFiltro({ anio: valor })

  const [modo, setModo] = useState('consulta')
  const [periodos, setPeriodos] = useState(periodosVacios)
  const [dias, setDias] = useState([])
  /** Con lo que se entró a editar, para saber si algo cambió de verdad (D84). */
  const [borradorOriginal, setBorradorOriginal] = useState(null)
  const [incompatibilidades, setIncompatibilidades] = useState([])
  /** Mensajes del 422 por campo: cada uno va junto al suyo (D74). */
  const [erroresCampo, setErroresCampo] = useState({})
  /** Cuál de los modales está abierto, o `null`. */
  const [confirmando, setConfirmando] = useState(null)
  /** Otro Supervisor guardó entre medias: hasta resolverlo no se guarda (D75). */
  const [conflicto, setConflicto] = useState(false)
  /** Se envió y no se supo el resultado: no se reintenta a ciegas. */
  const [sinConfirmar, setSinConfirmar] = useState(false)

  const { data: anios = [] } = useQuery({
    queryKey: ['catalogo', 'anios-escolares'],
    queryFn: listarAniosEscolares,
    staleTime: Infinity,
  })

  /**
   * EL FILTRO ES UN AÑO CALENDARIO, NO UN AÑO ESCOLAR YA CREADO (D81, tanda C1).
   *
   * Era una lista de los años escolares existentes, así que **el año siguiente
   * no se podía elegir** y no había forma de crear su calendario desde la
   * pantalla: para configurar 2027 hacía falta que 2027 ya existiera, y lo que
   * lo crea es justo este formulario.
   *
   * Se ofrecen los años con calendario más el siguiente al último. Elegir uno
   * **no crea nada**: si no existe, el GET responde 404 y la pantalla ofrece
   * "Crear calendario", que es lo que lo crea todo de una vez (tanda C2).
   */
  const aniosOfrecidos = useMemo(() => {
    const existentes = anios
      .map((a) => /\d{4}/.exec(String(a.nombre ?? ''))?.[0])
      .filter(Boolean)
      .map(Number)
    const base = existentes.length ? existentes : [ahora().getFullYear()]
    const siguiente = Math.max(...base) + 1
    return [...new Set([...base, siguiente])].sort((a, b) => b - a).map(String)
  }, [anios])

  // El año arranca en el vigente. CU027: se inicializa con el año actual.
  useEffect(() => {
    if (anio || !anios.length) return
    const vigente = anioVigente(anios)?.nombre
    const propuesto = /\d{4}/.exec(String(vigente ?? ''))?.[0] ?? aniosOfrecidos[0]
    if (propuesto) setAnio(String(propuesto))
  }, [anios, anio, aniosOfrecidos])

  const porColegio = alcance === 'colegio'
  const colegioConsultado = porColegio ? idColegio : undefined
  const listo = Boolean(anio) && (!porColegio || Boolean(idColegio))

  const consulta = useQuery({
    queryKey: ['calendario', anio, colegioConsultado ?? null],
    // Por AÑO CALENDARIO: así se puede consultar uno que todavía no existe y
    // recibir el 404 que ofrece crearlo.
    queryFn: () => obtenerCalendario({ anio, idColegio: colegioConsultado }),
    enabled: listo && modo === 'consulta',
    retry: false,
  })

  const calendario = consulta.data
  // Un 404 NO es un fallo: es "este año todavía no tiene calendario".
  const sinConfigurar = motivoDe(consulta.error) === 'calendario_no_configurado'

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['calendario'] })

  const alFallar = (error) => {
    setConfirmando(null)

    /**
     * Sin respuesta NO se reintenta (CU027).
     *
     * La solicitud pudo llegar y aplicarse: volver a mandarla escribiría dos
     * veces. Se bloquea "Guardar" hasta comprobar con el servidor qué pasó.
     */
    if (!error?.response) {
      setSinConfirmar(true)
      return
    }

    /**
     * 409 `modificacion_concurrente`: otro Supervisor guardó mientras este
     * editaba. No se combina ni se sobrescribe: se bloquea el guardado y se
     * ofrece ver qué hay (D75).
     */
    if (motivoDe(error) === 'modificacion_concurrente') {
      setConflicto(true)
      return
    }

    // `calendario_incompatible` trae la lista de qué registros estorban. Es
    // una decisión que tomar, no un error que descartar: se muestra entera.
    setIncompatibilidades(error?.response?.data?.incompatibilidades ?? [])

    // Cada mensaje de validación junto a su campo, sin prefijo (D74).
    const porCampo = erroresDeCampo(error)
    setErroresCampo(porCampo)
    if (!Object.keys(porCampo).length) {
      toast.error('No se pudo guardar el calendario', mensajeDeError(error))
    }
  }

  /**
   * El texto de éxito es el de CU027, PALABRA POR PALABRA.
   *
   * Antes decía "Calendario creado" + "Las fechas ya rigen para los módulos
   * que dependen de ellas.", que suena bien pero se lo inventó el front: el
   * backend no manda texto de éxito y el caso de uso sí lo da. El probador lo
   * compara carácter a carácter (D62).
   */
  const alGuardar = (mensaje) => () => {
    setIncompatibilidades([])
    setErroresCampo({})
    setConfirmando(null)
    setConflicto(false)
    setSinConfirmar(false)
    setModo('consulta')
    refrescar()
    toast.success(mensaje)
  }

  const crear = useMutation({
    mutationFn: () => {
      /**
       * Se manda `anio`, no `id_anio_escolar` (tanda C2).
       *
       * Con él el backend crea el año escolar en la MISMA transacción: o queda
       * el año con su calendario, o no queda nada. El contrato exige
       * exactamente uno de los dos campos.
       */
      const cuerpo = { anio: Number(anio), periodos: periodosParaGuardar(periodos), dias_no_lectivos: dias }
      return porColegio
        ? crearCalendarioParticular({ ...cuerpo, id_colegio: Number(idColegio) })
        : crearCalendarioGeneral(cuerpo)
    },
    onSuccess: alGuardar('Calendario académico creado correctamente.'),
    onError: alFallar,
  })

  const editar = useMutation({
    mutationFn: () =>
      actualizarCalendario(calendario.id_calendario, {
        // La versión que se leyó: si otro la cambió, el servidor responde 409
        // en vez de dejar que este guardado pise el ajeno sin enterarse.
        version: calendario.version,
        periodos: periodosParaGuardar(periodos),
        dias_no_lectivos: dias,
      }),
    onSuccess: alGuardar('Calendario académico actualizado correctamente.'),
    onError: alFallar,
  })

  const restablecer = useMutation({
    mutationFn: () => volverAlGeneral(calendario.id_calendario, calendario.version),
    onSuccess: alGuardar('Calendario académico actualizado correctamente.'),
    onError: alFallar,
  })

  const empezar = (siguiente) => {
    /**
     * D73 — Las fechas particulares NO empiezan vacías.
     *
     * Se precargan con las del calendario general, que es sobre lo que se
     * ajusta: un colegio que empieza una semana más tarde cambia dos fechas,
     * no las dieciséis. Antes había que reescribirlas todas.
     */
    const particularNuevo = siguiente === 'crear' && porColegio && calendario
    const borrador = particularNuevo ? borradorPara('editar', calendario) : borradorPara(siguiente, calendario)

    setIncompatibilidades([])
    setErroresCampo({})
    setConflicto(false)
    setSinConfirmar(false)
    setPeriodos(borrador.periodos)
    setDias(borrador.dias)
    // D84 — Con qué comparar para saber si de verdad se tocó algo.
    setBorradorOriginal(borrador)
    setModo(siguiente)
  }

  /** Vuelve a consulta descartando lo escrito. */
  const descartar = () => {
    setConfirmando(null)
    setConflicto(false)
    setSinConfirmar(false)
    setErroresCampo({})
    setModo('consulta')
  }

  /**
   * ¿SE TOCÓ ALGO? (D84)
   *
   * Antes bastaba con estar en modo edición para preguntar "¿descartar
   * cambios?", así que entrar a editar y arrepentirse sin escribir nada ya
   * pedía confirmación. Una confirmación que no protege nada entrena a
   * pulsarla sin leerla, y así deja de proteger el caso en que sí importa.
   *
   * Se compara contra el borrador con el que se entró, no contra el
   * calendario: en "Crear fechas particulares" el borrador ya viene precargado
   * con el general (D73) y eso no es un cambio del Supervisor.
   */
  const hayCambios = () =>
    JSON.stringify({ periodos, dias }) !== JSON.stringify(borradorOriginal ?? { periodos, dias })

  /** Cancelar o salir: si hay algo escrito, se pregunta antes (D72). */
  const salir = (accion) => {
    if (modo === 'consulta' || !hayCambios()) {
      accion()
      return
    }
    setConfirmando({ tipo: 'descartar', accion })
  }

  /** Guardar: crear va directo; editar el GENERAL pasa por confirmación. */
  const pedirGuardar = () => {
    if (modo === 'editar' && !porColegio) {
      setConfirmando({ tipo: 'actualizar' })
      return
    }
    ejecutarGuardado()
  }

  const ejecutarGuardado = () => (modo === 'crear' ? crear.mutate() : editar.mutate())

  const editando = modo !== 'consulta'

  const ponerFecha = (i, campo, valor) =>
    setPeriodos((previos) => previos.map((p, n) => (n === i ? { ...p, [campo]: valor } : p)))

  return (
    <div className="flex flex-col gap-5">
      {/* Salir con cambios sin guardar pregunta antes: el calendario no se
          encola ni se guarda en localStorage, así que lo escrito se pierde. */}
      <Button variant="ghost" iconLeft={ArrowLeft} onClick={() => salir(onVolver)} className="self-start">
        Volver a Colegios
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Calendario académico</h1>
          <p className="mt-1 text-sm text-ink-500">
            Los cuatro periodos del año y sus recesos. De estas fechas dependen las asistencias, las
            asignaciones y los permisos de corrección.
          </p>
        </div>

        <AccionesDelCalendario
          modo={modo}
          calendario={calendario}
          sinConfigurar={sinConfigurar}
          porColegio={porColegio}
          enLinea={enLinea}
          restableciendo={restablecer.isPending}
          guardando={crear.isPending || editar.isPending}
          // Con un conflicto o un envío sin confirmar, "Guardar" se bloquea:
          // volver a mandarlo pisaría lo ajeno o escribiría dos veces (D75).
          completo={estaCompleto(periodos, dias) && !conflicto && !sinConfirmar}
          onEmpezar={empezar}
          onRestablecer={() => setConfirmando({ tipo: 'usarGeneral' })}
          onCancelar={() => salir(descartar)}
          onGuardar={pedirGuardar}
        />
      </header>

      {!enLinea && (
        <p className="rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700">
          Sin conexión. Estás consultando la última versión guardada del calendario. Conéctate a Internet para
          gestionar el calendario.
        </p>
      )}

      {/*
        D75 — Otro Supervisor guardó mientras este editaba. No se combina ni
        se sobrescribe: se bloquea el guardado y se ofrece ver qué hay.
      */}
      {conflicto && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700"
        >
          <span>El calendario fue modificado por otro Supervisor. Consulta la versión actual antes de volver a guardar.</span>
          <Button size="sm" variant="outline" onClick={() => setConfirmando({ tipo: 'versionActual' })}>
            Consultar versión actual
          </Button>
        </div>
      )}

      {sinConfirmar && (
        <p role="alert" className="rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700">
          No se pudo confirmar el guardado. Se verificará el calendario al recuperar la comunicación con el servidor.
        </p>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[150px] flex-1 basis-[150px]">
            <Select
              label="Año escolar"
              value={anio}
              // En creación queda fijo: cambiarlo a medias dejaría las fechas
              // escritas colgando de otro año (CU027).
              disabled={editando}
              options={aniosOfrecidos.map((a) => ({ value: a, label: a }))}
              onChange={(e) => setAnio(e.target.value)}
            />
          </div>
          <div className="min-w-[150px] flex-1 basis-[150px]">
            <Select
              label="Alcance"
              value={alcance}
              disabled={editando}
              options={ALCANCES}
              onChange={(e) => {
                setAlcance(e.target.value)
                setIdColegio('')
              }}
            />
          </div>
          {porColegio && (
            <div className="min-w-[150px] flex-1 basis-[150px]">
              <Select
                label="Colegio"
                required
                placeholder="Seleccione"
                value={idColegio}
                disabled={editando}
                options={colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre }))}
                onChange={(e) => setIdColegio(e.target.value)}
              />
            </div>
          )}
        </div>

        {/*
          D70 — En qué periodo estamos HOY, con sus fechas completas.
          "Receso posterior al cuarto periodo: 21/12/2026 al 15/02/2027", no
          "PR4": el código no significa nada para quien lo lee, y un receso
          que cruza al año siguiente confunde si no se ven las dos fechas.
        */}
        {listo && !sinConfigurar && (
          <p className="border-b border-line px-4 py-2 text-sm text-ink-500">
            {textoDePeriodoActual(calendario?.periodo_actual)}
          </p>
        )}

        <ContenidoDelCalendario
          listo={listo}
          cargando={consulta.isLoading}
          sinConfigurar={sinConfigurar}
          editando={editando}
          porColegio={porColegio}
          calendario={calendario}
          incompatibilidades={incompatibilidades}
          filas={editando ? periodos : ochoPeriodos(calendario?.periodos)}
          dias={editando ? dias : (calendario?.dias_no_lectivos ?? [])}
          onFecha={ponerFecha}
          onDias={setDias}
          erroresCampo={erroresCampo}
          periodoActual={calendario?.periodo_actual}
          onIrAlGeneral={() => setAlcance('general')}
        />
      </Card>

      <ModalConfirmarActualizacion
        open={confirmando?.tipo === 'actualizar'}
        guardando={editar.isPending}
        onConfirmar={ejecutarGuardado}
        onSeguirEditando={() => setConfirmando(null)}
      />

      <ModalUsarGeneral
        open={confirmando?.tipo === 'usarGeneral'}
        colegio={colegios.find((c) => String(c.id_colegio) === String(idColegio))?.nombre}
        anio={anio}
        procesando={restablecer.isPending}
        onConfirmar={() => restablecer.mutate()}
        onCancelar={() => setConfirmando(null)}
      />

      <ModalDescartarCambios
        open={confirmando?.tipo === 'descartar'}
        onSeguirEditando={() => setConfirmando(null)}
        onDescartar={() => {
          const accion = confirmando?.accion
          descartar()
          accion?.()
        }}
      />

      <ModalVersionActual
        open={confirmando?.tipo === 'versionActual'}
        calendario={consulta.data}
        onCerrar={() => setConfirmando(null)}
        onCargar={() => {
          // Cargar lo del servidor DESCARTA la propuesta: son dos versiones y
          // el sistema no combina ninguna por su cuenta.
          setConfirmando(null)
          descartar()
          refrescar()
        }}
      />
    </div>
  )
}

/**
 * TRES ESTADOS, NO TRES BOTONES A LA VEZ: en consulta, editar, crear o volver
 * al general según lo que haya; en edición, solo cancelar y guardar.
 */
function AccionesDelCalendario({
  modo,
  calendario,
  sinConfigurar,
  porColegio,
  enLinea,
  restableciendo,
  guardando,
  completo,
  onEmpezar,
  onRestablecer,
  onCancelar,
  onGuardar,
}) {
  if (modo !== 'consulta') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button loading={guardando} disabled={!completo} onClick={onGuardar}>
          Guardar
        </Button>
      </div>
    )
  }

  const origen = calendario?.origen
  const puedeCrear = sinConfigurar || (porColegio && origen === 'general')
  return (
    <div className="flex flex-wrap items-center gap-2">
      {calendario && (
        <Button iconLeft={CalendarDays} disabled={!enLinea} onClick={() => onEmpezar('editar')}>
          Editar calendario
        </Button>
      )}
      {puedeCrear && (
        <Button iconLeft={Plus} disabled={!enLinea} onClick={() => onEmpezar('crear')}>
          {porColegio ? 'Crear fechas particulares' : 'Crear calendario'}
        </Button>
      )}
      {/* Volver al general solo tiene sentido si hoy usa uno particular. */}
      {porColegio && origen === 'particular' && (
        <Button variant="outline" loading={restableciendo} onClick={onRestablecer}>
          Usar el calendario general
        </Button>
      )}
    </div>
  )
}

/** Lo que va debajo de los filtros: un aviso, la carga o el calendario. */
function ContenidoDelCalendario({
  listo,
  cargando,
  sinConfigurar,
  editando,
  porColegio,
  calendario,
  incompatibilidades,
  filas,
  dias,
  onFecha,
  onDias,
  erroresCampo = {},
  periodoActual,
  onIrAlGeneral,
}) {
  if (!listo) {
    return <EmptyState title="Complete los filtros" description="Elija el año escolar y, si procede, el colegio." />
  }
  if (cargando) return <Skeleton className="m-4 h-64" />
  if (sinConfigurar && !editando) {
    /**
     * D71 — Sin calendario general no se pueden definir fechas particulares.
     *
     * Antes el estado vacío ofrecía "Crear fechas particulares" igualmente, y
     * el servidor lo rechazaba: el colegio no puede apartarse de un general
     * que no existe. Ahora se dice qué falta y se lleva allí, cambiando el
     * alcance en la misma vista y conservando el año.
     */
    if (porColegio) {
      return (
        <EmptyState
          icon={CalendarDays}
          title="Sin calendario configurado"
          description="Primero debes configurar el calendario general para poder definir fechas particulares de este colegio."
          action={<Button onClick={onIrAlGeneral}>Ir al calendario general</Button>}
        />
      )
    }
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin calendario configurado"
        description="No hay un calendario académico configurado para este año escolar."
      />
    )
  }

  const particular = calendario?.origen === 'particular'
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Con alcance "Por colegio", decir CUÁL se está viendo: editar
          creyendo que son fechas propias cuando es el general afectaría
          a todos los demás colegios. */}
      {porColegio && calendario && !editando && (
        <p className="flex items-center gap-2 text-sm text-ink-700">
          Este colegio usa
          <Badge tone={particular ? 'info' : 'neutral'}>
            {particular ? 'fechas particulares' : 'el calendario general'}
          </Badge>
        </p>
      )}

      {incompatibilidades.length > 0 && (
        <div className="rounded-xl border border-danger-600/20 bg-danger-100 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger-600">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            El cambio afecta a registros existentes
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-700">
            {incompatibilidades.map((x, i) => (
              <li key={`${x.fecha}-${i}`}>
                {x.colegio?.nombre} · {formatearFecha(x.fecha)} · {x.tipo_registro} — {x.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TablaPeriodos
        filas={filas}
        editando={editando}
        onCambio={onFecha}
        erroresCampo={erroresCampo}
        periodoActual={periodoActual}
      />

      <DiasNoLectivos dias={dias} editando={editando} onCambio={onDias} erroresCampo={erroresCampo} />
    </div>
  )
}

/** Los ocho periodos. En consulta son texto; en edición, selectores de fecha. */
function TablaPeriodos({ filas, editando, onCambio, erroresCampo = {}, periodoActual }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink-900">Periodos</h2>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 text-left">Periodo</th>
              <th className="px-4 py-3 text-left">Fecha de inicio</th>
              <th className="px-4 py-3 text-left">Fecha de fin</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, i) => {
              // D70 — La fila del periodo de HOY va señalada: es la que se
              // busca al abrir la pantalla, y contarlas a ojo entre ocho
              // fechas es justo lo que la tabla debería evitar.
              const esDeHoy = esPeriodoActual(p, periodoActual)
              return (
              <tr
                key={nombreDePeriodo(p)}
                className={`border-t border-line ${esDeHoy ? 'bg-brand-100/60' : ''}`}
                aria-current={esDeHoy ? 'date' : undefined}
              >
                <td className="px-4 py-2 font-medium text-ink-900">
                  {nombreDePeriodo(p)}
                  {p.tipo === 'PR' && (
                    <span className="ml-2 text-xs font-normal text-ink-500">receso posterior a PA{p.numero}</span>
                  )}
                  {esDeHoy && (
                    <span className="ml-2 whitespace-nowrap rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                      Periodo actual
                    </span>
                  )}
                </td>
                {['fecha_inicio', 'fecha_fin'].map((campo) => (
                  <td key={campo} className="px-4 py-2">
                    {editando ? (
                      <Input
                        type="date"
                        aria-label={`${campo === 'fecha_inicio' ? 'Inicio' : 'Fin'} de ${nombreDePeriodo(p)}`}
                        value={p[campo] ?? ''}
                        // D74 — El mensaje del 422 va DEBAJO de su campo:
                        // `periodos.3.fecha_fin` señala esta celda y no un
                        // aviso general con el nombre técnico delante.
                        error={erroresCampo[`periodos.${i}.${campo}`]}
                        onChange={(e) => onCambio(i, campo, e.target.value)}
                      />
                    ) : (
                      <span className="text-ink-700">{p[campo] ? formatearFecha(p[campo]) : '—'}</span>
                    )}
                  </td>
                ))}
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editando && (
        <p className="mt-1.5 text-xs text-ink-500">
          Un receso de un solo día lleva la misma fecha de inicio y de fin. Las ocho filas son obligatorias.
        </p>
      )}
    </div>
  )
}

/** Feriados y suspensiones. Solo cuentan dentro de un PA. */
function DiasNoLectivos({ dias, editando, onCambio, erroresCampo = {} }) {
  const cambiar = (i, campo, valor) => onCambio(dias.map((d, n) => (n === i ? { ...d, [campo]: valor } : d)))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-900">Días no lectivos</h2>
        {editando && (
          <Button
            size="sm"
            variant="outline"
            iconLeft={Plus}
            onClick={() => onCambio([...dias, { motivo: '', fecha_inicio: '', fecha_fin: '' }])}
          >
            Añadir día
          </Button>
        )}
      </div>

      {dias.length === 0 ? (
        <p className="rounded-lg border border-line px-4 py-3 text-sm text-ink-500">
          Ninguno. Los feriados nacionales los carga el sistema.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Fecha de inicio</th>
                <th className="px-4 py-3 text-left">Fecha de fin</th>
                {editando && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {dias.map((d, i) => (
                <tr key={`${d.motivo}-${d.fecha_inicio}-${i}`} className="border-t border-line">
                  <td className="px-4 py-2">
                    {editando ? (
                      <Input
                        aria-label={`Motivo del día no lectivo ${i + 1}`}
                        value={d.motivo ?? ''}
                        error={erroresCampo[`dias_no_lectivos.${i}.motivo`]}
                        onChange={(e) => cambiar(i, 'motivo', e.target.value)}
                      />
                    ) : (
                      <span className="text-ink-900">
                        {d.motivo}
                        {/* Los que carga el sistema no se distinguen a simple
                            vista de los que puso alguien a mano. */}
                        {d.origen === 'automatico' && (
                          <span className="ml-2 text-xs text-ink-500">cargado por el sistema</span>
                        )}
                      </span>
                    )}
                  </td>
                  {['fecha_inicio', 'fecha_fin'].map((campo) => (
                    <td key={campo} className="px-4 py-2">
                      {editando ? (
                        <Input
                          type="date"
                          aria-label={`${campo === 'fecha_inicio' ? 'Inicio' : 'Fin'} del día no lectivo ${i + 1}`}
                          value={d[campo] ?? ''}
                          /*
                           * El backend señala el día entero con
                           * `dias_no_lectivos.N`: "Debe estar comprendido
                           * dentro de los periodos (PA o PR) del calendario."
                           * Se pinta en las dos fechas porque el rango es el
                           * que está fuera, no una de ellas.
                           */
                          error={erroresCampo[`dias_no_lectivos.${i}`] ?? erroresCampo[`dias_no_lectivos.${i}.${campo}`]}
                          onChange={(e) => cambiar(i, campo, e.target.value)}
                        />
                      ) : (
                        <span className="text-ink-700">{d[campo] ? formatearFecha(d[campo]) : '—'}</span>
                      )}
                    </td>
                  ))}
                  {editando && (
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        iconLeft={Trash2}
                        aria-label={`Quitar el día no lectivo ${i + 1}`}
                        className="text-danger-600"
                        onClick={() => onCambio(dias.filter((_, n) => n !== i))}
                      >
                        Quitar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <p className="mt-1.5 text-xs text-ink-500">
          Cada día no lectivo debe caer dentro de un PA. Lo que se quite de esta tabla se elimina al guardar.
        </p>
      )}
    </div>
  )
}
