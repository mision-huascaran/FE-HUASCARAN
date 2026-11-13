// CU015 — Detalle del alumno.
//
// Una pestaña por endpoint, todas contra el backend real: Resumen
// (`/resumen`), Registro de Vuelo (`/registro-vuelo`), Rúbrica (`/rubrica`),
// Seguimiento de Lectura (`/lectura`) e Historial (`/historial`). Cada pestaña
// pide lo suyo solo al abrirse, y lo que muestra es lo que manda el servidor:
// aquí no se calcula ningún nivel, estado ni resultado.
//
// EL HISTORIAL EXIGE CONEXIÓN y es la única pestaña que no funciona sin ella:
// CU015 prohíbe guardar la auditoría en IndexedDB para no llenar la memoria
// del dispositivo. Sin señal no se pide nada y se explica por qué; las demás
// pestañas siguen navegables, que es justo lo que pide el flujo alternativo.
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, WifiOff } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import Tabs from '../../components/ui/Tabs'
import PestanaAuditoria from '../../components/mantenimiento/PestanaAuditoria'
import ResumenFicha from './ResumenFichaAlumno'
import GraficaDeVuelo from './GraficaDeVuelo'
import useConexion from '../../hooks/useConexion'
import usePrecarga from '../../hooks/usePrecarga'
import { ContenidoNoDisponible, sinCopiaLocal } from '../../components/ui/SinCopiaLocal'
import { CONSULTA_SIN_CONEXION } from '../../components/mantenimiento/Mantenimiento'
import { buscarAlumnoLocal } from '../alumnos/alumnosSinConexion'
import { listarHistorialAlumno } from '../../api/resources/administracion'
import {
  obtenerAlumno,
  obtenerLecturaAlumno,
  obtenerRegistroVueloAlumno,
  obtenerRubricaAlumno,
} from '../../api/resources/alumnos'
import { NOMBRE_LARGO_PERIODO } from '../../api/resources/calendarios'
import { ESTADO_FILA } from '../../api/resources/lectura'
import { ESTADO_RUBRICA, comoNota } from '../../api/resources/rubricaMensual'
import { ORIGEN_ENTRADA } from '../../api/resources/registroVueloAnual'
import { mensajeDeError } from '../../api/client'
import { MESES } from '../../hooks/useFiltrosDeGrupo'
import { etiquetaDe, formatearRangoSemana } from '../../lib/format'
import { useMigaExtra } from '../../store/migaStore'
import NombreLargo from '../../components/ui/NombreLargo'

// El orden lo fija CU015, y no es decorativo: Registro de Vuelo va primero
// porque es de donde sale el Nivel colocado del Resumen.
const PESTANAS = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'vuelo', label: 'Registro de Vuelo' },
  { value: 'rubrica', label: 'Rúbrica' },
  { value: 'lectura', label: 'Seguimiento de Lectura' },
  { value: 'historial', label: 'Historial' },
]

/**
 * El vacío de las mini-grillas, con el texto de las restricciones de CU015.
 *
 * Es el mismo en las tres: una fila que abarca el ancho de la tabla, no una
 * tabla desconfigurada ni un estado vacío genérico distinto por pestaña.
 */
const SIN_REGISTROS = <EmptyState title="No hay registros recientes" />

const ASISTENCIA = { presente: 'Presente', tardanza: 'Tardanza', ausente: 'Ausente' }

const nombreDeMes = (mes) => MESES.find((m) => m.value === Number(mes))?.label ?? String(mes)

/** `null` es "Sin evaluar"/"Sin registrar", nunca un 0. */
const oGuion = (valor) => (valor == null || valor === '' ? '-' : valor)

/** El id de un campo que llega como `{id, nombre}` (backend) o suelto (simulador). */
const idDe = (valor, suelto) => (valor && typeof valor === 'object' ? valor.id : (suelto ?? null))

/**
 * D64 — CP-ALU-08. Seleccionar una fila de las mini-grillas abre SU módulo
 * con el grupo del alumno ya filtrado: los filtros de Lectura, Rúbrica y
 * Registro de Vuelo viven en la URL (`useFiltrosDeGrupo`), así que basta el
 * enlace. `extra` añade lo propio de la fila (el mes, el subprograma).
 */
export function enlaceAlModulo(ruta, alumno, extra = {}) {
  const params = {
    colegio: idDe(alumno?.colegio, alumno?.id_colegio),
    grado: idDe(alumno?.grado, alumno?.id_grado),
    seccion: idDe(alumno?.seccion, alumno?.id_seccion),
    subprograma: idDe(alumno?.programa, alumno?.id_programa),
    ...extra,
  }
  const consulta = new URLSearchParams(
    Object.entries(params).filter(([, valor]) => valor != null && valor !== ''),
  ).toString()
  return consulta ? `${ruta}?${consulta}` : ruta
}

