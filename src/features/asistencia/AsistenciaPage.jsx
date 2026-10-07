// Cubre: RF-012, RN-006, RNF-001 · Sección "Asistencia" (T30).
//
// Grilla por FECHA, no por semana: es lo que la diferencia del reporte de
// lectura. Si no existe grilla para esa fecha no se inventa ninguna ni se copia
// de otro día: se ofrece crearla, y nace con las filas vacías.
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import AvisoActividades from '../../components/layout/AvisoActividades'
import FilaAsistencia from './FilaAsistencia'
import useFiltrosAsistencia from './useFiltrosAsistencia'
import { useToast } from '../../components/ui/Toast'
import { crearGrillaAsistencia, guardarAsistencia, obtenerGrillaAsistencia } from '../../api/resources/asistencia'
import { listarDocentes, listarSecciones } from '../../api/resources/administracion'
import { useColegios, useGrados } from '../../hooks/useCatalogos'
import { mensajeDeError } from '../../api/client'
import { ACCION, puede } from '../../auth/permisos'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }
const CICLOS = [
  { value: 1, label: 'Ciclo III' },
  { value: 2, label: 'Ciclo IV' },
  { value: 3, label: 'Ciclo V' },
]

export default function AsistenciaPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const conActividades = Boolean(useActividadStore((s) => s.sesion))
  const puedeEditar = puede('asistencia', idRol, ACCION.EDITAR)
  const soloLectura = !puedeEditar || !conActividades

  const { filtros, cambiar } = useFiltrosAsistencia()
  const [borrador, setBorrador] = useState(null)

  // Los colegios y grados salen del catálogo compartido, el mismo del que sale
  // la grilla. Si vinieran de administración podrían no coincidir y el docente
  // elegiría un colegio sin alumnos que mostrar.
  const { data: colegios = [] } = useColegios()
  const { data: grados = [] } = useGrados()

  // T22: el Supervisor ve la asistencia de todos, así que elige de quién.
  const { data: docentes = [] } = useQuery({
    queryKey: ['admin', 'docentes'],
    queryFn: listarDocentes,
    enabled: !puedeEditar,
    ...SIEMPRE,
  })
  const { data: secciones = [] } = useQuery({
    queryKey: ['admin', 'secciones', filtros.idColegio],
    queryFn: () => listarSecciones(filtros.idColegio),
    enabled: Boolean(filtros.idColegio),
  })

  /**
   * Un `<select>` sin marcador de posición PINTA la primera opción aunque el
   * estado esté vacío: la pantalla decía "I.E. 86021 Ranrahirca" mientras el
   * filtro seguía sin colegio, y la grilla no cargaba nunca. Se elige el
   * primero de verdad, igual que hacen las demás grillas.
   */
  useEffect(() => {
    if (!filtros.idColegio && colegios.length) cambiar('colegio', String(colegios[0].id_colegio))
  }, [colegios, filtros.idColegio, cambiar])

  useEffect(() => {
    if (!filtros.idGrado && grados.length) cambiar('grado', String(grados[0].id_grado))
  }, [grados, filtros.idGrado, cambiar])

  const listos = Boolean(filtros.idColegio && filtros.idGrado && filtros.fecha)

  const grilla = useQuery({
    queryKey: ['asistencia', filtros],
    queryFn: () => obtenerGrillaAsistencia(filtros),
    enabled: listos,
  })

  const filas = useMemo(() => borrador ?? grilla.data?.filas ?? [], [borrador, grilla.data])

  const crear = useMutation({
    mutationFn: () => crearGrillaAsistencia(filtros),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asistencia'] })
      toast.success('Grilla creada', 'Las filas nacen vacías: no se copian de otra fecha.')
    },
    onError: (error) => toast.error('No se pudo crear la grilla', mensajeDeError(error)),
  })

  const guardar = useMutation({
    mutationFn: () => guardarAsistencia({ clave: grilla.data.clave, filas }),
    onSuccess: () => {
      setBorrador(null)
      queryClient.invalidateQueries({ queryKey: ['asistencia'] })
      toast.success('Asistencia guardada')
    },
    onError: (error) => toast.error('No se pudo guardar', mensajeDeError(error)),
  })

  const editarFila = (idAlumno, cambios) =>
    setBorrador(filas.map((f) => (f.id_alumno === idAlumno ? { ...f, ...cambios } : f)))

  const opciones = (lista, clave) => lista.map((x) => ({ value: x[clave], label: x.nombre }))

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Asistencia</h1>
      </header>

      {puedeEditar && !conActividades && <AvisoActividades />}

      {/* El orden de los filtros es el que pide T30 y no es casual: cada uno
          acota al siguiente, así el docente no ve opciones que no le tocan. */}
      <FilterBar>
        {!puedeEditar && (
          <Select
            label="Docente"
            value={filtros.idDocente ?? ''}
            placeholder="Todos"
            onChange={(e) => cambiar('docente', e.target.value)}
            options={docentes.map((d) => ({ value: d.id_docente, label: d.nombre }))}
          />
        )}
        <Select label="Colegio" value={filtros.idColegio} onChange={(e) => cambiar('colegio', e.target.value)} options={opciones(colegios, 'id_colegio')} />
        <Select label="Ciclo" value={filtros.idCiclo} placeholder="Todos" onChange={(e) => cambiar('ciclo', e.target.value)} options={CICLOS} />
        <Select label="Grado" value={filtros.idGrado} onChange={(e) => cambiar('grado', e.target.value)} options={opciones(grados, 'id_grado')} />
        <Select
          label="Sección"
          value={filtros.idSeccion}
          placeholder="Todas"
          onChange={(e) => cambiar('seccion', e.target.value)}
          options={opciones(secciones, 'id_seccion')}
        />
        <Input label="Fecha" type="date" value={filtros.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
      </FilterBar>

      {!listos && (
        <Card>
          <EmptyState title="Elija colegio, grado y fecha" description="La grilla se arma con esos tres datos." />
        </Card>
      )}

      {listos && !grilla.isLoading && !grilla.data && (
        <Card>
          <EmptyState
            icon={CalendarPlus}
            title="No existe una grilla registrada para esta fecha"
            description="Se creará con una fila por alumno, sin datos de otros días."
            action={
              puedeEditar && conActividades ? (
                <Button loading={crear.isPending} onClick={() => crear.mutate()}>
                  Crear grilla para esta fecha
                </Button>
              ) : null
            }
          />
        </Card>
      )}

      {listos && grilla.data && (
        <Card
          title="Asistencia del día"
          padded={false}
          actions={
            soloLectura ? null : (
              <Button loading={guardar.isPending} disabled={!borrador} onClick={() => guardar.mutate()}>
                Guardar asistencia
              </Button>
            )
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3 text-left">Estudiante</th>
                  <th className="px-4 py-3 text-center">Asistencia</th>
                  <th className="px-4 py-3 text-left">Observación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <FilaAsistencia key={fila.id_alumno} fila={fila} soloLectura={soloLectura} onCambio={editarFila} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
