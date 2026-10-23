// CU027 — Calendario académico. Vista interna del módulo de Colegios.
//
// No es una ruta: reemplaza el listado en el área principal y conserva el
// sidebar, igual que el detalle del Docente. "Volver a Colegios" devuelve con
// los filtros y la página intactos, que es la razón de que esto sea estado de
// la pantalla y no una navegación.
//
// LO QUE SE CONFIGURA AQUÍ sostiene medio sistema: de estas fechas salen el
// periodo de cada colegio, qué día es lectivo, cuándo una asignación es
// retroactiva y qué periodos admiten un permiso excepcional. Por eso el
// servidor avisa cuando un cambio dejaría registros ya guardados fuera de su
// periodo —`calendario_incompatible`—, y por eso ese aviso se muestra entero
// en vez de resumirlo en un "no se pudo guardar".
//
// TRES ESTADOS, NO TRES BOTONES A LA VEZ: consulta, creación y edición. El CU
// lo pide expresamente ("no aparecen todos simultáneamente"), y tiene sentido:
// con los cuatro visibles nadie sabe en cuál está.
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Plus, Trash2, TriangleAlert } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import {
  actualizarCalendario,
  crearCalendarioGeneral,
  crearCalendarioParticular,
  nombreDePeriodo,
  obtenerCalendario,
  ochoPeriodos,
  volverAlGeneral,
} from '../../api/resources/calendarios'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { mensajeDeError, motivoDe } from '../../api/client'
import { formatearFecha } from '../../lib/format'
import useConexion from '../../hooks/useConexion'

const ALCANCES = [
  { value: 'general', label: 'General' },
  { value: 'colegio', label: 'Por colegio' },
]

/** Las ocho filas vacías, para empezar a crear uno desde cero. */
const periodosVacios = () => ochoPeriodos([])

/** Solo lo que el contrato acepta de cada periodo. */
const periodosParaGuardar = (periodos) =>
  periodos.map(({ tipo, numero, fecha_inicio, fecha_fin }) => ({ tipo, numero, fecha_inicio, fecha_fin }))

/** Las ocho fechas, completas, y cada día no lectivo con su motivo: un periodo a medias no es un calendario. */
const estaCompleto = (periodos, dias) =>
  periodos.every((p) => p.fecha_inicio && p.fecha_fin) && dias.every((d) => d.motivo?.trim())

/** Lo que se edita al empezar: vacío para crear, lo vigente para editar. */
function borradorPara(modo, calendario) {
  if (modo === 'crear') return { periodos: periodosVacios(), dias: [] }
  return { periodos: ochoPeriodos(calendario?.periodos), dias: calendario?.dias_no_lectivos ?? [] }
}

