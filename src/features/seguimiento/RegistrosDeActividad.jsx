// Qué tocó una jornada del docente (CU021, tanda 10).
//
// ESTE PANEL SUSTITUYE A UN ATAJO QUE NO LLEVABA A NINGUNA PARTE. Antes los
// botones "Ver Rúbrica", "Ver Lectura" y "Ver Registro de Vuelo" estaban
// deshabilitados porque esos módulos no existían, y "Ver Asistencias" navegaba
// al módulo con la FECHA de la jornada. Eso último casi funcionaba, pero
// mentía: dos actividades del mismo día tocaron cosas distintas, y el filtro
// por fecha enseñaba el trabajo de las dos mezclado.
//
// El endpoint nuevo responde desde la AUDITORÍA DE LA ACTIVIDAD, así que lo que
// se ve es lo que ESA jornada hizo. Es la diferencia entre "qué pasó ese día" y
// "qué hizo esta persona en esta sesión", que es la pregunta de CU021.
//
// CADA MÓDULO TIENE SU PROPIA UNIDAD, y por eso la tabla cambia de columnas: una
// fila de asistencias es una CLASE con su fecha, una de lectura es una TABLA
// SEMANAL, y una de rúbrica es un ALUMNO en un MES. Pintar las mismas columnas
// para todos dejaría la mitad vacías y daría a entender que faltan datos.
import { useQuery } from '@tanstack/react-query'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import { listarRegistrosDeActividad } from '../../api/resources/seguimiento'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const ETIQUETA = {
  asistencias: 'Asistencias',
  lectura: 'Seguimiento de Lectura',
  rubrica: 'Rúbrica',
  registro_vuelo: 'Registro de Vuelo',
  alumnos: 'Alumnos',
}

const comoDia = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
const comoMes = (mes) => (mes ? (MESES[Number(mes) - 1] ?? `Mes ${mes}`) : '—')

/** El grupo, que es común a todos los módulos: colegio, grado y sección. */
const grupoDe = (r) =>
  [r.colegio?.nombre, r.grado?.nombre, r.seccion?.nombre].filter(Boolean).join(' · ') || '—'

/**
 * Las columnas PROPIAS de cada módulo, además del grupo y los cambios.
 *
 * Se declaran por módulo y no se calculan: la unidad de cada uno es distinta, y
 * una columna "fecha" en rúbrica estaría siempre vacía no porque falte el dato
 * sino porque su unidad es el mes.
 */
const COLUMNAS = {
  asistencias: [{ key: 'fecha', header: 'Clase del', render: (r) => comoDia(r.fecha) }],
  lectura: [
    { key: 'semana', header: 'Semana', render: (r) => (r.id_semana ? `Sem. ${r.id_semana}` : '—') },
    { key: 'semana_inicio', header: 'Desde', render: (r) => comoDia(r.semana_inicio) },
    { key: 'programa', header: 'Subprograma', render: (r) => r.programa?.nombre ?? '—' },
  ],
  rubrica: [
    { key: 'alumno', header: 'Alumno', render: (r) => r.alumno?.nombre ?? '—' },
    { key: 'mes', header: 'Mes', render: (r) => comoMes(r.mes) },
  ],
  registro_vuelo: [
    { key: 'alumno', header: 'Alumno', render: (r) => r.alumno?.nombre ?? '—' },
    { key: 'periodo', header: 'Periodo', render: (r) => (r.id_periodo_academico ? `PA ${r.id_periodo_academico}` : '—') },
  ],
  alumnos: [{ key: 'alumno', header: 'Alumno', render: (r) => r.alumno?.nombre ?? '—' }],
}

export default function RegistrosDeActividad({ contexto, onCerrar }) {
  const { idDocente, actividad, modulo } = contexto ?? {}

  const consulta = useQuery({
    queryKey: ['seguimiento', 'registros', idDocente, actividad?.id, modulo],
    queryFn: () => listarRegistrosDeActividad(idDocente, actividad.id, { modulo }),
    enabled: Boolean(idDocente && actividad?.id && modulo),
  })

  const propias = COLUMNAS[modulo] ?? []

  return (
    <Modal
      open={Boolean(contexto)}
      onClose={onCerrar}
      title={`${ETIQUETA[modulo] ?? 'Registros'} de esta jornada`}
      subtitle={actividad ? `Actividad del ${formatearFechaHora(actividad.inicio ?? actividad.fecha)}` : ''}
      size="max-w-3xl"
      footer={
        <Button variant="ghost" onClick={onCerrar}>
          Cerrar
        </Button>
      }
    >
      {consulta.isError ? (
        <EmptyState title="No se pudo cargar lo que tocó esta jornada" description={mensajeDeError(consulta.error)} />
      ) : (
        <DataTable
          loading={consulta.isLoading}
          rows={consulta.data?.items ?? []}
          getRowId={(r, i) => `${r.modulo}-${r.id}-${i}`}
          empty={
            <EmptyState
              title="Nada de este módulo en esta jornada"
              description="La actividad no registró ni modificó nada aquí."
            />
          }
          columns={[
            { key: 'grupo', header: 'Grupo', render: grupoDe },
            ...propias,
            /*
              `cambios` significa algo distinto en cada módulo —alumnos con
              cambios en una clase, filas tocadas en una tabla semanal— así que
              la cabecera no promete más de lo que sabe.
            */
            { key: 'cambios', header: 'Cambios', render: (r) => r.cambios ?? 0 },
          ]}
        />
      )}
    </Modal>
  )
}
