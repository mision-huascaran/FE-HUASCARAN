// CU015 — Detalle del alumno.
//
// Una pestaña por endpoint, todas contra el backend real: Resumen
// (`/resumen`), Seguimiento de Lectura (`/lectura`), Rúbrica (`/rubrica`) y
// Registro de Vuelo (`/registro-vuelo`). Cada pestaña pide lo suyo solo al
// abrirse, y lo que muestra es lo que manda el servidor: aquí no se calcula
// ningún nivel, estado ni resultado.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import Tabs from '../../components/ui/Tabs'
import ResumenFicha from './ResumenFichaAlumno'
import GraficaDeVuelo from './GraficaDeVuelo'
import {
  obtenerAlumno,
  obtenerLecturaAlumno,
  obtenerRegistroVueloAlumno,
  obtenerRubricaAlumno,
} from '../../api/resources/alumnos'
import { ESTADO_FILA } from '../../api/resources/lectura'
import { ESTADO_RUBRICA, comoNota } from '../../api/resources/rubricaMensual'
import { ORIGEN_ENTRADA } from '../../api/resources/registroVueloAnual'
import { mensajeDeError } from '../../api/client'
import { MESES } from '../../hooks/useFiltrosDeGrupo'
import { etiquetaDe, formatearRangoSemana } from '../../lib/format'

const PESTANAS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'lectura', label: 'Seguimiento de Lectura' },
  { value: 'rubrica', label: 'Rúbrica' },
  { value: 'vuelo', label: 'Registro de Vuelo' },
]

const ASISTENCIA = { presente: 'Presente', tardanza: 'Tardanza', ausente: 'Ausente' }

const nombreDeMes = (mes) => MESES.find((m) => m.value === Number(mes))?.label ?? String(mes)

/** `null` es "Sin evaluar"/"Sin registrar", nunca un 0. */
const oGuion = (valor) => (valor == null || valor === '' ? '-' : valor)

/** Error de una pestaña: el `detail` del servidor, no un texto inventado. */
function ErrorDePestana({ error }) {
  return <EmptyState title="No se pudo cargar" description={mensajeDeError(error)} />
}

function PestanaLectura({ idAlumno }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['alumno', idAlumno, 'lectura'],
    queryFn: () => obtenerLecturaAlumno(idAlumno),
  })
  if (error) return <ErrorDePestana error={error} />

  const columnas = [
    {
      key: 'semana',
      header: 'Semana',
      render: (f) => `${f.semana} · ${formatearRangoSemana({ inicio: f.fecha_inicio, fin: f.fecha_fin })}`,
    },
    { key: 'asistencia', header: 'Asistencia', render: (f) => ASISTENCIA[f.asistencia] ?? 'Sin marcar' },
    {
      key: 'lsn',
      header: 'LSN',
      render: (f) => (f.lsn_titulo ? `${f.lsn_titulo} (${f.lsn_nota}/${f.lsn_maximo})` : '-'),
    },
    { key: 'cantidad_lsl', header: 'LSL', align: 'center', render: (f) => oGuion(f.cantidad_lsl) },
    { key: 'total_libros', header: 'Total de libros', align: 'center' },
    { key: 'observacion', header: 'Observación', render: (f) => oGuion(f.observacion) },
    {
      key: 'estado_fila',
      header: 'Estado',
      render: (f) =>
        f.estado_tabla === 'no_realizada' ? (
          <Badge title={f.motivo_no_realizada ?? undefined}>No realizada</Badge>
        ) : (
          <Badge tone={ESTADO_FILA[f.estado_fila]?.tono}>{ESTADO_FILA[f.estado_fila]?.texto ?? f.estado_fila}</Badge>
        ),
    },
  ]

  return (
    <DataTable
      columns={columnas}
      rows={data}
      getRowId={(f) => `${f.semana}-${f.id_programa}`}
      loading={isLoading}
      paginated={false}
      empty={<EmptyState title="Sin lectura registrada" description="El alumno no aparece en tablas de lectura de este año." />}
      footNote="Las 5 semanas más recientes del año escolar."
    />
  )
}

function PestanaRubrica({ idAlumno }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['alumno', idAlumno, 'rubrica'],
    queryFn: () => obtenerRubricaAlumno(idAlumno),
  })
  if (error) return <ErrorDePestana error={error} />

  const columnas = [
    { key: 'mes', header: 'Mes', render: (e) => nombreDeMes(e.mes) },
    { key: 'fluidez', header: 'Fluidez', render: (e) => e.fluidez ?? 'Sin evaluar' },
    { key: 'comprension', header: 'Comprensión', render: (e) => e.comprension ?? 'Sin evaluar' },
    { key: 'resultado', header: 'Resultado', align: 'center', render: (e) => comoNota(e.resultado_decimas) ?? '-' },
    {
      key: 'estado',
      header: 'Estado',
      render: (e) => <Badge tone={ESTADO_RUBRICA[e.estado]?.tono}>{ESTADO_RUBRICA[e.estado]?.texto ?? e.estado}</Badge>,
    },
  ]

  return (
    <DataTable
      columns={columnas}
      rows={data?.evaluaciones ?? []}
      getRowId={(e) => e.mes}
      loading={isLoading}
      paginated={false}
      empty={<EmptyState title="Sin evaluaciones" description="El alumno todavía no tiene rúbricas mensuales este año." />}
      footNote="Las 5 evaluaciones mensuales más recientes del año escolar."
    />
  )
}

