// Plantilla de mantenimiento (T16): una sola implementación para Alumnos,
// Usuarios y Colegios.
//
// Flujo básico: la grilla abre SIEMPRE filtrada por Estado = Activo y por el
// alcance del rol. Las acciones salen de la matriz de permisos, no de
// condicionales por pantalla: si la matriz no da `N`, no hay botón de Nuevo.
//
// Nunca se borra un registro: `Inactivar` cambia el estado y deja auditoría.
import { useMemo, useState } from 'react'
import { Ban, Eye, Pencil, Plus, RotateCcw } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Card from '../ui/Card'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import RequiereConexion from '../layout/RequiereConexion'
import ConfirmarEstado from './ConfirmarEstado'
import FiltrosMantenimiento from './FiltrosMantenimiento'
import PopupMantenimiento from './PopupMantenimiento'
import { ACCION, puede } from '../../auth/permisos'
import { mensajeDeError } from '../../api/client'
import useSessionStore from '../../store/sessionStore'


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
  guardando = false,
  soloOnline = false,
  sinConexion = false,
}) {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const [popup, setPopup] = useState(null)
  // S4 — Inactivar/Activar pide confirmación: cambia el estado de un registro
  // que otros pueden estar usando, y conviene que sea deliberado.
  const [confirmando, setConfirmando] = useState(null)

  const puedeCrear = puede(seccion, idRol, ACCION.NUEVO)
  const puedeEditar = puede(seccion, idRol, ACCION.EDITAR)
  const puedeInactivar = puede(seccion, idRol, ACCION.INACTIVAR)
  const puedeAuditar = puede(seccion, idRol, ACCION.AUDITORIA)

  // E4 de la plantilla. Hay dos comportamientos distintos sin conexión:
  //   · `soloOnline` (Usuarios, Colegios) → pantalla "Requiere conexión".
  //   · lectura en caché (Alumnos) → se ve la lista, sin botones de escritura.
  const bloqueado = sinConexion
  const sinPantalla = soloOnline && sinConexion

  const columnasConAcciones = useMemo(() => {
    const acciones = {
      key: 'acciones',
      header: 'Acciones',
      align: 'center',
      render: (fila) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            iconLeft={Eye}
            aria-label={`Visualizar ${fila.nombre ?? entidad}`}
            onClick={() => setPopup({ modo: 'ver', registro: fila })}
          >
            Ver
          </Button>
          {puedeEditar && !bloqueado && (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={Pencil}
              aria-label={`Editar ${fila.nombre ?? entidad}`}
              onClick={() => setPopup({ modo: 'editar', registro: fila })}
            >
              Editar
            </Button>
          )}
          {puedeInactivar && !bloqueado && (
            <Button
              size="sm"
              variant="ghost"
              iconLeft={fila.activo === false ? RotateCcw : Ban}
              className={fila.activo === false ? undefined : 'text-danger-600'}
              aria-label={`${fila.activo === false ? 'Activar' : 'Inactivar'} ${fila.nombre ?? entidad}`}
              onClick={() => setConfirmando({ fila, activo: fila.activo === false })}
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
  }, [columnas, entidad, puedeEditar, puedeInactivar, bloqueado])

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
        {puedeCrear && !bloqueado && (
          <Button iconLeft={Plus} onClick={() => setPopup({ modo: 'nuevo', registro: null })}>
            Nuevo
          </Button>
        )}
      </header>

      <Card padded={false}>
        <FiltrosMantenimiento filtros={filtros} valores={valoresFiltro} onCambio={onFiltro} />

        {consulta.isError ? (
          <EmptyState title={`No se pudieron cargar los ${entidad.toLowerCase()}s`} description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data ?? []}
            getRowId={(f) => f.id ?? f[`id_${seccion.replace(/s$/, '')}`] ?? f.id_usuario}
            initialPageSize={10}
            columns={columnasConAcciones}
          />
        )}
      </Card>

      <ConfirmarEstado
        peticion={confirmando}
        entidad={entidad}
        onCancelar={() => setConfirmando(null)}
        onConfirmar={() => {
          onCambiarEstado(confirmando.fila, confirmando.activo)
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
        onGuardar={(valores) => onGuardar(valores, popup)}
        onCerrar={() => setPopup(null)}
      />
    </div>
  )
}
