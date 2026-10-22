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
//   · TODO EXIGE CONEXIÓN. No hay versión offline de esto ni debe haberla:
//     autorizar una corrección es un acto administrativo, no trabajo de aula.
import { useState } from 'react'
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
import ModalOtorgarPermiso from './ModalOtorgarPermiso'
import {
  ESTADOS_PERMISO,
  ETIQUETA_ESTADO_PERMISO,
  ETIQUETA_MODULO,
  MODULOS_PERMISO,
  TONO_ESTADO_PERMISO,
  listarPermisos,
  revocarPermiso,
} from '../../api/resources/permisos'
import { listarAniosEscolares } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'
import useConexion from '../../hooks/useConexion'

const SIN_FILTROS = { id_anio_escolar: '', id_colegio: '', id_periodo_academico: '', modulo: '', estado: '' }

/** El backend manda `{id, nombre}` donde la tabla quiere un texto. */
const texto = (valor) => (valor != null && typeof valor === 'object' ? (valor.nombre ?? '—') : (valor ?? '—'))

export default function PermisosDeCorreccion({ docente, colegios = [] }) {
  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()

  const [borrador, setBorrador] = useState(SIN_FILTROS)
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  const [viendo, setViendo] = useState(null)
  const [otorgando, setOtorgando] = useState(false)

  const idUsuario = docente?.id_usuario ?? docente?.id

  const { data: anios = [] } = useQuery({
    queryKey: ['catalogo', 'anios-escolares'],
    queryFn: listarAniosEscolares,
    staleTime: Infinity,
  })

  const consulta = useQuery({
    queryKey: ['permisos', idUsuario, filtros],
    queryFn: () => listarPermisos(idUsuario, filtros),
    enabled: Boolean(idUsuario) && enLinea,
  })

  const revocar = useMutation({
    mutationFn: ({ idPermiso, motivo }) => revocarPermiso(idUsuario, idPermiso, motivo),
    onSuccess: () => {
      setViendo(null)
      queryClient.invalidateQueries({ queryKey: ['permisos', idUsuario] })
      toast.success('Permiso revocado', 'El Docente ya no puede corregir con esta autorización.')
    },
    onError: (error) => toast.error('No se pudo revocar', mensajeDeError(error)),
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
                header: '',
                render: (p) => (
                  <Button size="sm" variant="ghost" onClick={() => setViendo(p)}>
                    Ver permiso
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <DetallePermiso
        permiso={viendo}
        idUsuario={idUsuario}
        revocando={revocar.isPending}
        onRevocar={(motivo) => revocar.mutate({ idPermiso: viendo.id, motivo })}
        onCerrar={() => setViendo(null)}
      />

      <ModalOtorgarPermiso
        abierto={otorgando}
        idUsuario={idUsuario}
        colegios={colegios}
        onCerrar={() => setOtorgando(false)}
        onOtorgado={() => {
          setOtorgando(false)
          queryClient.invalidateQueries({ queryKey: ['permisos', idUsuario] })
          toast.success('Permiso otorgado', 'El Docente ya puede corregir ese periodo.')
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