export default function CalendarioAcademico({ colegios = [], onVolver }) {
  const toast = useToast()
  const enLinea = useConexion()
  const queryClient = useQueryClient()

  const [alcance, setAlcance] = useState('general')
  const [idColegio, setIdColegio] = useState('')
  const [anio, setAnio] = useState('')
  const [modo, setModo] = useState('consulta')
  const [periodos, setPeriodos] = useState(periodosVacios)
  const [dias, setDias] = useState([])
  const [incompatibilidades, setIncompatibilidades] = useState([])

  const { data: anios = [] } = useQuery({
    queryKey: ['catalogo', 'anios-escolares'],
    queryFn: listarAniosEscolares,
    staleTime: Infinity,
  })

  // El año arranca en el vigente. CU027: se inicializa con el año actual.
  useEffect(() => {
    if (!anio && anios.length) setAnio(String(anioVigente(anios)?.id ?? ''))
  }, [anios, anio])

  const porColegio = alcance === 'colegio'
  const colegioConsultado = porColegio ? idColegio : undefined
  const listo = Boolean(anio) && (!porColegio || Boolean(idColegio))

  const consulta = useQuery({
    queryKey: ['calendario', anio, colegioConsultado ?? null],
    queryFn: () => obtenerCalendario({ idAnioEscolar: anio, idColegio: colegioConsultado }),
    enabled: listo && modo === 'consulta',
    retry: false,
  })

  const calendario = consulta.data
  // Un 404 NO es un fallo: es "este año todavía no tiene calendario".
  const sinConfigurar = motivoDe(consulta.error) === 'calendario_no_configurado'

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['calendario'] })

  const alFallar = (error) => {
    // `calendario_incompatible` trae la lista de qué registros estorban. Es
    // una decisión que tomar, no un error que descartar: se muestra entera.
    setIncompatibilidades(error?.response?.data?.incompatibilidades ?? [])
    toast.error('No se pudo guardar el calendario', mensajeDeError(error))
  }

  const alGuardar = (mensaje) => () => {
    setIncompatibilidades([])
    setModo('consulta')
    refrescar()
    toast.success(mensaje, 'Las fechas ya rigen para los módulos que dependen de ellas.')
  }

  const crear = useMutation({
    mutationFn: () => {
      const cuerpo = { id_anio_escolar: Number(anio), periodos: periodosParaGuardar(periodos), dias_no_lectivos: dias }
      return porColegio
        ? crearCalendarioParticular({ ...cuerpo, id_colegio: Number(idColegio) })
        : crearCalendarioGeneral(cuerpo)
    },
    onSuccess: alGuardar('Calendario creado'),
    onError: alFallar,
  })

  const editar = useMutation({
    mutationFn: () =>
      actualizarCalendario(calendario.id_calendario, {
        // La versión que se leyó: si otro la cambió, el servidor responde 409
        // en vez de dejar que este guardado pise el ajeno sin enterarse.
        version: calendario.version,
        periodos: periodosParaGuardar(periodos),
        dias_no_lectivos: dias,
      }),
    onSuccess: alGuardar('Calendario actualizado'),
    onError: alFallar,
  })

  const restablecer = useMutation({
    mutationFn: () => volverAlGeneral(calendario.id_calendario, calendario.version),
    onSuccess: alGuardar('El colegio vuelve al calendario general'),
    onError: alFallar,
  })

  const empezar = (siguiente) => {
    const borrador = borradorPara(siguiente, calendario)
    setIncompatibilidades([])
    setPeriodos(borrador.periodos)
    setDias(borrador.dias)
    setModo(siguiente)
  }

  const editando = modo !== 'consulta'

  const ponerFecha = (i, campo, valor) =>
    setPeriodos((previos) => previos.map((p, n) => (n === i ? { ...p, [campo]: valor } : p)))

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" iconLeft={ArrowLeft} onClick={onVolver} className="self-start">
        Volver a Colegios
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Calendario académico</h1>
          <p className="mt-1 text-sm text-ink-500">
            Los cuatro periodos del año y sus recesos. De estas fechas dependen las asistencias, las
            asignaciones y los permisos de corrección.
          </p>
        </div>

        <AccionesDelCalendario
          modo={modo}
          calendario={calendario}
          sinConfigurar={sinConfigurar}
          porColegio={porColegio}
          enLinea={enLinea}
          restableciendo={restablecer.isPending}
          guardando={crear.isPending || editar.isPending}
          completo={estaCompleto(periodos, dias)}
          onEmpezar={empezar}
          onRestablecer={() => restablecer.mutate()}
          onCancelar={() => setModo('consulta')}
          onGuardar={() => (modo === 'crear' ? crear.mutate() : editar.mutate())}
        />
      </header>

      {!enLinea && (
        <p className="rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700">
          Sin conexión se muestra la última versión guardada, que puede no incluir cambios recientes. Para
          crear o modificar el calendario hace falta conexión.
        </p>
      )}

      <Card padded={false}>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="min-w-[150px] flex-1 basis-[150px]">
            <Select
              label="Año escolar"
              value={anio}
              // En creación queda fijo: cambiarlo a medias dejaría las fechas
              // escritas colgando de otro año (CU027).
              disabled={editando}
              options={anios.map((a) => ({ value: String(a.id), label: a.nombre }))}
              onChange={(e) => setAnio(e.target.value)}
            />
          </div>
          <div className="min-w-[150px] flex-1 basis-[150px]">
            <Select
              label="Alcance"
              value={alcance}
              disabled={editando}
              options={ALCANCES}
              onChange={(e) => {
                setAlcance(e.target.value)
                setIdColegio('')
              }}
            />
          </div>
          {porColegio && (
            <div className="min-w-[150px] flex-1 basis-[150px]">
              <Select
                label="Colegio"
                required
                placeholder="Seleccione"
                value={idColegio}
                disabled={editando}
                options={colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre }))}
                onChange={(e) => setIdColegio(e.target.value)}
              />
            </div>
          )}
        </div>

        <ContenidoDelCalendario
          listo={listo}
          cargando={consulta.isLoading}
          sinConfigurar={sinConfigurar}
          editando={editando}
          porColegio={porColegio}
          calendario={calendario}
          incompatibilidades={incompatibilidades}
          filas={editando ? periodos : ochoPeriodos(calendario?.periodos)}
          dias={editando ? dias : (calendario?.dias_no_lectivos ?? [])}
          onFecha={ponerFecha}
          onDias={setDias}
        />
      </Card>
    </div>
  )
}