function PestanaVuelo({ idAlumno }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['alumno', idAlumno, 'registro-vuelo'],
    queryFn: () => obtenerRegistroVueloAlumno(idAlumno),
  })
  if (error) return <ErrorDePestana error={error} />

  const columnas = [
    { key: 'numero', header: 'Periodo', render: (p) => `PA${p.numero}` },
    {
      key: 'entrada',
      header: 'Entrada',
      render: (p) =>
        p.entrada ? (
          <span title={ORIGEN_ENTRADA[p.origen_entrada] ?? undefined}>
            {p.entrada}
            {/*
              Tanda A3 — El nivel viene de una decisión tomada en OTRO
              colegio, antes del traslado. Se destaca porque explica una
              entrada que de otro modo parecería salida de la nada.
            */}
            {p.de_otro_colegio && (
              <span className="ml-2 whitespace-nowrap rounded-full bg-surface-100 px-2 py-0.5 text-xs text-ink-500">
                Registrado antes del traslado
              </span>
            )}
          </span>
        ) : (
          <span className="text-ink-500">{ORIGEN_ENTRADA.pendiente_periodo_anterior}</span>
        ),
    },
    { key: 'nivel_colocado', header: 'Nivel colocado', render: (p) => p.nivel_colocado ?? 'Sin registrar' },
    { key: 'nivel_programa', header: 'Nivel del programa', render: (p) => oGuion(p.nivel_programa) },
    { key: 'proyeccion', header: 'Proyección', render: (p) => oGuion(p.proyeccion) },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/*
        D64 — La gráfica de PA1 a PA4. El endpoint devuelve SIEMPRE los cuatro
        periodos, incluso los que aún no tienen decisión, justamente para
        esto: lo que se quiere ver de un vistazo es si el alumno sube, se
        mantiene o baja, y para eso hacen falta los cuatro puntos.
      */}
      {!isLoading && <GraficaDeVuelo periodos={data} />}

      <DataTable
        columns={columnas}
        rows={data}
        getRowId={(p) => p.numero}
        loading={isLoading}
        paginated={false}
        empty={<EmptyState title="Sin periodos" description="No hay periodos académicos en el año." />}
      />
    </div>
  )
}

export default function FichaEstudiantePage() {
  const { id } = useParams()
  const [pestana, setPestana] = useState('resumen')

  const { data: alumno, isLoading, error } = useQuery({
    queryKey: ['alumno', id],
    queryFn: () => obtenerAlumno(id),
  })

  if (isLoading) return <Skeleton variant="card" />
  if (error || !alumno) {
    return (
      <EmptyState
        title="No se encontró al alumno"
        description={error ? mensajeDeError(error) : 'Puede que ya no exista o que no tenga acceso a su colegio.'}
        action={
          <Link
            to="/alumnos"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          >
            Volver a alumnos
          </Link>
        }
      />
    )
  }

  // El backend manda `nombres`/`apellidos` y objetos `{id, nombre}`; el
  // simulador, `nombre` y textos. `etiquetaDe` resuelve las dos formas.
  const nombre = alumno.nombre ?? [alumno.nombres, alumno.apellidos].filter(Boolean).join(' ')
  const datos = [
    etiquetaDe(alumno.colegio),
    alumno.seccion ? `${etiquetaDe(alumno.grado)} · Sección ${etiquetaDe(alumno.seccion)}` : etiquetaDe(alumno.grado),
    etiquetaDe(alumno.programa ?? alumno.subprograma),
    alumno.ciclo ? `Ciclo ${etiquetaDe(alumno.ciclo)}` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/alumnos" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Alumnos
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{nombre}</h1>
          <p className="mt-1 text-sm text-ink-500">{datos.join(' · ')}</p>
        </div>
        {alumno.activo === false && <Badge tone="warning">Inactivo</Badge>}
      </header>

      <Card padded={false}>
        <Tabs items={PESTANAS} value={pestana} onChange={setPestana} className="px-2" />
        <div className="p-4">
          {pestana === 'resumen' && <ResumenFicha idAlumno={id} />}
          {pestana === 'lectura' && <PestanaLectura idAlumno={id} />}
          {pestana === 'rubrica' && <PestanaRubrica idAlumno={id} />}
          {pestana === 'vuelo' && <PestanaVuelo idAlumno={id} />}
        </div>
      </Card>
    </div>
  )
}
