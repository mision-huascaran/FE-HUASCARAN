// CU028 — Otorgar un permiso excepcional de corrección.
//
// Lo que más condiciona este formulario es de dónde salen los PERIODOS: no son
// los cuatro PA del año, son los que `GET /permisos/opciones` devuelve, que son
// aquellos cuyo plazo ordinario ya terminó. Un periodo que todavía se puede
// regularizar por la vía normal el servidor lo rechaza con "este periodo
// todavía admite regularización ordinaria", así que ofrecerlo sería invitar a
// un error que va a llegar igual.
//
// Y "Desde ahora" no es un atajo cosmético: si el Supervisor escribe la hora de
// inicio a mano y tarda un minuto en guardar, el servidor la rechaza por estar
// en el pasado. Con `desde_ahora` la pone él y el problema desaparece.
//
// VARIOS PERMISOS DE UNA VEZ. Grado y Módulo admiten varias opciones y se crea
// **un permiso por cada combinación**, que es lo que CU028 exige ("cada permiso
// autoriza un solo módulo"). Lo que cambia es que se piden juntos: otorgar tres
// obligaba a abrir el modal tres veces y repetir el alcance entero.
//
// El lote es TODO O NADA. Con N peticiones sueltas, que la cuarta choque con un
// permiso superpuesto dejaría tres creados que nadie pidió y que no se pueden
// deshacer: un permiso no se borra, se revoca.
//
// Y LOS COLEGIOS Y GRADOS DEL DOCENTE SE AGRUPAN, NO SE FILTRAN. CU028 es
// explícito: "las opciones de colegio y grado no se limitan a las asignaciones
// históricas del Docente seleccionado, ya que el Supervisor puede autorizarlo
// para sustituir a otro Docente". Esconder los demás rompería justo el caso que
// da sentido al permiso.
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Switch from '../../components/ui/Switch'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import SelectorMultiple from './SelectorMultiple'
import {
  MODULOS_PERMISO,
  combinacionesRechazadas,
  opcionesDePermiso,
  otorgarPermisosEnLote,
} from '../../api/resources/permisos'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { erroresDeCampo, mensajeDeError } from '../../api/client'

const VACIO = {
  id_anio_escolar: '',
  id_colegio: '',
  // En plural: de cada cruce sale un permiso.
  grados: [],
  modulos: [],
  id_periodo_academico: '',
  desde_ahora: true,
  inicio: '',
  fin: '',
  motivo: '',
}

/** El tope del contrato: 6 grados × 4 módulos. */
const MAX_COMBINACIONES = 24

/** "3.º · Rúbrica", para nombrar una combinación en el resumen y en los errores. */
const nombreDeCombinacion = (grados, { id_grado: idGrado, modulo }) => {
  const grado = grados.find((g) => String(g.id) === String(idGrado))?.nombre ?? idGrado
  const nombre = MODULOS_PERMISO.find((m) => m.value === modulo)?.label ?? modulo
  return `${grado} · ${nombre}`
}