/**
 * TRES ESTADOS, NO TRES BOTONES A LA VEZ: en consulta, editar, crear o volver
 * al general según lo que haya; en edición, solo cancelar y guardar.
 */
function AccionesDelCalendario({
  modo,
  calendario,
  sinConfigurar,
  porColegio,
  enLinea,
  restableciendo,
  guardando,
  completo,
  onEmpezar,
  onRestablecer,
  onCancelar,
  onGuardar,
}) {
  if (modo !== 'consulta') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button loading={guardando} disabled={!completo} onClick={onGuardar}>
          Guardar
        </Button>
      </div>
    )
  }

  const origen = calendario?.origen
  const puedeCrear = sinConfigurar || (porColegio && origen === 'general')
  return (
    <div className="flex flex-wrap items-center gap-2">
      {calendario && (
        <Button iconLeft={CalendarDays} disabled={!enLinea} onClick={() => onEmpezar('editar')}>
          Editar calendario
        </Button>
      )}
      {puedeCrear && (
        <Button iconLeft={Plus} disabled={!enLinea} onClick={() => onEmpezar('crear')}>
          {porColegio ? 'Crear fechas particulares' : 'Crear calendario'}
        </Button>
      )}
      {/* Volver al general solo tiene sentido si hoy usa uno particular. */}
      {porColegio && origen === 'particular' && (
        <Button variant="outline" loading={restableciendo} onClick={onRestablecer}>
          Usar el calendario general
        </Button>
      )}
    </div>
  )
}

