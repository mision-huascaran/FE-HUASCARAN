// CU028 — Permisos excepcionales de corrección de un Docente.
//
// Qué resuelven: un periodo cuyo plazo ordinario de regularización ya terminó
// y que, aun así, hay que corregir. El Supervisor autoriza a este Docente para
// UN módulo, UN colegio, UN grado y UN periodo, con caducidad y motivo.
//
// Tres cosas de la pantalla que vienen del caso de uso y no de un gusto:
//
//   · NO SE EDITA NADA. Solo se otorga y se revoca, y la revocación deja su
//     propio rastro. Por eso no hay lápiz en ninguna fila.
//   · EL ESTADO SE CALCULA con la hora, no se guarda. Un permiso caduca solo.
//   · CUALQUIER ACCIÓN EXIGE CONEXIÓN. No hay versión offline de esto ni debe haberla:
//     autorizar una corrección es un acto administrativo, no trabajo de aula.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, ShieldOff, WifiOff } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import BarraDeFiltros, { CeldaFiltro } from '../../components/ui/BarraDeFiltros'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import DetallePermiso from './DetallePermiso'
import ModalRevocarPermiso from './ModalRevocarPermiso'
import ModalOtorgarPermiso from './ModalOtorgarPermiso'
import {
  ESTADOS_PERMISO,
  ETIQUETA_ESTADO_PERMISO,
  ETIQUETA_MODULO,
  MODULOS_PERMISO,
  TONO_ESTADO_PERMISO,
  listarPermisos,
  opcionesDePermiso,
  revocarPermiso,
} from '../../api/resources/permisos'
import { anioVigente, listarAniosEscolares, obtenerUsuario } from '../../api/resources/administracion'
import { erroresDeCampo, mensajeDeError, motivoDe } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'
import useConexion from '../../hooks/useConexion'
import useFiltrosGuardados from '../../hooks/useFiltrosGuardados'
import useSessionStore from '../../store/sessionStore'

const SIN_FILTROS = { id_anio_escolar: '', id_colegio: '', id_periodo_academico: '', modulo: '', estado: '' }

/** CU028: el éxito se dice igual, pero si lo creado no se verá en la lista, también eso. */
export const NO_COINCIDE_CON_FILTROS = 'El permiso creado no coincide con los filtros seleccionados.'

/**
 * ¿Lo otorgado aparece con los filtros aplicados? Un filtro vacío es "Todos".
 * El estado no se compara: un permiso recién otorgado es Programado o Vigente
 * según su inicio, y eso lo decide el servidor.
 */
export function coincideConFiltros(otorgado, filtros) {
  const igual = (filtro, valor) => !filtro || String(filtro) === String(valor ?? '')
  return (
    igual(filtros.id_anio_escolar, otorgado.id_anio_escolar) &&
    igual(filtros.id_colegio, otorgado.id_colegio) &&
    igual(filtros.id_periodo_academico, otorgado.id_periodo_academico) &&
    (!filtros.modulo || (otorgado.modulos ?? []).includes(filtros.modulo))
  )
}

/** El backend manda `{id, nombre}` donde la tabla quiere un texto. */
const texto = (valor) => (valor != null && typeof valor === 'object' ? (valor.nombre ?? '—') : (valor ?? '—'))