export default function ModalOtorgarPermiso({
  abierto,
  idUsuario,
  /** La ficha del Docente, para nombrarlo en la cabecera (CU028, D77). */
  docente,
  colegios = [],
  /**
   * Los colegios del Docente, con sus grados: `[{id_colegio, nombre, grados}]`.
   *
   * Es una PISTA, nunca un filtro (CU028). Sirve para agrupar y para no hacerle
   * buscar los suyos entre trece, y se lee cada vez que se abre el modal: si se
   * edita la asignación y se vuelve a otorgar, sale ya actualizada.
   */
  asignados = [],
  idAnioEscolar = '',
  onCerrar,
  onOtorgado,
}) {
  const toast = useToast()
  const [datos, setDatos] = useState(VACIO)

  /**
   * Los años escolares, para elegir a cuál pertenece el periodo.
   *
   * NO es un campo de texto ni un DatePicker: un año escolar es una entidad
   * con id —el backend la pide así— y no siempre coincide con el año
   * calendario, porque el receso posterior a PA4 puede cruzar diciembre. Un
   * selector de los que existen es lo único que no se puede teclear mal.
   */
  const { data: aniosCargados } = useQuery({
    queryKey: ['catalogo', 'anios-escolares'],
    queryFn: listarAniosEscolares,
    staleTime: Infinity,
  })

  /**
   * `?? []` MEMOIZADO, y no es cosmética: era un cuelgue.
   *
   * Un `data ?? []` escrito en el cuerpo crea un array NUEVO en cada render.
   * Como el efecto que rellena el formulario depende de él, se ejecutaba en
   * cada render, llamaba a `setDatos` y provocaba otro: un bucle infinito
   * mientras la consulta estuviera cargando, con la pestaña bloqueada. No se
   * veía porque en uso normal el catálogo ya suele estar en caché y la primera
   * respuesta corta el ciclo.
   */
  const anios = useMemo(() => aniosCargados ?? [], [aniosCargados])

  /**
   * EL FORMULARIO SE VACÍA AL ABRIR, y solo al abrir.
   *
   * Dependía también de `anios`, y eso borraba lo que el Supervisor hubiera
   * elegido en cuanto llegaba el catálogo: con la red lenta, elegir un colegio
   * en el primer segundo y verlo desaparecer solo.
   */
  useEffect(() => {
    if (!abierto) return
    setDatos(VACIO)
    setConfirmandoDescarte(false)
    setErroresCampo({})
    setRechazadas({})
  }, [abierto])

  /**
   * El año se PROPONE cuando llega el catálogo, sin pisar lo ya elegido.
   *
   * Se precarga el que se está CONSULTANDO, si sigue disponible: casi siempre
   * se otorga para lo que se acaba de mirar. Si no, el vigente; y si tampoco,
   * se deja vacío para que el Supervisor elija —nunca se adivina un año—.
   */
  useEffect(() => {
    if (!abierto || anios.length === 0) return
    const disponible = anios.some((a) => String(a.id) === String(idAnioEscolar))
    const propuesto = disponible ? String(idAnioEscolar) : String(anioVigente(anios)?.id ?? '')
    if (!propuesto) return
    setDatos((d) => (d.id_anio_escolar ? d : { ...d, id_anio_escolar: propuesto }))
  }, [abierto, anios, idAnioEscolar])

  /**
   * Los periodos y grados que ese colegio admite.
   *
   * Depende del colegio porque cada uno tiene su calendario: un PA puede estar
   * cerrado en un colegio y seguir abierto en otro.
   */
  const { data: opciones } = useQuery({
    queryKey: ['permisos', 'opciones', datos.id_colegio, datos.id_anio_escolar],
    queryFn: () => opcionesDePermiso({ idColegio: datos.id_colegio, idAnioEscolar: datos.id_anio_escolar }),
    enabled: Boolean(abierto && datos.id_colegio),
    /**
     * Mientras recarga, se conservan las opciones anteriores.
     *
     * La clave lleva el colegio Y el año, así que al cambiar cualquiera de los
     * dos `data` volvía a `undefined` y la lista de grados **parpadeaba a
     * vacío** —con su "Este colegio no ofrece grados."— antes de rellenarse.
     * Dura un instante, pero es el instante en que el Supervisor está mirando.
     */
    placeholderData: (previa) => previa,
  })

  /**
   * Lo que el servidor rechaza POR CAMPO, para pintarlo debajo de su control.
   *
   * CU028 lo pide así campo a campo: "Selecciona una fecha y hora futura o
   * utiliza la opción 'Desde ahora'." va bajo Inicio de vigencia, y "El fin de
   * vigencia debe ser posterior al inicio." bajo Fin. En un toast suelto el
   * Supervisor tiene que adivinar cuál de los ocho campos corregir.
   */
  const [erroresCampo, setErroresCampo] = useState({})
  /** D78 — Con datos escritos, cancelar pregunta DENTRO del mismo modal. */
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  /** Las combinaciones que el servidor rechazó, por su índice en el lote. */
  const [rechazadas, setRechazadas] = useState({})

  const otorgar = useMutation({
    mutationFn: () => {
      setErroresCampo({})
      setRechazadas({})
      return otorgarPermisosEnLote(idUsuario, { ...datos, combinaciones })
    },
    onSuccess: onOtorgado,
    onError: (error) => {
      const porCampo = erroresDeCampo(error)
      setErroresCampo(porCampo)
      /**
       * TODAS las combinaciones rechazadas, no solo la primera.
       *
       * El lote responde con el motivo de la que falló antes, pero trae el
       * resto en `combinaciones_rechazadas`. Enseñar solo una haría que el
       * Supervisor la corrigiera, reintentara y chocara otra vez.
       */
      const porCombinacion = combinacionesRechazadas(error)
      setRechazadas(porCombinacion)

      // El toast solo para lo que no tiene dónde señalarse. Si el error ya está
      // junto a su campo o a su combinación, repetirlo arriba es ruido.
      if (!Object.keys(porCampo).length && !Object.keys(porCombinacion).length) {
        toast.error('No se pudo otorgar el permiso', mensajeDeError(error))
      }
    },
  })

  const cambiar = (campo, valor) => {
    setErroresCampo((e) => (e[campo] ? { ...e, [campo]: undefined } : e))
    // Tocar algo invalida lo que el servidor rechazó: ya no es el mismo lote.
    setRechazadas({})
    setDatos((d) => {
      const siguiente = { ...d, [campo]: valor }
      // Cambiar de colegio invalida periodo y grados: son suyos, y los grados
      // de un colegio no son los de otro. Y cambiar de año invalida el
      // periodo, que pertenece a un año concreto.
      if (campo === 'id_colegio') {
        siguiente.id_periodo_academico = ''
        siguiente.grados = []
      }
      if (campo === 'id_anio_escolar') siguiente.id_periodo_academico = ''
      return siguiente
    })
  }

  /**
   * ¿Hay algo escrito que se perdería al cerrar?
   *
   * `desde_ahora` nace en `true` y el año viene precargado, así que no
   * cuentan: preguntar por ellos haría que cerrar un formulario intacto
   * pidiera confirmación, que es justo el estorbo que D78 no quiere.
   */
  const conDatos = Boolean(
    datos.id_colegio ||
      datos.grados.length ||
      datos.id_periodo_academico ||
      datos.modulos.length ||
      datos.fin ||
      datos.motivo.trim(),
  )

  const cancelar = () => (conDatos ? setConfirmandoDescarte(true) : onCerrar())

  // Memoizados por lo mismo: de ellos dependen un efecto y dos `useMemo`.
  const periodos = useMemo(() => opciones?.periodos ?? [], [opciones])
  const grados = useMemo(() => opciones?.grados ?? [], [opciones])

  /**
   * SE PROPONE EL ÚLTIMO PERIODO QUE ADMITE PERMISO.
   *
   * `GET /permisos/opciones` devuelve solo aquellos cuyo plazo ordinario ya
   * terminó, en orden, así que el último es el que acaba de cerrarse: el que se
   * corrige casi siempre. Se propone, no se impone, y solo si no hay nada
   * elegido todavía.
   */
  useEffect(() => {
    if (!abierto || datos.id_periodo_academico || periodos.length === 0) return
    setDatos((d) => (d.id_periodo_academico ? d : { ...d, id_periodo_academico: String(periodos.at(-1).id) }))
  }, [abierto, periodos, datos.id_periodo_academico])

  /** El colegio elegido, entre los asignados al Docente. */
  const asignadoActual = asignados.find((a) => String(a.id_colegio) === String(datos.id_colegio)) ?? null

  /**
   * Los colegios, con los del Docente PRIMERO y marcados.
   *
   * Agrupar no es filtrar: los demás siguen todos ahí, porque el Supervisor
   * puede autorizarlo para sustituir a otro Docente (CU028).
   */
  const colegiosAgrupados = useMemo(() => {
    const suyos = new Set(asignados.map((a) => String(a.id_colegio)))
    const etiqueta = suyos.size ? `Asignados a ${docente?.nombre ?? 'este Docente'}` : ''
    const ordenados = [...colegios].sort((a, b) => {
      const unoEsSuyo = suyos.has(String(a.id_colegio))
      const otroEsSuyo = suyos.has(String(b.id_colegio))
      return unoEsSuyo === otroEsSuyo ? 0 : unoEsSuyo ? -1 : 1
    })
    return ordenados.map((c) => ({
      value: String(c.id_colegio),
      label: suyos.has(String(c.id_colegio)) && etiqueta ? `${c.nombre} · asignado` : c.nombre,
    }))
  }, [colegios, asignados, docente])

  /** Los grados del colegio, con los suyos en su propio grupo. */
  const gradosAgrupados = useMemo(() => {
    const suyos = new Set((asignadoActual?.grados ?? []).map(String))
    return grados.map((g) => ({
      value: String(g.id),
      label: g.nombre,
      grupo: suyos.has(String(g.id)) ? 'Asignados en este colegio' : suyos.size ? 'Otros grados' : '',
    }))
  }, [grados, asignadoActual])

  /**
   * Las combinaciones del lote: un permiso por cada cruce de grado y módulo.
   *
   * El orden importa, porque el servidor devuelve los rechazos por índice.
   */
  const combinaciones = useMemo(
    () => datos.grados.flatMap((idGrado) => datos.modulos.map((modulo) => ({ id_grado: idGrado, modulo }))),
    [datos.grados, datos.modulos],
  )

  const completo =
    datos.id_anio_escolar &&
    datos.id_colegio &&
    combinaciones.length > 0 &&
    combinaciones.length <= MAX_COMBINACIONES &&
    datos.id_periodo_academico &&
    datos.fin &&
    datos.motivo.trim() &&
    (datos.desde_ahora || datos.inicio)

  return (
    <Modal
      open={abierto}
      // D78 — Mientras procesa no se cierra: la solicitud puede haberse
      // aplicado, y cerrar daría a entender que no.
      onClose={otorgar.isPending ? () => {} : cancelar}
      // D78 — Pulsar fuera NO lo cierra: un clic distraído no puede tirar un
      // formulario de ocho campos a medio llenar.
      cierreExterior={false}
      title="Otorgar permiso de corrección"
      // D77 — El nombre del Docente, como dato de solo lectura: el modal se
      // abre desde su ficha, pero una vez abierto nada decía a quién se está
      // autorizando.
      subtitle={docente?.nombre ?? docente?.nombres ?? 'Un permiso autoriza un solo módulo.'}
      footer={
        confirmandoDescarte ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmandoDescarte(false)}>
              Continuar completando
            </Button>
            <Button variant="danger" onClick={onCerrar}>
              Descartar datos
            </Button>
          </>
        ) : (
        <>
          <Button variant="ghost" onClick={cancelar} disabled={otorgar.isPending}>
            Cancelar
          </Button>
          <Button loading={otorgar.isPending} disabled={!completo} onClick={() => otorgar.mutate()}>
            Otorgar permiso
          </Button>
        </>
        )
      }
    >
      {confirmandoDescarte ? (
        <p className="text-sm text-ink-700">Tienes datos sin guardar. ¿Deseas descartarlos?</p>
      ) : (
      <>
      {/*
        El aviso de CU028. Lo que hay que dejar claro es qué NO hace: el
        permiso habilita regularizar ese grupo, pero no toca las asignaciones
        históricas ni convierte al Docente en su titular.
      */}
      <p className="mb-4 rounded-lg bg-surface-100 px-3 py-2 text-sm text-ink-700">
        Este permiso permite regularizar información del grupo seleccionado sin modificar sus asignaciones
        históricas.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Año escolar"
          required
          value={datos.id_anio_escolar}
          options={anios.map((a) => ({ value: String(a.id), label: a.nombre }))}
          placeholder="Seleccione"
          hint="El de la consulta, o el año en curso"
          onChange={(e) => cambiar('id_anio_escolar', e.target.value)}
        />
        <Select
          label="Colegio"
          required
          placeholder="Seleccione"
          value={datos.id_colegio}
          options={colegiosAgrupados}
          hint={asignados.length ? 'Los suyos van primero. Puedes elegir cualquiera.' : undefined}
          onChange={(e) => cambiar('id_colegio', e.target.value)}
        />
        <Select
          label="Periodo académico"
          required
          placeholder={datos.id_colegio ? 'Seleccione' : 'Elija antes un colegio'}
          error={erroresCampo.id_periodo_academico}
          value={datos.id_periodo_academico}
          options={periodos.map((p) => ({ value: String(p.id), label: p.nombre }))}
          /**
           * Por qué no están los cuatro PA. Faltaba decirlo: el periodo en
           * curso simplemente no salía en la lista, y eso se lee como un fallo
           * de la pantalla en vez de como la regla que es.
           */
          hint={
            datos.id_colegio
              ? 'Los periodos en curso no aparecen: todavía admiten regularización ordinaria y no necesitan permiso.'
              : 'Solo los periodos cuyo plazo ordinario ya terminó'
          }
          onChange={(e) => cambiar('id_periodo_academico', e.target.value)}
        />
        <div className="md:col-span-2">
          <SelectorMultiple
            label="Grados"
            required
            valores={datos.grados}
            opciones={gradosAgrupados}
            deshabilitado={!datos.id_colegio}
            vacio={datos.id_colegio ? 'Este colegio no ofrece grados.' : 'Elija antes un colegio'}
            hint="Se crea un permiso por cada grado y módulo."
            onChange={(valores) => cambiar('grados', valores)}
          />
        </div>

        <div className="md:col-span-2">
          <SelectorMultiple
            label="Módulos autorizados"
            required
            valores={datos.modulos}
            opciones={MODULOS_PERMISO}
            hint="Cada permiso autoriza un solo módulo: de cada uno sale el suyo."
            onChange={(valores) => cambiar('modulos', valores)}
          />
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <div className="flex items-center gap-2">
            <Switch
              label="Desde ahora"
              checked={datos.desde_ahora}
              onChange={(valor) => cambiar('desde_ahora', valor)}
            />
            <span className="text-sm text-ink-900">Desde ahora</span>
          </div>
          <p className="text-xs text-ink-500">
            Evita que el servidor rechace una hora de inicio que quedó en el pasado mientras se llenaba el
            formulario.
          </p>
        </div>

        {!datos.desde_ahora && (
          <Input
            label="Inicio de vigencia"
            type="datetime-local"
            required
            value={datos.inicio}
            error={erroresCampo.inicio}
            onChange={(e) => cambiar('inicio', e.target.value)}
          />
        )}
        <Input
          label="Fin de vigencia"
          type="datetime-local"
          required
          value={datos.fin}
          min={datos.inicio || undefined}
          error={erroresCampo.fin}
          onChange={(e) => cambiar('fin', e.target.value)}
        />

        {/*
          LA CUENTA, ANTES DE PULSAR.

          Dos grados por tres módulos son seis permisos, y seis permisos no es
          lo que nadie cree estar otorgando al marcar cinco casillas. Se dice
          cuántos y cuáles antes, no después.
        */}
        {combinaciones.length > 0 && (
          <div className="md:col-span-2">
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                combinaciones.length > MAX_COMBINACIONES
                  ? 'bg-danger-100 text-danger-600'
                  : 'bg-surface-100 text-ink-700'
              }`}
            >
              {combinaciones.length > MAX_COMBINACIONES ? (
                <>
                  Son <strong>{combinaciones.length}</strong> permisos y el máximo por lote es{' '}
                  <strong>{MAX_COMBINACIONES}</strong>. Quita algún grado o módulo.
                </>
              ) : (
                <>
                  Se otorgarán <strong>{combinaciones.length}</strong>{' '}
                  {combinaciones.length === 1 ? 'permiso' : 'permisos'}:{' '}
                  {combinaciones.map((c) => nombreDeCombinacion(grados, c)).join(' · ')}.
                </>
              )}
            </p>

            {/* Cada una que el servidor rechazó, con su motivo. */}
            {Object.keys(rechazadas).length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {Object.entries(rechazadas).map(([indice, detalle]) => (
                  <li key={indice} className="text-xs text-danger-600">
                    <strong>{nombreDeCombinacion(grados, combinaciones[Number(indice)] ?? {})}:</strong> {detalle}
                  </li>
                ))}
                <li className="text-xs text-ink-500">
                  No se creó ninguno: el lote es todo o nada. Corrige lo señalado y vuelve a intentarlo.
                </li>
              </ul>
            )}
          </div>
        )}

        <div className="md:col-span-2">
          <Textarea
            label="Motivo de la autorización"
            rows={3}
            required
            maxLength={300}
            value={datos.motivo}
            error={erroresCampo.motivo}
            hint="Queda registrado junto a quién lo otorgó. Por ejemplo: faltó registrar la lectura de marzo."
            onChange={(e) => cambiar('motivo', e.target.value)}
          />
        </div>
      </div>
      </>
      )}
    </Modal>
  )
}