/** Lo que va debajo de los filtros: un aviso, la carga o el calendario. */
function ContenidoDelCalendario({
  listo,
  cargando,
  sinConfigurar,
  editando,
  porColegio,
  calendario,
  incompatibilidades,
  filas,
  dias,
  onFecha,
  onDias,
}) {
  if (!listo) {
    return <EmptyState title="Complete los filtros" description="Elija el año escolar y, si procede, el colegio." />
  }
  if (cargando) return <Skeleton className="m-4 h-64" />
  if (sinConfigurar && !editando) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Sin calendario configurado"
        description="No hay un calendario académico configurado para este año escolar."
      />
    )
  }

  const particular = calendario?.origen === 'particular'
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Con alcance "Por colegio", decir CUÁL se está viendo: editar
          creyendo que son fechas propias cuando es el general afectaría
          a todos los demás colegios. */}
      {porColegio && calendario && !editando && (
        <p className="flex items-center gap-2 text-sm text-ink-700">
          Este colegio usa
          <Badge tone={particular ? 'info' : 'neutral'}>
            {particular ? 'fechas particulares' : 'el calendario general'}
          </Badge>
        </p>
      )}

      {incompatibilidades.length > 0 && (
        <div className="rounded-xl border border-danger-600/20 bg-danger-100 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-danger-600">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            El cambio afecta a registros existentes
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-700">
            {incompatibilidades.map((x, i) => (
              <li key={`${x.fecha}-${i}`}>
                {x.colegio?.nombre} · {formatearFecha(x.fecha)} · {x.tipo_registro} — {x.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TablaPeriodos filas={filas} editando={editando} onCambio={onFecha} />

      <DiasNoLectivos dias={dias} editando={editando} onCambio={onDias} />
    </div>
  )
}

/** Los ocho periodos. En consulta son texto; en edición, selectores de fecha. */
function TablaPeriodos({ filas, editando, onCambio }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-ink-900">Periodos</h2>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3 text-left">Periodo</th>
              <th className="px-4 py-3 text-left">Fecha de inicio</th>
              <th className="px-4 py-3 text-left">Fecha de fin</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p, i) => (
              <tr key={nombreDePeriodo(p)} className="border-t border-line">
                <td className="px-4 py-2 font-medium text-ink-900">
                  {nombreDePeriodo(p)}
                  {p.tipo === 'PR' && (
                    <span className="ml-2 text-xs font-normal text-ink-500">receso posterior a PA{p.numero}</span>
                  )}
                </td>
                {['fecha_inicio', 'fecha_fin'].map((campo) => (
                  <td key={campo} className="px-4 py-2">
                    {editando ? (
                      <Input
                        type="date"
                        aria-label={`${campo === 'fecha_inicio' ? 'Inicio' : 'Fin'} de ${nombreDePeriodo(p)}`}
                        value={p[campo] ?? ''}
                        onChange={(e) => onCambio(i, campo, e.target.value)}
                      />
                    ) : (
                      <span className="text-ink-700">{p[campo] ? formatearFecha(p[campo]) : '—'}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editando && (
        <p className="mt-1.5 text-xs text-ink-500">
          Un receso de un solo día lleva la misma fecha de inicio y de fin. Las ocho filas son obligatorias.
        </p>
      )}
    </div>
  )
}

/** Feriados y suspensiones. Solo cuentan dentro de un PA. */
function DiasNoLectivos({ dias, editando, onCambio }) {
  const cambiar = (i, campo, valor) => onCambio(dias.map((d, n) => (n === i ? { ...d, [campo]: valor } : d)))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink-900">Días no lectivos</h2>
        {editando && (
          <Button
            size="sm"
            variant="outline"
            iconLeft={Plus}
            onClick={() => onCambio([...dias, { motivo: '', fecha_inicio: '', fecha_fin: '' }])}
          >
            Añadir día
          </Button>
        )}
      </div>

      {dias.length === 0 ? (
        <p className="rounded-lg border border-line px-4 py-3 text-sm text-ink-500">
          Ninguno. Los feriados nacionales los carga el sistema.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-100 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-left">Fecha de inicio</th>
                <th className="px-4 py-3 text-left">Fecha de fin</th>
                {editando && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {dias.map((d, i) => (
                <tr key={`${d.motivo}-${d.fecha_inicio}-${i}`} className="border-t border-line">
                  <td className="px-4 py-2">
                    {editando ? (
                      <Input
                        aria-label={`Motivo del día no lectivo ${i + 1}`}
                        value={d.motivo ?? ''}
                        onChange={(e) => cambiar(i, 'motivo', e.target.value)}
                      />
                    ) : (
                      <span className="text-ink-900">
                        {d.motivo}
                        {/* Los que carga el sistema no se distinguen a simple
                            vista de los que puso alguien a mano. */}
                        {d.origen === 'automatico' && (
                          <span className="ml-2 text-xs text-ink-500">cargado por el sistema</span>
                        )}
                      </span>
                    )}
                  </td>
                  {['fecha_inicio', 'fecha_fin'].map((campo) => (
                    <td key={campo} className="px-4 py-2">
                      {editando ? (
                        <Input
                          type="date"
                          aria-label={`${campo === 'fecha_inicio' ? 'Inicio' : 'Fin'} del día no lectivo ${i + 1}`}
                          value={d[campo] ?? ''}
                          onChange={(e) => cambiar(i, campo, e.target.value)}
                        />
                      ) : (
                        <span className="text-ink-700">{d[campo] ? formatearFecha(d[campo]) : '—'}</span>
                      )}
                    </td>
                  ))}
                  {editando && (
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        iconLeft={Trash2}
                        aria-label={`Quitar el día no lectivo ${i + 1}`}
                        className="text-danger-600"
                        onClick={() => onCambio(dias.filter((_, n) => n !== i))}
                      >
                        Quitar
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <p className="mt-1.5 text-xs text-ink-500">
          Cada día no lectivo debe caer dentro de un PA. Lo que se quite de esta tabla se elimina al guardar.
        </p>
      )}
    </div>
  )
}