export default function PermisosDeCorreccion({ docente, colegios = [] }) {
  /**
   * LOS COLEGIOS Y GRADOS DEL DOCENTE, para agrupar el modal de otorgar.
   *
   * Es una pista, no un filtro: CU028 prohíbe limitar las opciones a sus
   * asignaciones, porque el Supervisor puede autorizarlo para sustituir a otro.
   * Sirve para que no tenga que buscar los suyos entre trece colegios.
   *
   * Se pide aquí y no se guarda: así, si se edita la asignación y se vuelve a
   * otorgar, los grupos salen ya actualizados. Un Docente puede tener VARIOS
   * colegios, cada uno con sus grados, y no son los mismos en todos.
   */
  const idDocente = docente?.id_usuario ?? docente?.id ?? null
  const { data: ficha } = useQuery({
    queryKey: ['detalle', 'usuario', idDocente],
    queryFn: () => obtenerUsuario(idDocente),
    enabled: Boolean(idDocente),
    // Sin reintentos: si falla, el modal sigue sirviendo sin los grupos.
    retry: false,
  })
  const asignados = ficha?.colegios ?? []

  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()

  /**
   * D77 — Los filtros se RESTAURAN al volver, por usuario autenticado (CU028).
   * El borrador arranca en lo aplicado: lo que se ve y lo que dice la barra
   * tienen que coincidir.
   */
  const idAutenticado = useSessionStore((s) => s.usuario?.id_usuario)
  const [filtros, setFiltros] = useFiltrosGuardados(`permisos.${idAutenticado ?? 'anonimo'}`, SIN_FILTROS)
  const [borrador, setBorrador] = useState(filtros)
  const [viendo, setViendo] = useState(null)
  const [otorgando, setOtorgando] = useState(false)
  /** El permiso que se está revocando, y el error de su motivo si lo hubo. */
  const [revocando, setRevocando] = useState(null)
  const [errorRevocacion, setErrorRevocacion] = useState(undefined)

  const idUsuario = docente?.id_usuario ?? docente?.id

  const { data: anios = [] } = useQuery({
    queryKey: ['catalogo', 'anios-escolares'],
    queryFn: listarAniosEscolares,
    staleTime: Infinity,
  })

  /**
   * El año arranca en el VIGENTE, no en "Todos" (CU028).
   *
   * Los demás filtros sí empiezan en "Todos", pero este no: la lista de
   * permisos de un docente a lo largo de varios años mezcla cosas que no se
   * comparan, y lo que casi siempre se quiere ver es lo de este año.
   *
   * Si no hay ninguno vigente se queda en "Todos", que es mejor que proponer
   * un año al azar.
   */
  useEffect(() => {
    if (!anios.length) return
    const vigente = anioVigente(anios)
    if (!vigente) return
    setBorrador((b) => (b.id_anio_escolar ? b : { ...b, id_anio_escolar: String(vigente.id) }))
    setFiltros((f) => (f.id_anio_escolar ? f : { ...f, id_anio_escolar: String(vigente.id) }))
  }, [anios, setFiltros])

  /**
   * Los PA que ofrece el filtro salen del COLEGIO y del AÑO.
   *
   * No hay un catálogo global de periodos: cada colegio tiene su calendario, y
   * un PA puede estar cerrado en uno y abierto en otro. Es el mismo endpoint
   * que usa el modal de otorgar.
   */
  const { data: opcionesPeriodo } = useQuery({
    queryKey: ['permisos', 'opciones', borrador.id_colegio, borrador.id_anio_escolar],
    queryFn: () => opcionesDePermiso({ idColegio: borrador.id_colegio, idAnioEscolar: borrador.id_anio_escolar }),
    enabled: Boolean(borrador.id_colegio && enLinea),
  })
  const periodos = opcionesPeriodo?.periodos ?? []

  const consulta = useQuery({
    queryKey: ['permisos', idUsuario, filtros],
    queryFn: () => listarPermisos(idUsuario, filtros),
    enabled: Boolean(idUsuario) && enLinea,
  })

  const revocar = useMutation({
    mutationFn: ({ idPermiso, motivo }) => {
      setErrorRevocacion(undefined)
      return revocarPermiso(idUsuario, idPermiso, motivo)
    },
    onSuccess: () => {
      setViendo(null)
      setRevocando(null)
      queryClient.invalidateQueries({ queryKey: ['permisos', idUsuario] })
      // El literal de CU028, sin añadirle nada (D62).
      toast.success('Permiso de corrección revocado correctamente.')
    },
    onError: (error) => {
      /**
       * El motivo vacío se señala DEBAJO de su campo; lo demás arriba.
       *
       * Y hay dos casos que no son errores que corregir sino cambios de
       * estado: otro Supervisor lo revocó antes, o el permiso venció
       * mientras se escribía. Ahí se cierra, se refresca y se dice qué pasó.
       */
      const motivoError = motivoDe(error)
      if (motivoError === 'permiso_ya_revocado' || motivoError === 'permiso_vencido') {
        setRevocando(null)
        queryClient.invalidateQueries({ queryKey: ['permisos', idUsuario] })
        toast.info(
          motivoError === 'permiso_ya_revocado'
            ? 'El permiso ya fue revocado. Se actualizó su información.'
            : 'El permiso ya venció y no requiere revocación.',
        )
        return
      }

      const porCampo = erroresDeCampo(error)
      if (porCampo.motivo) {
        setErrorRevocacion(porCampo.motivo)
        return
      }
      toast.error('No se pudo revocar', mensajeDeError(error))
    },
  })

  if (!enLinea) {
    return (
      <Card>
        <EmptyState
          icon={WifiOff}
          title="Los permisos de corrección requieren conexión"
          description="Conéctate a internet para consultar u otorgar permisos."
        />
      </Card>
    )
  }

  const cambiar = (campo, valor) => setBorrador((b) => ({ ...b, [campo]: valor }))
  const limpiar = () => {
    setBorrador(SIN_FILTROS)
    setFiltros(SIN_FILTROS)
  }

  const activo = docente?.activo !== false

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          iconLeft={Plus}
          disabled={!activo}
          onClick={() => setOtorgando(true)}
          // CU028: con la cuenta inactiva el botón se ve DESHABILITADO, no se
          // esconde, y el motivo va al lado en texto visible.
        >
          Otorgar permiso
        </Button>
      </div>
      {!activo && (
        <p className="-mt-2 text-right text-sm text-warning-600">
          Activa la cuenta del Docente para otorgarle un permiso.
        </p>
      )}

      <Card padded={false}>
        <BarraDeFiltros onFiltrar={() => setFiltros(borrador)} onLimpiar={limpiar}>
          <CeldaFiltro>
            <Select
              label="Año escolar"
              placeholder="Todos"
              value={borrador.id_anio_escolar}
              options={anios.map((a) => ({ value: String(a.id), label: a.nombre }))}
              onChange={(e) => cambiar('id_anio_escolar', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Colegio"
              placeholder="Todos"
              value={borrador.id_colegio}
              options={colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre }))}
              onChange={(e) => cambiar('id_colegio', e.target.value)}
            />
          </CeldaFiltro>
          {/*
            D77 — Faltaba, y CU028 lo lista entre los cinco filtros. Sus
            opciones dependen del COLEGIO y del AÑO, porque cada colegio tiene
            su calendario: sin esos dos elegidos no hay periodos que ofrecer.
          */}
          <CeldaFiltro>
            <Select
              label="Periodo académico"
              placeholder={borrador.id_colegio ? 'Todos' : 'Elige un colegio'}
              value={borrador.id_periodo_academico}
              disabled={!borrador.id_colegio}
              options={periodos.map((pa) => ({ value: String(pa.id), label: pa.nombre }))}
              onChange={(e) => cambiar('id_periodo_academico', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Módulo"
              placeholder="Todos"
              value={borrador.modulo}
              options={MODULOS_PERMISO}
              onChange={(e) => cambiar('modulo', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Estado del permiso"
              placeholder="Todos"
              value={borrador.estado}
              options={ESTADOS_PERMISO}
              onChange={(e) => cambiar('estado', e.target.value)}
            />
          </CeldaFiltro>
        </BarraDeFiltros>

        {consulta.isError ? (
          <EmptyState title="No se pudieron cargar los permisos" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data?.items ?? []}
            getRowId={(p) => p.id}
            empty={
              <EmptyState
                icon={KeyRound}
                title="Sin permisos de corrección"
                description="No hay permisos de corrección para los filtros seleccionados."
              />
            }
            columns={[
              { key: 'anio_escolar', header: 'Año escolar', render: (p) => texto(p.anio_escolar) },
              { key: 'colegio', header: 'Colegio', render: (p) => texto(p.colegio) },
              { key: 'grado', header: 'Grado', render: (p) => texto(p.grado) },
              { key: 'periodo', header: 'Periodo', render: (p) => texto(p.periodo) },
              { key: 'modulo', header: 'Módulo', render: (p) => ETIQUETA_MODULO[p.modulo] ?? p.modulo },
              // Las horas, como pide CU028, en la oficial del Perú.
              { key: 'inicio', header: 'Inicio de vigencia', render: (p) => formatearFechaHora(p.inicio) },
              { key: 'fin', header: 'Fin de vigencia', render: (p) => formatearFechaHora(p.fin) },
              {
                key: 'estado',
                header: 'Estado',
                render: (p) => (
                  <Badge tone={TONO_ESTADO_PERMISO[p.estado] ?? 'neutral'}>
                    {ETIQUETA_ESTADO_PERMISO[p.estado] ?? p.estado}
                  </Badge>
                ),
              },
              {
                key: 'acciones',
                header: 'Acciones',
                render: (p) => (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setViendo(p)}>
                      Ver permiso
                    </Button>
                    {/*
                      D77 — "Revocar" vivía DENTRO de "Ver permiso". CU028 la
                      pone en la columna Acciones, y solo para los permisos
                      que todavía se pueden revocar: uno vencido o ya revocado
                      no admite otra revocación.
                    */}
                    {['programado', 'vigente'].includes(p.estado) && (
                      <Button size="sm" variant="ghost" className="text-danger-600" onClick={() => setRevocando(p)}>
                        Revocar
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <DetallePermiso permiso={viendo} idUsuario={idUsuario} onCerrar={() => setViendo(null)} />

      <ModalRevocarPermiso
        permiso={revocando}
        docente={docente}
        revocando={revocar.isPending}
        error={errorRevocacion}
        onRevocar={(motivo) => revocar.mutate({ idPermiso: revocando.id, motivo })}
        onCerrar={() => {
          setRevocando(null)
          setErrorRevocacion(undefined)
        }}
      />

      <ModalOtorgarPermiso
        abierto={otorgando}
        idUsuario={idUsuario}
        docente={docente}
        colegios={colegios}
        asignados={asignados}
        // CU028: el modal precarga el año que se está consultando, si sigue
        // disponible. Casi siempre se otorga para lo que se acaba de mirar.
        idAnioEscolar={filtros.id_anio_escolar}
        onCerrar={() => setOtorgando(false)}
        onOtorgado={(otorgado) => {
          setOtorgando(false)
          queryClient.invalidateQueries({ queryKey: ['permisos', idUsuario] })
          toast.success(
            'Permiso de corrección otorgado correctamente.',
            otorgado && !coincideConFiltros(otorgado, filtros) ? NO_COINCIDE_CON_FILTROS : undefined,
          )
        }}
      />

      {/* Un permiso no se edita ni se borra: solo se otorga y se revoca. */}
      {consulta.data?.items?.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <ShieldOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Un permiso no se modifica ni se elimina: para retirarlo, revócalo.
        </p>
      )}
    </div>
  )
}
