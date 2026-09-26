import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, ClipboardEdit, PencilLine, Plus, RotateCcw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import {
  actualizarAlumno,
  crearAlumno,
  listarAlumnosAdmin,
  listarAsignaciones,
  listarColegiosAdmin,
  listarGradosAdmin,
  listarProgramasAdmin,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { ROLES } from '../../auth/roles'
import useSessionStore from '../../store/sessionStore'
import Badge from '../../components/ui/Badge'
import ModalAlumno from '../estudiantes/ModalAlumno'

/**
 * Módulo Alumnos (CU008).
 *
 * Quién escribe cambió: **gestiona el Docente, el Supervisor solo consulta**.
 * El backend lo aplica —al Supervisor le responde 403 en `POST`/`PATCH`
 * /alumnos—, así que aquí no se pintan acciones que acabarían en un error.
 *
 * Al Docente el servidor le acota la lista a sus asignaciones vigentes: si no
 * tiene ninguna recibe cero alumnos, y eso es correcto, no un fallo de carga.
 */
export default function TablaAlumnos() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const puedeGestionar = idRol === ROLES.DOCENTE
  /**
   * Los desplegables se piden con las consultas de administración, no con el
   * catálogo compartido: el alta envía estos ids al backend real y tienen que
   * ser los suyos. Ver `listarGradosAdmin` en resources/administracion.js.
   */
  const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }
  const { data: colegios = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'colegios'], queryFn: listarColegiosAdmin, ...SIEMPRE })
  const { data: grados = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'grados'], queryFn: listarGradosAdmin, ...SIEMPRE })
  const { data: programas = [] } = useQuery({ queryKey: ['admin', 'catalogo', 'programas'], queryFn: listarProgramasAdmin, ...SIEMPRE })

  const [form, setForm] = useState({ nombres: '', apellidos: '', id_colegio: '', id_grado: '', id_programa: '' })

  /**
   * El Docente solo puede dar de alta en los colegios y grados que tiene
   * asignados: fuera de ahí el servidor responde
   * «Ese alumno no pertenece a un colegio y grado que tengas asignado».
   * `GET /colegios` ya le llega acotado, pero `GET /grados` devuelve los seis,
   * así que sin este recorte el formulario ofrecía grados que iban a fallar.
   */
  const { data: asignaciones = [] } = useQuery({
    queryKey: ['admin', 'asignaciones'],
    queryFn: listarAsignaciones,
    enabled: puedeGestionar,
  })

  const permitidos = useMemo(() => {
    if (!puedeGestionar) return { colegios, grados }
    if (!asignaciones.length) return { colegios: [], grados: [] }
    const idsColegio = new Set(asignaciones.map((a) => Number(a.id_colegio)))
    const porColegio = Number(form.id_colegio)
    const gradosDe = asignaciones
      .filter((a) => !porColegio || Number(a.id_colegio) === porColegio)
      .map((a) => Number(a.id_grado))
    const idsGrado = new Set(gradosDe)
    return {
      colegios: colegios.filter((c) => idsColegio.has(Number(c.id_colegio))),
      grados: grados.filter((g) => idsGrado.has(Number(g.id_grado))),
    }
  }, [puedeGestionar, asignaciones, colegios, grados, form.id_colegio])
  // `GET /alumnos` viene paginado: la respuesta trae `total` e `items`.
  const [pagina, setPagina] = useState({ limit: 50, offset: 0 })
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'alumnos', pagina],
    queryFn: () => listarAlumnosAdmin(pagina),
    placeholderData: (previos) => previos,
  })
  const total = data?.total ?? 0

  /**
   * `GET /alumnos` devuelve ids, no etiquetas: ni el nombre del colegio, ni el
   * grado, ni el programa, ni un código de alumno (el backend no guarda uno).
   * Se resuelven aquí con los catálogos que esta misma pantalla ya tiene
   * cargados, en lugar de pedirlos otra vez por cada fila.
   */
  const alumnos = useMemo(() => {
    const filas = data?.items ?? []
    const etiqueta = (lista, clave, id) => lista.find((x) => x[clave] === Number(id))?.nombre
    return filas.map((a) => ({
      ...a,
      colegio: a.colegio ?? etiqueta(colegios, 'id_colegio', a.id_colegio) ?? '—',
      grado: a.grado ?? etiqueta(grados, 'id_grado', a.id_grado) ?? '—',
      programa: a.programa ?? etiqueta(programas, 'id_programa', a.id_programa) ?? '—',
      codigo: a.codigo ?? '—',
    }))
  }, [data, colegios, grados, programas])
  // Son 413 alumnos y el backend sirve de a 50: sin estos rangos la pantalla
  // daría a entender que el colegio solo tiene los primeros que llegaron.
  const desde = total ? pagina.offset + 1 : 0
  const hasta = pagina.offset + alumnos.length

  const [abierto, setAbierto] = useState(false)
  // Ventana de captura del alumno: reporte semanal, registro de vuelo y ficha.
  const [enCaptura, setEnCaptura] = useState(null)
  const [editando, setEditando] = useState(null)
  // Sin `aula`: `POST /alumnos` no la guarda. El mock la da por defecto 'A'.

  const cerrar = () => {
    setAbierto(false)
    setEditando(null)
    setForm({ nombres: '', apellidos: '', id_colegio: '', id_grado: '', id_programa: '' })
  }

  const abrirEdicion = (alumno) => {
    setEditando(alumno)
    setForm({
      nombres: alumno.nombres ?? '',
      apellidos: alumno.apellidos ?? '',
      id_colegio: String(alumno.id_colegio ?? ''),
      id_grado: String(alumno.id_grado ?? ''),
      id_programa: String(alumno.id_programa ?? ''),
    })
    setAbierto(true)
  }

  const edicion = useMutation({
    mutationFn: ({ id, cambios }) => actualizarAlumno(id, cambios),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['alumnos'] })
      toast.success('Alumno actualizado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo actualizar el alumno', mensajeDeError(error)),
  })

  const baja = useMutation({
    mutationFn: ({ id, activo }) => actualizarAlumno(id, { activo }),
    onSuccess: (_d, { activo }) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['alumnos'] })
      toast.success(activo ? 'Alumno reactivado' : 'Alumno dado de baja')
    },
    onError: (error) => toast.error('No se pudo cambiar el estado del alumno', mensajeDeError(error)),
  })

  const alta = useMutation({
    mutationFn: crearAlumno,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['alumnos'] })
      toast.success('Alumno registrado')
      cerrar()
    },
    onError: (error) => toast.error('No se pudo registrar el alumno', mensajeDeError(error)),
  })

  const completa = form.nombres.trim() && form.apellidos.trim() && form.id_colegio && form.id_grado && form.id_programa

  return (
    <>
      <Card
        title="Alumnos"
        padded={false}
        actions={
          puedeGestionar ? (
            <Button size="sm" iconLeft={Plus} onClick={() => setAbierto(true)}>
              Nuevo alumno
            </Button>
          ) : null
        }
      >
        <DataTable
          loading={isLoading}
          rows={alumnos}
          getRowId={(a) => a.id_alumno}
          paginated={false}
          footNote={total ? `Mostrando ${desde}-${hasta} de ${total} alumnos` : undefined}
          columns={[
            { key: 'nombre', header: 'Alumno', sortable: true, className: 'font-medium text-ink-900' },
            { key: 'codigo', header: 'Código', align: 'center' },
            { key: 'colegio', header: 'Colegio', sortable: true },
            { key: 'grado', header: 'Grado', align: 'center' },
            { key: 'programa', header: 'Programa', sortable: true },
            {
              key: 'captura',
              header: '',
              align: 'center',
              render: (a) => (
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={ClipboardEdit}
                  aria-label={`Abrir registro de ${a.nombre}`}
                  onClick={() => setEnCaptura(a)}
                >
                  Registro
                </Button>
              ),
            },
            {
              key: 'activo',
              header: 'Estado',
              align: 'center',
              render: (a) => <Badge tone={a.activo === false ? 'neutral' : 'success'}>{a.activo === false ? 'Inactivo' : 'Activo'}</Badge>,
            },
            // La baja es lógica: `PATCH /alumnos/{id}` con activo:false. El
            // borrado definitivo está prohibido, así que no hay botón de borrar.
            ...(puedeGestionar
              ? [
                  {
                    key: 'acciones',
                    header: 'Acciones',
                    align: 'center',
                    render: (a) => (
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" iconLeft={PencilLine} aria-label={`Editar ${a.nombre}`} onClick={() => abrirEdicion(a)}>
                          Editar
                        </Button>
                        {a.activo === false ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={RotateCcw}
                            aria-label={`Reactivar ${a.nombre}`}
                            disabled={baja.isPending}
                            onClick={() => baja.mutate({ id: a.id_alumno, activo: true })}
                          >
                            Reactivar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={Ban}
                            aria-label={`Dar de baja a ${a.nombre}`}
                            disabled={baja.isPending}
                            className="text-danger-600"
                            onClick={() => baja.mutate({ id: a.id_alumno, activo: false })}
                          >
                            Dar de baja
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={pagina.offset === 0 || isLoading}
            onClick={() => setPagina((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={hasta >= total || isLoading}
            onClick={() => setPagina((p) => ({ ...p, offset: p.offset + p.limit }))}
          >
            Siguiente
          </Button>
        </div>
      </Card>

      <ModalAlumno
        alumno={enCaptura}
        abierto={Boolean(enCaptura)}
        onCerrar={() => setEnCaptura(null)}
        soloLectura={!puedeGestionar}
      />

      <Modal
        open={abierto}
        onClose={cerrar}
        title={editando ? 'Editar alumno' : 'Nuevo alumno'}
        subtitle="Un alumno siempre va asociado a un colegio, un grado y un programa"
        footer={
          <>
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            <Button
              disabled={!completa}
              loading={alta.isPending || edicion.isPending}
              onClick={() =>
                editando
                  ? edicion.mutate({
                      id: editando.id_alumno,
                      cambios: {
                        nombres: form.nombres,
                        apellidos: form.apellidos,
                        id_colegio: Number(form.id_colegio),
                        id_grado: Number(form.id_grado),
                        id_programa_actual: Number(form.id_programa),
                      },
                    })
                  : alta.mutate(form)
              }
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombres" required value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
          <Input label="Apellidos" required value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
          <Select label="Colegio" required value={form.id_colegio} onChange={(e) => setForm((f) => ({ ...f, id_colegio: e.target.value }))} placeholder="Seleccione" options={permitidos.colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))} />
          <Select label="Grado" required value={form.id_grado} onChange={(e) => setForm((f) => ({ ...f, id_grado: e.target.value }))} placeholder="Seleccione" options={permitidos.grados.map((g) => ({ value: g.id_grado, label: g.nombre }))} />
          <Select label="Programa" required value={form.id_programa} onChange={(e) => setForm((f) => ({ ...f, id_programa: e.target.value }))} placeholder="Seleccione" options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))} />
        </div>
      </Modal>
    </>
  )
}