/** Error de una pestaña: el `detail` del servidor, no un texto inventado. */
function ErrorDePestana({ error }) {
  return <EmptyState title="No se pudo cargar" description={mensajeDeError(error)} />
}

function PestanaLectura({ idAlumno, alumno }) {
  const navigate = useNavigate()
  const consulta = useQuery({
    queryKey: ['alumno', idAlumno, 'lectura'],
    queryFn: () => obtenerLecturaAlumno(idAlumno),
  })
  const { data = [], isLoading, error } = consulta
  if (error) return <ErrorDePestana error={error} />
  if (sinCopiaLocal(consulta)) return <ContenidoNoDisponible descripcion="Conéctate a internet para ver el seguimiento de lectura del alumno." />

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
      empty={SIN_REGISTROS}
      onRowClick={(f) =>
        navigate(enlaceAlModulo('/seguimiento-lectura', alumno, { subprograma: f.id_programa, mes: f.mes }))
      }
      footNote="Las 5 semanas más recientes del año escolar. Selecciona una para abrirla en Seguimiento de Lectura."
    />
  )
}

function PestanaRubrica({ idAlumno, alumno }) {
  const navigate = useNavigate()
  const consulta = useQuery({
    queryKey: ['alumno', idAlumno, 'rubrica'],
    queryFn: () => obtenerRubricaAlumno(idAlumno),
  })
  const { data, isLoading, error } = consulta
  if (error) return <ErrorDePestana error={error} />
  if (sinCopiaLocal(consulta)) return <ContenidoNoDisponible descripcion="Conéctate a internet para ver la rúbrica del alumno." />

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
      empty={SIN_REGISTROS}
      onRowClick={(e) => navigate(enlaceAlModulo('/rubrica', alumno, { mes: e.mes }))}
      footNote="Las 5 evaluaciones mensuales más recientes del año escolar. Selecciona una para abrirla en Rúbrica."
    />
  )
}

function PestanaVuelo({ idAlumno, alumno }) {
  const navigate = useNavigate()
  const consulta = useQuery({
    queryKey: ['alumno', idAlumno, 'registro-vuelo'],
    queryFn: () => obtenerRegistroVueloAlumno(idAlumno),
  })
  const { data = [], isLoading, error } = consulta
  if (error) return <ErrorDePestana error={error} />
  if (sinCopiaLocal(consulta)) return <ContenidoNoDisponible descripcion="Conéctate a internet para ver el registro de vuelo del alumno." />

  const columnas = [
    {
      key: 'numero',
      header: 'Periodo',
      /**
       * "Primer periodo", no "PA1" (CU015).
       *
       * El código solo significa algo para quien construye el sistema; esta
       * ficha la lee un Docente, y es el mismo nombre que ya usan el
       * calendario y los filtros del Dashboard. Se toma del mapa de CU027 en
       * vez de escribirlo otra vez: si mañana cambia el nombre, cambia en un
       * solo sitio. Si llegara un número fuera de PA1–PA4, se enseña el
       * número antes que un hueco.
       */
      render: (p) => NOMBRE_LARGO_PERIODO[`PA${p.numero}`] ?? `Periodo ${p.numero}`,
    },
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
        empty={SIN_REGISTROS}
        onRowClick={() => navigate(enlaceAlModulo('/registro-vuelo', alumno))}
        footNote="Selecciona un periodo para abrirlo en Registro de Vuelo."
      />
    </div>
  )
}

/**
 * Historial de cambios del alumno (paso 8 del flujo básico de CU015).
 *
 * Reusa la pestaña de auditoría de Mantenimiento: es el MISMO evento y el
 * mismo formato —"[Nombre] (Rol) editó al alumno el DD/MM/AAAA a las HH:MM" y
 * una línea por campo cambiado—, así que tener dos redacciones del mismo
 * hecho solo serviría para que se separaran con el tiempo.
 */
function PestanaHistorial({ idAlumno }) {
  const enLinea = useConexion()

  // Sin conexión NI SE PIDE: el caso de uso lo prohíbe expresamente, y una
  // peticion que va a fallar solo añadiría un error de red encima del aviso.
  if (!enLinea) {
    return (
      <EmptyState
        icon={WifiOff}
        title="Contenido no disponible sin conexión"
        description="Conéctate a internet para visualizar el historial de cambios."
      />
    )
  }

  return (
    <PestanaAuditoria
      entidad="alumno"
      registro={{ id: idAlumno }}
      cargarAuditoria={listarHistorialAlumno}
    />
  )
}

