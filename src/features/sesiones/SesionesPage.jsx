// Cubre: RF-002 · Sección "Sesiones" de la matriz (CU023, CU025).
//
// Solo lectura. El Docente ve las suyas; el Supervisor, las de todos los
// docentes con filtro por docente — es lo que el documento llama Seguimiento.
//
// Se alimenta de la auditoría: cada sesión de actividades agrupa los cambios
// que se hicieron dentro de ella, con su hora de captura y la de recepción.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import DetalleSesion from './DetalleSesion'
import { listarSesiones } from '../../api/resources/sesiones'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'
import { alcanceDe } from '../../auth/permisos'
import useSessionStore from '../../store/sessionStore'

const TONO_ESTADO = { abierta: 'info', cerrada: 'neutral', pendiente: 'warning' }

export default function SesionesPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const todas = alcanceDe('sesiones', idRol) === 'todos'
  // T20: el Supervisor filtra por docente, colegio y fecha.
  const [filtros, setFiltros] = useState({ idDocente: '', idColegio: '', fecha: '' })
  const [abierta, setAbierta] = useState(null)

  const consulta = useQuery({
    queryKey: ['sesiones', { todas, ...filtros }],
    queryFn: () =>
      listarSesiones({
        todas,
        idDocente: filtros.idDocente || undefined,
        idColegio: filtros.idColegio || undefined,
        fecha: filtros.fecha || undefined,
      }),
  })

  const cambiar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }))

  const unicos = (clave, etiqueta) =>
    [...new Map((consulta.data ?? []).map((s) => [s[clave], s[etiqueta]])).entries()]
      .filter(([id]) => id)
      .map(([value, label]) => ({ value, label }))

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Sesiones</h1>
      </header>

      <Card padded={false}>
        {todas && (
          <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
            <Select
              label="Docente"
              className="min-w-[200px]"
              value={filtros.idDocente}
              placeholder="Todos"
              options={unicos('id_docente', 'docente')}
              onChange={(e) => cambiar('idDocente', e.target.value)}
            />
            <Select
              label="Colegio"
              className="min-w-[200px]"
              value={filtros.idColegio}
              placeholder="Todos"
              options={unicos('id_colegio', 'colegio')}
              onChange={(e) => cambiar('idColegio', e.target.value)}
            />
            <Input
              label="Fecha"
              type="date"
              className="min-w-[160px]"
              value={filtros.fecha}
              onChange={(e) => cambiar('fecha', e.target.value)}
            />
          </div>
        )}

        {consulta.isError ? (
          <EmptyState title="No se pudieron cargar las sesiones" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data ?? []}
            getRowId={(s) => s.id}
            initialPageSize={10}
            empty={
              <EmptyState
                icon={History}
                title="Sin sesiones registradas"
                description="Las sesiones aparecen al pulsar «Iniciar actividades»."
              />
            }
            columns={[
              { key: 'id', header: 'Identificador', className: 'font-mono text-xs' },
              ...(todas ? [{ key: 'docente', header: 'Docente', sortable: true }] : []),
              { key: 'colegio', header: 'Colegio', render: (s) => s.colegio ?? '—' },
              { key: 'inicio', header: 'Inicio', render: (s) => formatearFechaHora(s.inicio) },
              { key: 'fin', header: 'Fin', render: (s) => (s.fin ? formatearFechaHora(s.fin) : '—') },
              {
                key: 'estado',
                header: 'Estado',
                align: 'center',
                render: (s) => <Badge tone={TONO_ESTADO[s.estado] ?? 'neutral'}>{s.estado}</Badge>,
              },
              { key: 'cambios', header: 'Cambios', align: 'center', render: (s) => s.cambios ?? 0 },
              {
                key: 'detalle',
                header: '',
                align: 'right',
                render: (s) => (
                  <Button size="sm" variant="ghost" aria-label={`Ver el detalle de la sesión ${s.id}`} onClick={() => setAbierta(s)}>
                    Ver detalle
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <DetalleSesion sesion={abierta} onCerrar={() => setAbierta(null)} />
    </div>
  )
}
