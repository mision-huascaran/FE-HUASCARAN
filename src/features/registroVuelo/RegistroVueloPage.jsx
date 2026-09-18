// Cubre: RF-011, RF-020, RF-021, RF-023, RF-024, RN-005, RN-010, RN-011, RN-014, RN-015
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, Plus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import RoleGate from '../../components/ui/RoleGate'
import Select from '../../components/ui/Select'
import DrawerEvaluacion from './DrawerEvaluacion'
import ModalTrazabilidad from './ModalTrazabilidad'
import useHistoricoVuelo from './useHistoricoVuelo'
import columnasHistorico, { LeyendaEstado } from './columnasHistorico'
import { ROLES } from '../../auth/roles'
import { aniosDe } from './constantes'

export default function RegistroVueloPage() {
  const navegar = useNavigate()
  const { catalogos, borrador, setCampo, aplicar, limpiar, activos, filas, cargando, sinColegio } =
    useHistoricoVuelo()
  const [editando, setEditando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const anios = aniosDe(catalogos.periodos)

  const columnas = columnasHistorico({ catalogos, onEditar: setEditando, onVer: setViendo })

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Registro de vuelo</h1>
          <p className="mt-1 text-sm text-ink-500">
            Las cuatro evaluaciones diagnósticas del año, alumno por alumno.
          </p>
        </div>
        <RoleGate allow={[ROLES.PROFESOR]}>
          <Button iconLeft={Plus} onClick={() => navegar('/registro-vuelo/nuevo')}>
            Registrar evaluación
          </Button>
        </RoleGate>
      </header>

      <FilterBar
        search={borrador.q}
        onSearchChange={(valor) => setCampo('q', valor)}
        searchPlaceholder="Buscar alumno por nombre o código"
        onApply={() => aplicar()}
        onClear={limpiar}
        activeCount={activos}
      >
        <Select
          label="Colegio"
          required
          value={borrador.colegio}
          onChange={(e) => setCampo('colegio', e.target.value)}
          placeholder="Seleccione un colegio"
          options={catalogos.colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={borrador.grado}
          onChange={(e) => setCampo('grado', e.target.value)}
          placeholder="Todos"
          options={catalogos.grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
        />
        <Select
          label="Programa"
          value={borrador.programa}
          onChange={(e) => setCampo('programa', e.target.value)}
          placeholder="Todos"
          options={catalogos.programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
        <Select
          label="Año"
          value={anios[0]?.value ?? ''}
          onChange={() => {}}
          options={anios}
          disabled={anios.length <= 1}
          hint="Solo el año lectivo en curso"
        />
        <Select
          label="Periodo"
          value={borrador.periodo}
          onChange={(e) => setCampo('periodo', e.target.value)}
          placeholder="Último registrado"
          options={catalogos.periodos.map((p) => ({ value: p.id_periodo, label: p.nombre }))}
        />
      </FilterBar>

      <Card padded={false}>
        {sinColegio ? (
          <EmptyState
            icon={Plane}
            title="Elija un colegio para ver el histórico"
            description="El registro de vuelo carga por colegio: son 413 estudiantes en total."
          />
        ) : (
          <DataTable
            columns={columnas}
            rows={filas}
            loading={cargando}
            getRowId={(f) => f.id_alumno}
            initialPageSize={10}
            stickyFirstColumn
            footNote={
              <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-semibold text-ink-700">Estados:</span>
                <LeyendaEstado tono="info" texto="Pendiente — aún no confirmada por el docente" />
                <LeyendaEstado tono="success" texto="Revisado — confirmada por el docente" />
                <LeyendaEstado tono="danger" texto="Con error — requiere revisión" />
              </span>
            }
          />
        )}
      </Card>

      <DrawerEvaluacion
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        fila={editando}
        periodos={catalogos.periodos}
        catalogoRazkids={catalogos.catalogoRazkids}
        esperadoPorGrado={catalogos.esperadoPorGrado}
      />

      <ModalTrazabilidad open={Boolean(viendo)} onClose={() => setViendo(null)} fila={viendo} />
    </div>
  )
}