/**
 * D61 — La fila de Alumnos guardada en el equipo, con el nombre como lo pinta
 * la ficha. La lista lo trae "Apellidos, Nombres" (para ordenar); la ficha con
 * conexión dice "Nombres Apellidos", y sin conexión tiene que decir lo mismo
 * (también para las iniciales y la miga).
 */
function comoFicha(fila) {
  if (!fila) return null
  const nombre = [fila.nombres, fila.apellidos].filter(Boolean).join(' ')
  return { ...fila, nombre: nombre || fila.nombre }
}

export default function FichaEstudiantePage() {
  const { id } = useParams()
  const [pestana, setPestana] = useState('resumen')

  const enLinea = useConexion()
  const queryClient = useQueryClient()
  const precarga = usePrecarga()
  const { data: delServidor, isLoading, error } = useQuery({
    queryKey: ['alumno', id],
    queryFn: () => obtenerAlumno(id),
  })
  /**
   * SIN CONEXIÓN, LA FILA DE LA COPIA LOCAL (CU014, D61).
   *
   * El detalle no se guarda en el equipo: sin red la consulta queda en pausa,
   * sin datos y sin error, y la ficha decía "No se encontró al alumno" de uno
   * que la lista acababa de enseñar. La cabecera se arma con la misma fila de
   * la lista (precarga o lo ya visto con conexión).
   */
  const copiaLocal = enLinea || delServidor ? null : comoFicha(buscarAlumnoLocal(queryClient, precarga, id))
  const alumno = delServidor ?? copiaLocal

  // "Alumnos › Abigail Alva Chávez" y no "Alumnos › Detalle" (U29).
  useMigaExtra(alumno ? (alumno.nombre ?? [alumno.nombres, alumno.apellidos].filter(Boolean).join(' ')) : null)

  if (isLoading && !alumno) return <Skeleton variant="card" />
  if (!alumno) {
    return (
      <EmptyState
        title="No se encontró al alumno"
        description={error ? mensajeDeError(error) : 'Puede que ya no exista o que no tengas acceso a su colegio.'}
        action={
          <Link
            to="/alumnos"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-solid px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-solidHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
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

  /**
   * Las etiquetas de la cabecera, EN EL ORDEN DE CU015: Colegio, Subprograma,
   * Ciclo EBR, Grado y Estado. Las que no tienen dato no se pintan vacías;
   * el Estado se añade aparte porque es el único con color.
   */
  const etiquetas = [
    // Sin valor por defecto: `etiquetaDe` pone "—" y el filtro no lo quitaba
    // (salían dos "—" con la misma clave cuando faltaban colegio y subprograma).
    etiquetaDe(alumno.colegio, ''),
    etiquetaDe(alumno.programa ?? alumno.subprograma, ''),
    alumno.ciclo ? `Ciclo ${etiquetaDe(alumno.ciclo)}` : null,
    alumno.seccion ? `${etiquetaDe(alumno.grado)} · Sección ${etiquetaDe(alumno.seccion)}` : etiquetaDe(alumno.grado, ''),
  ].filter(Boolean)

  // La inicial del nombre y la del apellido, como pide la cabecera. Con una
  // sola palabra se usa solo esa: inventar una segunda letra sería peor.
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte[0])
    .filter((letra, i, todas) => i === 0 || i === todas.length - 1)
    .join('')
    .toUpperCase()

  return (
    <div className="flex flex-col gap-5">
      <Link to="/alumnos" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Alumnos
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 max-w-full items-center gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700"
          >
            {iniciales}
          </span>
          <NombreLargo as="h1" className="min-w-0 text-2xl font-bold text-ink-900">{nombre}</NombreLargo>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {etiquetas.map((texto) => (
            <Badge key={texto}>{texto}</Badge>
          ))}
          {alumno.activo === false ? <Badge tone="warning">Inactivo</Badge> : <Badge tone="success">Activo</Badge>}
        </div>
      </header>

      {copiaLocal && (
        <p role="status" className="rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-ink-700">
          {CONSULTA_SIN_CONEXION}
        </p>
      )}

      <Card padded={false}>
        <Tabs items={PESTANAS} value={pestana} onChange={setPestana} className="px-2" />
        <div className="p-4">
          {pestana === 'resumen' && <ResumenFicha idAlumno={id} />}
          {pestana === 'lectura' && <PestanaLectura idAlumno={id} alumno={alumno} />}
          {pestana === 'rubrica' && <PestanaRubrica idAlumno={id} alumno={alumno} />}
          {pestana === 'vuelo' && <PestanaVuelo idAlumno={id} alumno={alumno} />}
          {pestana === 'historial' && <PestanaHistorial idAlumno={id} />}
        </div>
      </Card>
    </div>
  )
}
