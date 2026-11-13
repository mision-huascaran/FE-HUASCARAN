// La tabla de lectura de una semana: existencia, creación y guardado (CU023 a CU026).
//
// EL ORDEN IMPORTA Y NO ES EL HABITUAL. Primero se pregunta si la tabla
// existe; solo si existe hay filas que editar. Un 404 con `tabla_no_existe` NO
// es un error: es la respuesta normal de una semana sin tabla, y trae la clase
// sugerida para poder crearla. Si se tratara como fallo, el docente vería un
// cartel de error en vez del único botón que puede pulsar ahí.
//
// Y LA TABLA NO SE CREA SOLA. CU023 lo pide así porque crearla CONGELA la lista
// de alumnos de su clase de referencia —y crea la clase si no tenía fila—: eso
// es una decisión del docente, no un efecto secundario de abrir una pantalla.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import { mensajeDeError, motivoDe } from '../../api/client'
import {
  CONFLICTO_TABLA,
  cambiarClaseReferencia,
  crearTabla,
  datosParaCrear,
  esTablaPorCrear,
  obtenerTabla,
} from '../../api/resources/lectura'
import { encolar, pendientesDeTipo } from '../../lib/colaOffline'
import { TIPOS_ENVIO, claveDeMarca } from '../../hooks/useOfflineQueue'
import { ahora } from '../../lib/relojServidor'
import { nuevoUuid } from '../../lib/uuid'
import { conPendientes, conectarConsultas, guardarRegistro } from '../../lib/registrosOffline'
import useActividadStore from '../../store/actividadStore'
import useSyncStore from '../../store/syncStore'
import { conDeclaracionPendiente, declaracionesPendientes } from './declaracionPendiente'

/**
 * D92 — Una asistencia marcada SIN CONEXIÓN habilita la fila de lectura.
 *
 * `GET /lectura/tablas` dice la asistencia que el SERVIDOR conoce; una marca
 * hecha offline —o hace un instante, en la misma sesión, antes de que la cola
 * alcance a sincronizar— todavía no llegó, así que la fila se veía "Sin
 * marcar" y bloqueada aunque el Docente acabara de marcar Presente en
 * Asistencias. Se completa con lo que la cola todavía tiene pendiente para
 * ese alumno, esa fecha y esa sección: la misma `clave` con la que
 * Asistencias encola la marca (`claveDeMarca`), así que el cruce es exacto y
 * no una suposición por campos sueltos.
 */
function asistenciaPendienteDe({ idAlumno, fecha, idSeccion }) {
  if (!fecha || !idSeccion) return null
  const clave = claveDeMarca(idAlumno, fecha, idSeccion)
  const item = pendientesDeTipo(TIPOS_ENVIO.ASISTENCIA).find((it) => it.clave === clave)
  const estado = item?.payload?.registros?.[0]?.estado
  return estado === 'presente' || estado === 'tardanza' ? estado : null
}

/** Un `id_operacion` nuevo por intento del usuario, estable en el reintento. */
const nuevaOperacion = nuevoUuid

/**
 * Un 4xx del lote entero (422 `validacion`, 403…) no se arregla reintentando:
 * se dice. Un corte de red no es un error: el cambio sigue en la cola.
 */
const esDefinitivo = (error) => {
  const estado = error?.response?.status
  return estado != null && estado >= 400 && estado < 500
}

/**
 * Tanda M (D101) — `422 sin_alumnos`: la semana tiene clase pero el grupo no
 * tenía alumnos en esa fecha. Tampoco es un fallo: es un estado del bloque, y
 * no hay tabla que crear. Se distingue por `motivo`, nunca por el texto.
 */
const esSinAlumnos = (error) => motivoDe(error) === 'sin_alumnos'

