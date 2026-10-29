// "Comparación entre colegios" (CU035, paso 9). Supervisor y Directivo.
//
// UN INDICADOR A LA VEZ, Y NO SE COMBINAN. El CU lo cierra en una frase: "No
// combina los indicadores en una puntuación general." Es la tentación obvia de
// una pantalla así —un "puntaje del colegio"— y está prohibida, porque un
// número que mezcla asistencia con nivel de lectura no se puede interpretar.
//
// El otro detalle que cambia el resultado: cada indicador tiene su intervalo.
// Los de aprendizaje y la asistencia son del PERIODO seleccionado; el promedio
// de libros es del AÑO ESCOLAR completo. Mandarle un periodo al de libros es un
// 422, y eso lo decide la tabla `INDICADORES_COMPARACION` del recurso.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Badge from '../../components/ui/Badge'
import DataTable from '../../components/ui/DataTable'
import Select from '../../components/ui/Select'
import {
  INDICADORES_COMPARACION,
  obtenerComparacionColegios,
} from '../../api/resources/dashboard'
import BloqueDashboard from './BloqueDashboard'
import {
  SIN_INFORMACION,
  etiquetaDeEstado,
  formatearIndice,
  formatearPorcentaje,
} from './estados'

/** Cada indicador se escribe en su escala: porcentaje, índice o promedio. */
const formatoDe = (indicador) =>
  indicador === 'asistencia' ? formatearPorcentaje : formatearIndice

/** Las advertencias del servidor, en palabras. Una desconocida se muestra tal cual. */
const ADVERTENCIAS = new Map([
  ['evaluacion_incompleta', 'Evaluación incompleta'],
  ['registro_incompleto', 'Registro incompleto'],
  ['clases_sin_registro', 'Clases sin registro'],
  ['informacion_incompleta', 'Información incompleta'],
])

/** Por qué un colegio no entra en la comparación (`sin_informacion[].motivo`). */
const MOTIVOS = {
  periodo_no_iniciado: 'todavía no empezó el periodo',
  sin_evaluaciones: 'sin evaluaciones completas',
  no_aplica: 'el subprograma no está configurado',
  sin_estados_registrados: 'sin asistencias registradas',
  sin_alumnos: 'sin alumnos incluidos',
  sin_informacion: 'sin registros suficientes',
  sin_calendario: 'sin calendario',
}

/** El intervalo que representa, para que nadie lea un año como un periodo. */
const intervaloDe = (indicador, periodo) =>
  indicador === 'promedio_libros'
    ? 'Acumulado del año escolar'
    : `Periodo: ${periodo?.nombre ?? 'el seleccionado'}`

export default function BloqueComparacionColegios({ filtros, contexto, hayCambios, periodo }) {
  const [indicador, setIndicador] = useState(INDICADORES_COMPARACION[0].clave)

  const consulta = useQuery({
    queryKey: ['dashboard', 'comparacion-colegios', filtros, indicador],
    queryFn: () => obtenerComparacionColegios(filtros, indicador),
    enabled: Boolean(filtros),
  })

  const datos = consulta.data
  const colegios = datos?.colegios ?? []
  const sinInfo = datos?.sin_informacion ?? []
  const formato = formatoDe(indicador)
  const etiqueta = INDICADORES_COMPARACION.find((i) => i.clave === indicador)?.etiqueta

  return (
    <BloqueDashboard
      titulo="Comparación entre colegios"
      contexto={[...contexto, etiqueta, intervaloDe(indicador, periodo)]}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(datos) && colegios.length === 0 && sinInfo.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="max-w-sm">
          <Select
            label="Indicador comparado"
            value={indicador}
            options={INDICADORES_COMPARACION.map((i) => ({ value: i.clave, label: i.etiqueta }))}
            onChange={(e) => setIndicador(e.target.value)}
          />
        </div>

        <DataTable
          paginated={false}
          rows={colegios}
          getRowId={(c) => c.id_colegio}
          columns={[
            {
              key: 'posicion',
              header: '#',
              align: 'center',
              // Sin posición cuando no hay con quién comparar: "primero de
              // uno" no significa nada.
              render: (c) => (c.posicion == null ? '—' : c.posicion),
            },
            { key: 'nombre', header: 'Colegio' },
            { key: 'valor', header: etiqueta, align: 'right', render: (c) => formato(c.valor) },
            {
              key: 'poblacion',
              header: 'Población',
              align: 'right',
              render: (c) => (c.poblacion ? `${c.poblacion.cantidad} ${c.poblacion.descripcion}` : '—'),
            },
            {
              key: 'estado',
              header: '',
              render: (c) => {
                const avisos = (c.advertencias ?? []).map((a) => ADVERTENCIAS.get(a) ?? a)
                if (!avisos.length && etiquetaDeEstado(c)) avisos.push(etiquetaDeEstado(c))
                return avisos.map((aviso) => (
                  <Badge key={aviso} tone="warning">
                    {aviso}
                  </Badge>
                ))
              },
            },
          ]}
          footNote={`${intervaloDe(indicador, periodo)}. Los empates comparten posición. Los indicadores no se combinan en una puntuación general.`}
        />

        {/* Los dos literales de CU035: con un colegio, y con varios de los que
            solo uno tiene datos. Llegan redactados del servidor. */}
        {datos?.mensaje && <p className="text-sm text-ink-700">{datos.mensaje}</p>}

        {sinInfo.length > 0 && (
          <p className="text-xs text-warning-600">
            {SIN_INFORMACION} y sin posición:{' '}
            {sinInfo.map((c) => (MOTIVOS[c.motivo] ? `${c.nombre} (${MOTIVOS[c.motivo]})` : c.nombre)).join(', ')}.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
