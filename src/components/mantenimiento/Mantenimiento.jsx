// Plantilla de mantenimiento (T16): una sola implementación para Alumnos,
// Usuarios y Colegios.
//
// Flujo básico: la grilla abre SIEMPRE filtrada por Estado = Activo y por el
// alcance del rol. Las acciones salen de la matriz de permisos, no de
// condicionales por pantalla: si la matriz no da `N`, no hay botón de Nuevo.
//
// Nunca se borra un registro: `Inactivar` cambia el estado y deja auditoría.
import { useMemo, useState } from 'react'
import { Ban, ClipboardList, Eye, Pencil, Plus, RotateCcw } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import RequiereConexion from '../layout/RequiereConexion'
import ConfirmarEstado from './ConfirmarEstado'
import ProponerActividad from './ProponerActividad'
import FiltrosMantenimiento from './FiltrosMantenimiento'
import PopupMantenimiento from './PopupMantenimiento'
import { ACCION, puede } from '../../auth/permisos'
import { mensajeDeError } from '../../api/client'
import { SIN_ACTIVIDAD } from '../../api/resources/sincronizacion'
import useSessionStore from '../../store/sessionStore'
import useActividadStore from '../../store/actividadStore'
import useActividad from '../../features/inicio/useActividad'
import { ROLES } from '../../auth/roles'

/** Cómo se nombra lo que se gestiona en el aviso sin conexión (contrato §11). */
const GESTIONADO = { alumnos: 'estudiantes', colegios: 'colegios', usuarios: 'usuarios' }
const VER_DETALLE = 'Ver detalle'

export const avisoSinConexion = (seccion) =>
  `Acción no disponible sin conexión. Conéctate a internet para gestionar ${GESTIONADO[seccion] ?? seccion}.`

/** Por qué no se puede escribir ahora, o `undefined` si se puede. La conexión manda sobre la actividad. */
function avisoDeBloqueo(seccion, { sinConexion, exigeActividad }) {
  if (sinConexion) return avisoSinConexion(seccion)
  // CU010 da este mensaje PALABRA POR PALABRA. No es una sugerencia de
  // redacción: el probador lo compara carácter a carácter.
  // CU014 adopta el MISMO texto que los módulos operativos: antes decía
  // "Debe iniciar una actividad para realizar cambios." y el servidor ya
  // responde el unificado, así que tener dos era contradecirse solo.
  if (exigeActividad) return SIN_ACTIVIDAD
  return undefined
}