export default function useTablaLectura(filtros, { grupoValido = true } = {}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idActividad = useActividadStore((s) => s.sesion?.id ?? null)

  const { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, mes, idSemana } = filtros
  // `grupoValido` (de `useFiltrosDeGrupo`): sin esto, un cambio de grado con
  // la sección todavía sin corregir manda una consulta con una combinación
  // que no fue de verdad elegida, y el servidor la rechaza con 422.
  const listos =
    Boolean(idColegio && idPrograma && idGrado && idSeccion && idAnioEscolar && mes && idSemana) && grupoValido
  /**
   * EL MES NO ENTRA EN LA CLAVE, y no es un descuido.
   *
   * La tabla es grupo × subprograma × SEMANA. El `mes` viaja en la peticion
   * porque el contrato lo exige, pero desde la tanda B el servidor devuelve la
   * tabla aunque el mes enviado no sea el suyo: una semana que cae en dos meses
   * tiene UNA sola tabla, y su mes es el de su clase de referencia.
   *
   * Si el mes estuviera en la clave, la MISMA semana pedida desde los dos
   * meses que toca daría dos consultas por los mismos datos, y mientras la
   * segunda vuelve, `data` queda en `undefined` y la tabla parpadea. Cambiar de
   * mes sí cambia la tabla, pero porque descarta la semana
   * (`useFiltrosDeGrupo`), no por el mes.
   */
  const clave = ['lectura', 'tabla', { idColegio, idPrograma, idGrado, idSeccion, idAnioEscolar, idSemana }]
  // Lo que responde la cola (ahora o al reconectar) se escribe en esta caché.
  useEffect(() => conectarConsultas(queryClient), [queryClient])

  /**
   * Las filas que esperan en la cola para ESTA tabla, encima de la respuesta:
   * lo pendiente gana hasta que el servidor lo confirme (ver `conPendientes`).
   */
  const itemsEnCola = useSyncStore((s) => s.items)
  const conLoPendiente = useCallback(
    (respuesta) =>
      conDeclaracionPendiente(
        conPendientes('lectura', respuesta, ({ idTabla }, datos) => String(idTabla) === String(datos.id)),
        pendientesDeTipo(TIPOS_ENVIO.LECTURA_NO_REALIZADA),
        pendientesDeTipo(TIPOS_ENVIO.LECTURA_HABILITAR),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsEnCola],
  )

  const tabla = useQuery({
    queryKey: clave,
    queryFn: () => obtenerTabla(filtros),
    select: conLoPendiente,
    enabled: listos,
    /**
     * SIEMPRE SE VUELVE A PEDIR AL ENTRAR (D87), igual que Rúbrica y Registro
     * de Vuelo.
     *
     * Con el `staleTime` global de 60 s, volver a la pantalla servía la copia
     * en memoria (o la recuperada de IndexedDB) sin preguntarle al servidor:
     * una asistencia corregida en Asistencias, un permiso nuevo o las lecturas
     * guardadas desde otra sesión no aparecían ni al recargar. Sin conexión no
     * cambia nada: la consulta queda en pausa y se sigue viendo lo guardado.
     */
    staleTime: 0,
    refetchOnMount: 'always',
    /**
     * El 404 de "no existe todavía" no se reintenta: es una respuesta, no un
     * fallo, y reintentarla tres veces solo retrasaría el botón de crear.
     */
    retry: (intentos, error) => !esTablaPorCrear(error) && !esSinAlumnos(error) && intentos < 2,
  })

  /**
   * CU026 — Cuando sale de la cola la última declaración (o reversión) de esta
   * tabla, se vuelve a pedir: ya no hay nada pendiente que la sostenga, y la
   * copia en memoria es la de ANTES de declararla. Sin esto, al volver al
   * módulo y sincronizar, la tabla se veía desbloqueada hasta un F5.
   */
  const idTabla = tabla.data?.id
  const enEspera = declaracionesPendientes(
    idTabla,
    pendientesDeTipo(TIPOS_ENVIO.LECTURA_NO_REALIZADA),
    pendientesDeTipo(TIPOS_ENVIO.LECTURA_HABILITAR),
  )
  const enEsperaAntes = useRef(enEspera)
  useEffect(() => {
    if (enEsperaAntes.current > 0 && enEspera === 0) void queryClient.invalidateQueries({ queryKey: ['lectura', 'tabla'] })
    enEsperaAntes.current = enEspera
  }, [enEspera, queryClient])

  const porCrear = esTablaPorCrear(tabla.error) ? datosParaCrear(tabla.error) : null
  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ['lectura', 'tabla'] })
  }

  const crear = useMutation({
    mutationFn: ({ fechaClaseReferencia, idClaseReferencia } = {}) =>
      crearTabla({
        ...filtros,
        idOperacion: nuevaOperacion(),
        realizadoEn: ahora().toISOString(),
        idActividad,
        idClaseReferencia,
        // Sin clase elegida va la sugerida del 404, que es la habitual o
        // reprogramada de la semana.
        fechaClaseReferencia: fechaClaseReferencia ?? porCrear?.claseSugerida?.fecha ?? null,
      }),
    onSuccess: (creada) => {
      queryClient.setQueryData(clave, creada)
      refrescar()
      toast.success(
        'Tabla creada',
        'Ya puedes registrar la lectura de esta semana.',
      )
    },
    onError: (error) => {
      /**
       * Que ya exista no es un fallo que haya que explicar: alguien la creó
       * entre medias, o se creó desde el OTRO MES de una semana partida. Se
       * recarga y se sigue trabajando sobre la que hay.
       *
       * Recargar basta porque el GET devuelve la tabla aunque el `mes` que se
       * manda no sea el suyo (tanda B), y la pantalla ajusta el filtro al mes
       * que venga en la respuesta.
       */
      if (motivoDe(error) === 'tabla_existente') {
        refrescar()
        return
      }
      // La pantalla lo enseña como estado del bloque, no como un fallo.
      if (esSinAlumnos(error)) return
      toast.error('No se pudo crear la tabla', mensajeDeError(error))
    },
  })

  // Lo que respondió crear la tabla de OTRA semana no vale para esta.
  const olvidarCreacion = crear.reset
  useEffect(() => olvidarCreacion(), [olvidarCreacion, idColegio, idPrograma, idGrado, idSeccion, idSemana])

  /** El `detail` de `sin_alumnos`, venga de consultar la tabla o de crearla. */
  const errorSinAlumnos = [tabla.error, crear.error].find(esSinAlumnos)
  const sinAlumnos = errorSinAlumnos ? mensajeDeError(errorSinAlumnos) : null

  /**
   * Los dos conflictos de CU026 se resuelven igual: volver a pedir la tabla.
   *
   * Y NO SE REINTENTAN SOLOS. Un choque de versiones reintentado se vuelve a
   * chocar, y `declaracion_no_vigente` significa que otra operación ya hizo
   * lo que esta pedía: insistir lo desharia. Lo que se ofrece es consultar la
   * versión actual, que es lo único que puede resolverlo una persona.
   */
  const avisarConflicto = (error, titulo) => {
    const motivo = motivoDe(error)
    const texto = CONFLICTO_TABLA[motivo]
    if (!texto) return false
    refrescar()
    toast.error(titulo, mensajeDeError(error, texto))
    return true
  }

  /**
   * Las claves de la cola para ESTA tabla.
   *
   * Una por tipo: declarar dos veces no apila dos envíos, el segundo sustituye
   * al primero. Y la reversión conoce la de la declaración porque DEPENDE de
   * ella (CU026: "vinculada a la declaración original").
   */
  const claveDeclaracion = `lectura-no-realizada:${tabla.data?.id}`
  const claveReversion = `lectura-habilitar:${tabla.data?.id}`

  /** Lo que identifica al REGISTRO para el aviso de pendientes (E2). */
  const registroDeTabla = tabla.data
    ? {
        id_colegio: Number(idColegio),
        id_grado: Number(idGrado),
        id_seccion: Number(idSeccion),
        id_programa: Number(idPrograma),
        id_semana: Number(idSemana),
      }
    : null

  /**
   * Declarar "no realizada" (CU026) — SE ENCOLA.
   *
   * El caso de uso tiene su propio flujo sin conexión: la declaración se
   * guarda como "Pendiente de sincronización" y la tabla queda bloqueada
   * mientras tanto. Durante un tiempo esto exigió conexión —se razonó que
   * cambiar la tabla entera sin confirmación era arriesgado—, pero CU026 ya
   * responde esa pregunta y dice lo contrario.
   */
  const noRealizada = useMutation({
    mutationFn: (motivo) =>
      encolar({
        clave: claveDeclaracion,
        tipo: TIPOS_ENVIO.LECTURA_NO_REALIZADA,
        payload: {
          idTabla: tabla.data.id,
          version: tabla.data.version,
          realizadoEn: ahora().toISOString(),
          idActividad,
          motivo,
        },
        registro: registroDeTabla,
        idActividad,
        descripcion: 'Lectura no realizada',
        // Perder esto en silencio dejaría la semana reclamándole al docente un
        // trabajo que ya declaró que no se hizo.
        exigePersistencia: true,
      }),
    /**
     * `networkMode: 'always'` porque EL OFFLINE LO LLEVA LA COLA.
     *
     * Por defecto TanStack Query pausa una mutación cuando no hay red y no
     * llega a ejecutar su función. Aquí eso significaba que, sin conexión,
     * `encolar` ni se llamaba: el docente pulsaba y no pasaba nada. La cola
     * ya sabe esperar y reintentar; la mutación solo tiene que entregarle el
     * envío.
     */
    networkMode: 'always',
    onSuccess: (actualizada) => {
      if (actualizada?.id) queryClient.setQueryData(clave, actualizada)
      toast.success('Lectura marcada como no realizada', 'Ninguna fila queda pendiente para esta semana.')
    },
    onError: (error) => {
      if (avisarConflicto(error, 'No se pudo marcar la semana')) return
      toast.error('No se pudo marcar la semana', mensajeDeError(error))
    },
  })

  /**
   * Habilitar el registro: deshacer la declaración de "no realizada" (CU026).
   *
   * EXIGE CONEXIÓN, igual que declararla. Las dos operaciones cambian el estado
   * de la tabla ENTERA y recalculan todas sus filas, así que encolarlas
   * dejaría al docente registrando sobre un estado que el servidor aún no ha
   * aceptado. El contrato contempla encolarlas en orden; aquí se mantiene la
   * decisión que ya tomaba `no-realizada`, por coherencia: o las dos se
   * encolan o ninguna.
   */
  const habilitar = useMutation({
    mutationFn: (motivo) =>
      encolar({
        clave: claveReversion,
        tipo: TIPOS_ENVIO.LECTURA_HABILITAR,
        payload: {
          idTabla: tabla.data.id,
          version: tabla.data.version,
          realizadoEn: ahora().toISOString(),
          idActividad,
          motivo,
        },
        registro: registroDeTabla,
        idActividad,
        descripcion: 'Habilitar registro de lectura',
        /**
         * DEPENDE DE LA DECLARACIÓN, y por eso va enlazada (CU026).
         *
         * Si la tabla se declaró sin conexión y se revierte antes de
         * sincronizar, las dos esperan en la cola. Si el servidor rechaza la
         * declaración, la reversión ya no tiene sentido: revertiría algo que
         * nunca llegó a existir, así que la cola la descarta con ella.
         */
        dependeDe: claveDeclaracion,
        exigePersistencia: true,
      }),
    /**
     * `networkMode: 'always'` porque EL OFFLINE LO LLEVA LA COLA.
     *
     * Por defecto TanStack Query pausa una mutación cuando no hay red y no
     * llega a ejecutar su función. Aquí eso significaba que, sin conexión,
     * `encolar` ni se llamaba: el docente pulsaba y no pasaba nada. La cola
     * ya sabe esperar y reintentar; la mutación solo tiene que entregarle el
     * envío.
     */
    networkMode: 'always',
    onSuccess: (actualizada) => {
      if (actualizada?.id) queryClient.setQueryData(clave, actualizada)
      toast.success('El registro de lectura fue habilitado.')
    },
    onError: (error) => {
      if (avisarConflicto(error, 'No se pudo habilitar el registro')) return
      toast.error('No se pudo habilitar el registro', mensajeDeError(error))
    },
  })

  /**
   * Cambiar la clase de referencia (CU024, tanda B).
   *
   * Acepta cualquier clase de la semana, incluso de OTRO MES: una semana que
   * cae en dos meses tiene una sola tabla. Si la clase nueva es de otro mes, la
   * respuesta trae el `mes` nuevo y la pantalla ajusta el filtro.
   */
  const cambiarClase = useMutation({
    mutationFn: ({ idClase, fecha }) =>
      cambiarClaseReferencia(tabla.data.id, {
        idOperacion: nuevaOperacion(),
        version: tabla.data.version,
        idClase,
        fecha,
      }),
    onSuccess: (actualizada) => {
      queryClient.setQueryData(clave, actualizada)
      refrescar()
      toast.success('Clase de referencia actualizada', 'Las filas se rehicieron con la lista de esa clase.')
    },
    onError: (error) => {
      if (avisarConflicto(error, 'No se pudo cambiar la clase')) return
      toast.error('No se pudo cambiar la clase', mensajeDeError(error))
    },
  })

  /**
   * Guardar una fila. Solo viajan los campos que CAMBIARON.
   *
   * Un campo omitido no se toca; uno en `null` se borra. Mandar la fila entera
   * con los campos intactos en null borraría datos que el docente no quiso
   * borrar, y es exactamente lo que haría un `...fila` descuidado.
   *
   * Va por la cola offline: sin conexión queda en el equipo y sale al volver.
   * El resultado —aceptado, rechazado o choque de versión— lo procesa
   * `registrosOffline`, porque puede llegar con esta pantalla ya cerrada.
   */
  const guardarFila = ({ idAlumno, cambios, version }) => {
    const fila = tabla.data?.filas?.find((f) => f.id_alumno === idAlumno)
    const quien = fila?.nombre ?? `alumno ${idAlumno}`
    guardarRegistro('lectura', {
      clave: `${tabla.data.id}-${idAlumno}`,
      envio: {
        idTabla: tabla.data.id,
        nombre: fila?.nombre ?? null,
        item: { version, realizado_en: ahora().toISOString(), id_actividad: idActividad, id_alumno: idAlumno, ...cambios },
      },
      local: cambios,
      descripcion: `Lectura · ${quien}`,
      idActividad,
    }).catch((error) => {
      if (!esDefinitivo(error)) return
      refrescar()
      toast.error('No se guardó la lectura', mensajeDeError(error))
    })
  }

  /**
   * La respuesta del servidor, con sus listas SIEMPRE como listas (D48).
   *
   * El contrato dice que vienen como arreglos, pero cuando no llega lo esperado
   * —un endpoint a medio migrar, un `null` donde iba `[]`— un `.map()` o un
   * `.length` revientan el render y la pantalla acaba en el error genérico "No
   * se pudo mostrar esta pantalla". Eso fue D48: el probador veía ese cartel en
   * Registro de Vuelo y, como Supervisora, en Rúbrica y Seguimiento de Lectura,
   * sin forma de saber qué había pasado.
   *
   * Normalizando aquí, la pantalla puede fiarse de la forma y enseñar SU estado
   * vacío, que es lo que el caso de uso pide.
   */
  /**
   * La cola vive fuera de React (IndexedDB + un array en memoria): esta
   * suscripción no lee nada de ella, solo fuerza que el componente vuelva a
   * renderizar cuando algo se encola, se confirma o se descarta, para que el
   * overlay de abajo vea la cola TAL COMO ESTÁ AHORA y no la de cuando se
   * montó la pantalla.
   */
  const colaCambio = useSyncStore((s) => s.items)

  const datosTabla = useMemo(() => {
    if (!tabla.data) return null
    const fecha = tabla.data.clase_referencia?.fecha ?? null
    const filas = (tabla.data.filas ?? []).map((fila) => {
      if (fila.asistencia != null) return fila
      const pendiente = asistenciaPendienteDe({ idAlumno: fila.id_alumno, fecha, idSeccion })
      // `asistencia_pendiente` es solo para la pantalla: avisa que ese
      // "Presente" todavía no lo confirmó el servidor, sin inventar un campo
      // que el contrato no define.
      return pendiente ? { ...fila, asistencia: pendiente, asistencia_pendiente: true } : fila
    })
    return { ...tabla.data, filas, declaraciones: tabla.data.declaraciones ?? [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabla.data, idSeccion, colaCambio])

  return {
    tabla: datosTabla,
    cargando: tabla.isLoading,
    // Un error de verdad: ni el 404 de "no existe" ni `sin_alumnos`, que son respuestas.
    error: tabla.isError && !porCrear && !esSinAlumnos(tabla.error) ? tabla.error : null,
    // Con `sin_alumnos` no hay nada que crear.
    porCrear: sinAlumnos ? null : porCrear,
    sinAlumnos,
    crear: crear.mutate,
    creando: crear.isPending,
    marcarNoRealizada: noRealizada.mutate,
    marcando: noRealizada.isPending,
    habilitarRegistro: habilitar.mutate,
    habilitando: habilitar.isPending,
    errorAlHabilitar: habilitar.error,
    cambiarClase: cambiarClase.mutate,
    cambiandoClase: cambiarClase.isPending,
    guardarFila,
  }
}
