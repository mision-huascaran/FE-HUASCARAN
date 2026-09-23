// Cubre: RF-002, RF-003, RF-004, RF-007, RF-010, RN-001, RN-004, RN-019
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, ClipboardList, Plane, UserCircle2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Switch from '../../components/ui/Switch'
import { listarAlumnos } from '../../api/resources/alumnos'
import { obtenerAsignaciones } from '../../api/resources/docentes'
import { useColegios, useGrados, useNivelesRazkids, useProgramas } from '../../hooks/useCatalogos'
import useFiltrosStore from '../../store/filtrosStore'
import useSessionStore from '../../store/sessionStore'
import { ROLES } from '../../auth/roles'
import columnasEstudiantes from './columnasEstudiantes'

export default function EstudiantesPage() {
  const idRol = useSessionStore((s) => s.usuario?.id_rol)
  const idDocente = useSessionStore((s) => s.usuario?.id_docente)
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const navegar = useNavigate()

  const esProfesor = idRol === ROLES.PROFESOR
  const [verOtros, setVerOtros] = useState(false)
  const [filtros, setFiltros] = useState({ colegio: '', grado: '', aula: '', programa: '', estado: '', q: '' })
  const [alumnoAccion, setAlumnoAccion] = useState(null)
  const [formularioAlumno, setFormularioAlumno] = useState(null)

  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()
  const { data: programas = [] } = useProgramas()
  const { data: catalogoRazkids = [] } = useNivelesRazkids()

  // RN-001 / §5: el Profesor ve por defecto solo los colegios que tiene asignados.
  const { data: asignaciones = [] } = useQuery({
    queryKey: ['asignaciones', idDocente, idPeriodo],
    queryFn: () => obtenerAsignaciones(idDocente, idPeriodo),
    enabled: Boolean(esProfesor && idDocente && idPeriodo),
  })

  const idsAsignados = useMemo(() => new Set(asignaciones.map((a) => a.id_colegio)), [asignaciones])

  const colegiosVisibles = esProfesor && !verOtros
    ? colegios.filter((c) => idsAsignados.has(c.id_colegio))
    : colegios

  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ['alumnos', filtros],
    queryFn: () => listarAlumnos(filtros),
  })

  // RF-003: en modo consulta el Profesor ve otros colegios, pero solo de lectura.
  const enModoConsulta =
    esProfesor && verOtros && Boolean(filtros.colegio) && !idsAsignados.has(Number(filtros.colegio))

  const filas = useMemo(() => {
    const permitidos = new Set(colegiosVisibles.map((c) => c.id_colegio))
    const visibles = alumnos.filter((a) => permitidos.has(a.id_colegio))
    if (!filtros.aula) return visibles
    return visibles.filter((a) => a.aula === filtros.aula)
  }, [alumnos, colegiosVisibles, filtros.aula])

  const cambiar = (clave) => (e) => setFiltros((f) => ({ ...f, [clave]: e.target.value }))

  const abrirFormularioAlumno = (alumno) => {
    setFormularioAlumno({
      id_alumno: alumno?.id_alumno ?? '',
      nombre: alumno?.nombre ?? '',
      codigo: alumno?.codigo ?? '',
      colegio: alumno?.colegio ?? '',
      grado: alumno?.id_grado ?? '',
      aula: alumno?.aula ?? '',
      programa: alumno?.id_programa ?? '',
      observacion: '',
    })
    setAlumnoAccion(alumno)
  }

  const columnas = columnasEstudiantes({ programas, catalogoRazkids, onAccion: abrirFormularioAlumno })

  const cerrarFormularioAlumno = () => {
    setAlumnoAccion(null)
    setFormularioAlumno(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Estudiantes</h1>
        <p className="mt-1 text-sm text-ink-500">
          Cada estudiante se identifica por su código del sistema, no por el número de lista.
        </p>
      </header>

      {enModoConsulta && <AvisoModoConsulta />}

      {/* RF-003: interruptor para consultar colegios no asignados, en solo lectura. */}
      {esProfesor && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-0 p-4 shadow-card">
          <div>
            <p className="text-sm font-semibold text-ink-900">Ver otros colegios (solo lectura)</p>
            <p className="text-xs text-ink-500">
              Por defecto solo aparecen los colegios que tiene asignados en el periodo vigente.
            </p>
          </div>
          <Switch
            checked={verOtros}
            onChange={setVerOtros}
            label="Ver otros colegios en modo consulta"
          />
        </div>
      )}

      <FilterBar
        search={filtros.q}
        onSearchChange={(valor) => setFiltros((f) => ({ ...f, q: valor }))}
        searchPlaceholder="Buscar por nombre o código"
        onClear={() => setFiltros({ colegio: '', grado: '', aula: '', programa: '', estado: '', q: '' })}
        activeCount={Object.values(filtros).filter(Boolean).length}
      >
        <Select
          label="Colegio"
          value={filtros.colegio}
          onChange={cambiar('colegio')}
          placeholder="Todos"
          options={colegiosVisibles.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={filtros.grado}
          onChange={cambiar('grado')}
          placeholder="Todos"
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre }))}
        />
        <Select
          label="Aula"
          value={filtros.aula}
          onChange={cambiar('aula')}
          placeholder="Todas"
          options={[{ value: 'A', label: 'Aula A' }, { value: 'B', label: 'Aula B' }]}
        />
        <Select
          label="Programa"
          value={filtros.programa}
          onChange={cambiar('programa')}
          placeholder="Todos"
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
      </FilterBar>

      <Card padded={false}>
        <DataTable
          columns={columnas}
          rows={filas}
          loading={isLoading}
          getRowId={(a) => a.id_alumno}
          initialPageSize={25}
          stickyFirstColumn
          empty={
            <EmptyState
              icon={UserCircle2}
              title="Sin estudiantes"
              description="Ningún estudiante coincide con los filtros seleccionados."
            />
          }
          footNote="Ley N.° 29733: el sistema solo muestra nombre, código y datos académicos del estudiante."
        />
      </Card>

      <Modal
        open={Boolean(alumnoAccion)}
        onClose={cerrarFormularioAlumno}
        title={alumnoAccion ? `Estudiante · ${alumnoAccion.nombre}` : 'Estudiante'}
        subtitle="Actualiza los datos básicos del alumno y accede a sus capturas principales."
        size="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={cerrarFormularioAlumno}>Cancelar</Button>
            <Button onClick={() => {
              if (!formularioAlumno) return
              cerrarFormularioAlumno()
            }}>Guardar</Button>
          </>
        }
      >
        {formularioAlumno && (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Código" value={formularioAlumno.codigo} onChange={(e) => setFormularioAlumno((f) => ({ ...f, codigo: e.target.value }))} />
              <Input label="Nombre completo" value={formularioAlumno.nombre} onChange={(e) => setFormularioAlumno((f) => ({ ...f, nombre: e.target.value }))} />
              <Input label="Colegio" value={formularioAlumno.colegio} onChange={(e) => setFormularioAlumno((f) => ({ ...f, colegio: e.target.value }))} />
              <Input label="Aula" value={formularioAlumno.aula} onChange={(e) => setFormularioAlumno((f) => ({ ...f, aula: e.target.value }))} />
              <div className="md:col-span-2">
                <Select
                  label="Grado"
                  value={String(formularioAlumno.grado)}
                  onChange={(e) => setFormularioAlumno((f) => ({ ...f, grado: e.target.value }))}
                  options={grados.map((g) => ({ value: String(g.id_grado), label: g.nombre }))}
                />
              </div>
              <div className="md:col-span-2">
                <Select
                  label="Programa"
                  value={String(formularioAlumno.programa)}
                  onChange={(e) => setFormularioAlumno((f) => ({ ...f, programa: e.target.value }))}
                  options={programas.map((p) => ({ value: String(p.id_programa), label: p.nombre }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-ink-700">Observación</label>
                <textarea
                  value={formularioAlumno.observacion}
                  onChange={(e) => setFormularioAlumno((f) => ({ ...f, observacion: e.target.value }))}
                  className="min-h-[88px] w-full rounded-lg border border-line bg-surface-0 px-3 py-2 text-sm text-ink-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  placeholder="Observaciones del estudiante"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!alumnoAccion) return
                  navegar(`/reporte-semanal?colegio=${alumnoAccion.id_colegio}&grado=${alumnoAccion.id_grado}`)
                  cerrarFormularioAlumno()
                }}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-0 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">Reporte semanal</p>
                    <p className="text-xs text-ink-500">Captura la semana del alumno.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand-700">Abrir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!alumnoAccion) return
                  navegar(`/registro-vuelo?colegio=${alumnoAccion.id_colegio}&grado=${alumnoAccion.id_grado}`)
                  cerrarFormularioAlumno()
                }}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-0 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <Plane className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">Registro de vuelo</p>
                    <p className="text-xs text-ink-500">Histórico y evaluaciones del alumno.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand-700">Abrir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!alumnoAccion) return
                  navegar(`/estudiantes/${alumnoAccion.id_alumno}`)
                  cerrarFormularioAlumno()
                }}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-0 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                    <UserCircle2 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">Ficha del estudiante</p>
                    <p className="text-xs text-ink-500">Ver evolución, niveles y contexto.</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand-700">Abrir</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