export default function Mantenimiento({
  seccion,
  entidad,
  titulo,
  consulta,
  columnas = [],
  campos = [],
  filtros = [],
  valoresFiltro = {},
  onFiltro,
  onGuardar,
  onCambiarEstado,
  cargarAuditoria,
  // Cómo pedir el registro completo al abrir Ver/Editar (ver el popup).
  cargarDetalle = null,
  /**
   * `{etiqueta, ayuda}` si al activar o inactivar hay que preguntar DESDE
   * CUÁNDO. Solo Alumnos la necesita: su backend la exige porque de ella
   * depende el historial de pertenencia.
   */
  fechaEfectiva = null,
  /**
   * `{abrir, aplicaA?, etiqueta?, icono?}` para ofrecer el acceso a la vista
   * de detalle en la fila.
   *
   * `etiqueta` e `icono` se pasan porque cada sección va a un sitio distinto y
   * conviene que el botón lo diga: en Usuarios lleva al registro de permisos
   * del Docente, no a "un detalle". `aplicaA` decide en qué filas aparece —en
   * Usuarios solo los Docentes lo tienen— y en las demás el hueco se reserva
   * para no desalinear la columna.
   */
  verDetalle = null,
  /**
   * Botones propios de la sección, junto a "Agregar". Hoy solo lo usa
   * Colegios, para entrar al calendario académico (CU027).
   */
  accionesExtra = null,
  guardando = false,
  soloOnline = false,
  sinConexion = false,
  // Motivo por el que no se puede dar de alta aunque la matriz lo permita
  // (p. ej. un Docente sin asignaciones). El botón se ve, deshabilitado.
  motivoSinNuevo = null,
  // Género de la entidad, para el título del popup: era "Nuevo cuenta".
  genero = 'm',
}) {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  /**
   * CU010 — Las escrituras del Docente exigen una ACTIVIDAD ABIERTA.
   *
   * No es solo cosmético: sin actividad el servidor responde 409
   * `actividad_requerida`, así que dejar los botones vivos lleva al docente a
   * rellenar un formulario entero para que se lo rechacen al guardar.
   *
   * Solo aplica al Docente: el Supervisor ni siquiera tiene ese botón.
   */
  const conActividad = Boolean(useActividadStore((s) => s.sesion))
  const exigeActividad = idRol === ROLES.DOCENTE && !conActividad

  const [popup, setPopup] = useState(null)

  /**
   * Guardar y CERRAR.
   *
   * El popup se quedaba abierto con los mismos datos después de un 201: el
   * aviso de éxito aparecía, pero la única forma de cerrarlo era "Cancelar", y
   * un segundo "Guardar" creaba un duplicado.
   *
   * Cierra solo si el guardado SALIÓ BIEN, de ahí que `onGuardar` tenga que
   * devolver su promesa: con un error, el formulario sigue abierto con lo que
   * el usuario escribió, que es lo que permite corregir y reintentar.
   */
  const guardar = async (valores) => {
    try {
      await onGuardar(valores, popup)
      setPopup(null)
    } catch {
      // El toast de la pantalla ya explica qué pasó.
    }
  }
  // S4 — Inactivar/Activar pide confirmación: cambia el estado de un registro
  // que otros pueden estar usando, y conviene que sea deliberado.
  const [confirmando, setConfirmando] = useState(null)

  /**
   * Lo que el Docente quería hacer cuando le faltaba la actividad.
   *
   * Se guarda para RETOMARLO: se le ofrece iniciarla, y si acepta, la acción
   * sigue su curso sin que tenga que volver a buscar la fila. Mandarlo arriba
   * a pulsar otro botón y que vuelva a empezar era la parte molesta.
   */
  const [pendientePorActividad, setPendientePorActividad] = useState(null)
  const { iniciar, sinAsignaciones } = useActividad()
  const [iniciando, setIniciando] = useState(false)

  const iniciarYContinuar = async () => {
    setIniciando(true)
    try {
      await iniciar()
    } finally {
      setIniciando(false)
    }
    // `iniciar()` avisa por su cuenta si falla; si salió bien, el store ya
    // tiene la actividad y la acción puede continuar.
    if (useActividadStore.getState().sesion) {
      pendientePorActividad?.seguir()
      setPendientePorActividad(null)
    }
  }

  /**
   * Envuelve una acción de escritura: si falta la actividad, propone abrirla
   * en vez de dejar el botón muerto. Sin asignaciones no hay nada que
   * proponer, así que ahí sí se deshabilita.
   */
  const alEscribir = (accion, seguir) => () => {
    if (exigeActividad) {
      setPendientePorActividad({ accion, seguir })
      return
    }
    seguir()
  }

  const puedeCrear = puede(seccion, idRol, ACCION.NUEVO)
  const puedeEditar = puede(seccion, idRol, ACCION.EDITAR)
  const puedeInactivar = puede(seccion, idRol, ACCION.INACTIVAR)
  const puedeAuditar = puede(seccion, idRol, ACCION.AUDITORIA)

  // E4 de la plantilla. Hay dos comportamientos distintos sin conexión:
  //   · `soloOnline` (Usuarios, Colegios) → pantalla "Requiere conexión".
  //   · lectura en caché (Alumnos) → se ve la lista; los botones de escritura
  //     siguen a la vista pero DESHABILITADOS (gris) con el aviso del contrato
  //     (§11). Antes desaparecían y el docente no sabía por qué.
  const sinPantalla = soloOnline && sinConexion
  // Se escribe si hay conexión Y, para el Docente, una actividad abierta.
  const bloqueado = sinConexion || exigeActividad
  const aviso = avisoDeBloqueo(seccion, { sinConexion, exigeActividad })
  const motivoNuevo = aviso ?? motivoSinNuevo ?? undefined

  const columnasConAcciones = useMemo(() => {
    const acciones = {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (fila) => (
        <div className="flex items-center justify-center gap-1">
          {/* Abre una VISTA dentro de la SPA, no el popup: es lo que piden
              CU013 y CU016 para el detalle del colegio y el del docente.

              NO DICE "Ver detalle" NI LLEVA UN OJO. Quedaba junto al "Ver" de
              al lado, con el mismo icono y casi el mismo texto: dos ojos
              seguidos que no se distinguían y que llevaban a sitios distintos.
              Ahora el texto dice a qué se va y el icono lo acompaña. Es una
              libreta y no un "+" porque el botón abre el registro de permisos
              —donde se consulta, se otorga y se revoca—, no un formulario de
              alta: un "+" prometería que se abre el modal de golpe.

              Los CU todavía lo llaman "Ver detalle"; los analistas lo
              corregirán. Solo se ofrece donde hay detalle que ver, y en las
              demás filas se reserva el hueco para que la columna no baile. */}
          {verDetalle &&
            (verDetalle.aplicaA?.(fila) ?? true ? (
              <Button
                size="sm"
                variant="ghost"
                iconLeft={verDetalle.icono ?? ClipboardList}
                title={verDetalle.etiqueta ?? VER_DETALLE}
                aria-label={`${verDetalle.etiqueta ?? VER_DETALLE} de ${fila.nombre ?? entidad}`}
                onClick={() => verDetalle.abrir(fila)}
              >
                {verDetalle.etiqueta ?? VER_DETALLE}
              </Button>
            ) : (
              // El hueco se mide por el texto más largo que puede ocupar.
              <span aria-hidden="true" className="inline-block w-[9.5rem]" />
            ))}
          <Button
            size="sm"
            variant="ghost"
            iconLeft={Eye}
            aria-label={`Visualizar ${fila.nombre ?? entidad}`}
            onClick={() => setPopup({ modo: 'ver', registro: fila })}
          >
            Ver
          </Button>
          {puedeEditar && (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={Pencil}
              aria-label={`Editar ${fila.nombre ?? entidad}`}
              disabled={sinConexion || (exigeActividad && sinAsignaciones)}
              title={sinConexion ? aviso : undefined}
              onClick={alEscribir(`editar ${entidad}`, () => setPopup({ modo: 'editar', registro: fila }))}
            >
              Editar
            </Button>
          )}
          {puedeInactivar && (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={fila.activo === false ? RotateCcw : Ban}
              className={fila.activo === false ? undefined : 'text-danger-600'}
              aria-label={`${fila.activo === false ? 'Activar' : 'Inactivar'} ${fila.nombre ?? entidad}`}
              disabled={sinConexion || (exigeActividad && sinAsignaciones)}
              title={sinConexion ? aviso : undefined}
              onClick={alEscribir(
                `${fila.activo === false ? 'activar' : 'inactivar'} ${entidad}`,
                () => setConfirmando({ fila, activo: fila.activo === false }),
              )}
            >
              {fila.activo === false ? 'Activar' : 'Inactivar'}
            </Button>
          )}
        </div>
      ),
    }

    const estado = {
      key: 'activo',
      header: 'Estado',
      align: 'center',
      render: (fila) => (
        <Badge tone={fila.activo === false ? 'neutral' : 'success'}>
          {fila.activo === false ? 'Inactivo' : 'Activo'}
        </Badge>
      ),
    }

    return [...columnas, estado, acciones]
  }, [columnas, entidad, puedeEditar, puedeInactivar, bloqueado, aviso, verDetalle])

  if (sinPantalla) {
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{titulo}</h1>
        </header>
        <Card>
          <RequiereConexion seccion={titulo} />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">{titulo}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {puedeCrear && (
            <Button
              iconLeft={Plus}
              disabled={Boolean(sinConexion ? motivoNuevo : motivoSinNuevo) || (exigeActividad && sinAsignaciones)}
              title={sinConexion ? motivoNuevo : motivoSinNuevo ?? undefined}
              onClick={alEscribir(`agregar ${entidad}`, () => setPopup({ modo: 'nuevo', registro: null }))}
            >
              Agregar
            </Button>
          )}
          {/* CU013 pide el acceso al calendario académico JUNTO al botón de
              crear, en la fila de acciones sobre los filtros. Va aquí y no en
              la pantalla porque la cabecera la monta la plantilla. */}
          {accionesExtra}
        </div>
      </header>

      {motivoNuevo && puedeCrear && (
        <p role="note" className="-mt-2 text-sm text-ink-500">
          {motivoNuevo}
        </p>
      )}

      <Card padded={false}>
        <FiltrosMantenimiento
          filtros={filtros}
          valores={valoresFiltro}
          onCambio={onFiltro}
          // Todos de golpe, no uno por campo: la barra espera a que se deje
          // de escribir y manda el conjunto entero en una sola consulta.
          onAplicar={(nuevos) => Object.entries(nuevos).forEach(([n, v]) => onFiltro?.(n, v))}
        />

        {consulta.isError ? (
          <EmptyState title={`No se pudieron cargar los ${entidad.toLowerCase()}s`} description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data ?? []}
            getRowId={(f) => f.id ?? f[`id_${seccion.replace(/s$/, '')}`] ?? f.id_usuario}
            initialPageSize={40}
            columns={columnasConAcciones}
          />
        )}
      </Card>

      <ProponerActividad
        abierto={Boolean(pendientePorActividad)}
        accion={pendientePorActividad?.accion}
        iniciando={iniciando}
        onIniciar={iniciarYContinuar}
        onCancelar={() => setPendientePorActividad(null)}
      />

      <ConfirmarEstado
        peticion={confirmando}
        entidad={entidad}
        fechaEfectiva={fechaEfectiva}
        onCancelar={() => setConfirmando(null)}
        onConfirmar={(fecha) => {
          // La fecha solo viaja si la sección la pidió. Colegios y Usuarios no
          // la usan y su backend no acepta cuerpo: mandarla sería ruido.
          if (fechaEfectiva) onCambiarEstado(confirmando.fila, confirmando.activo, fecha)
          else onCambiarEstado(confirmando.fila, confirmando.activo)
          setConfirmando(null)
        }}
      />

      <PopupMantenimiento
        abierto={Boolean(popup)}
        modo={popup?.modo ?? 'nuevo'}
        registro={popup?.registro ?? null}
        entidad={entidad}
        seccion={seccion}
        campos={campos}
        guardando={guardando}
        puedeVerAuditoria={puedeAuditar}
        cargarAuditoria={cargarAuditoria}
        cargarDetalle={cargarDetalle}
        genero={genero}
        onGuardar={guardar}
        onCerrar={() => setPopup(null)}
      />
    </div>
  )
}
