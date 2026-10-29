// "Comparación de resultados de aprendizaje" (CU033, paso 7). Solo Supervisor.
//
// Es el bloque con más reglas del dashboard, y ninguna es cosmética:
//
//  · EL ÍNDICE ES UNA CONVENCIÓN, Y SE DICE. 1 a Inicio, 2 a En proceso, 3 a
//    Logrado, 4 a Avanzado. El CU insiste en que "no representa una nota
//    individual ni demuestra por sí solo la calidad de enseñanza", así que la
//    tabla lo escribe en su pie. Un número sin esa frase se cita luego como si
//    fuera una calificación del colegio.
//  · NO SE RECALCULA NI SE REORDENA AQUÍ. El servidor ordena con el valor sin
//    redondear y los empates comparten posición (1, 1, 3). Si el cliente
//    ordenara por el valor que se ve —dos decimales—, dos grupos distintos
//    empatarían a ojos del front y no del servidor.
//  · "POR DIMENSIÓN" Y "POR NIVEL ALFABÉTICO" NO LLEVAN ÍNDICE. Su escala es
//    otra, y aplicarles la de 1 a 4 mezclaría dos cosas distintas. La columna
//    desaparece, no se rellena con guiones.
//  · TRES GRUPOS, NO UNO: los comparables, los que no tienen ninguna
//    evaluación completa (sin índice ni posición) y los que no aplican porque
//    ahí ese subprograma no está configurado. "No aplica" no es un cero.
//  · SU FILTRO DE GRADOS AFECTA SOLO A ESTE BLOQUE, y tiene su propio
//    "Aplicar".
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Select from '../../components/ui/Select'
import { CeldaFiltro } from '../../components/ui/BarraDeFiltros'
import SelectorMultiple from '../usuarios/SelectorMultiple'
import { obtenerComparacionResultados } from '../../api/resources/dashboard'
import BloqueDashboard from './BloqueDashboard'
import { etiquetaDeEstado, formatearIndice } from './estados'

const VISTAS = [
  { value: 'resumen_colegio', label: 'Resumen por colegio' },
  { value: 'detalle_grado', label: 'Detalle por grado' },
]

const RESULTADOS = [
  { value: 'global', label: 'Nivel global del subprograma' },
  { value: 'fluidez', label: 'Por dimensión: Fluidez Lectora' },
  { value: 'comprension', label: 'Por dimensión: Comprensión Lectora' },
  { value: 'nivel_alfabetico', label: 'Por nivel alfabético' },
]

/** Las columnas mientras no llega la escala del servidor. */
const NIVELES_GLOBALES = ['Inicio', 'En proceso', 'Logrado', 'Avanzado']

const NOTA_INDICE =
  'El índice comparativo asigna 1 a Inicio, 2 a En proceso, 3 a Logrado y 4 a Avanzado, y se calcula solo con los alumnos con evaluación completa. Es una convención para comparar la distribución de resultados: no modifica los niveles de los alumnos, no es una nota individual y no demuestra por sí solo la calidad de la enseñanza.'

export default function BloqueComparacion({ filtros, contexto, hayCambios, programas = [], grados = [] }) {
  const inicial = useMemo(
    () => ({
      idPrograma: String(programas[0]?.id_programa ?? ''),
      todosLosGrados: true,
      idGrados: [],
      vista: 'resumen_colegio',
      resultado: 'global',
    }),
    [programas],
  )

  const [borrador, setBorrador] = useState(inicial)
  const [propios, setPropios] = useState(inicial)

  /**
   * El catálogo de subprogramas llega DESPUÉS del primer render, así que el
   * valor inicial nace vacío y hay que proponerlo cuando llegue.
   *
   * En un efecto y con la guarda, no durante el render: un `setState` en el
   * cuerpo del componente con `inicial` recalculado cada vez es exactamente el
   * bucle infinito que tuvo el modal de permisos.
   */
  useEffect(() => {
    if (borrador.idPrograma || !inicial.idPrograma) return
    setBorrador(inicial)
    setPropios(inicial)
  }, [inicial, borrador.idPrograma])

  const consulta = useQuery({
    queryKey: ['dashboard', 'comparacion-resultados', filtros, propios],
    queryFn: () => obtenerComparacionResultados(filtros, propios),
    enabled: Boolean(filtros) && Boolean(propios.idPrograma),
  })

  const datos = consulta.data
  const grupos = datos?.grupos ?? []
  const conIndice = propios.resultado === 'global'
  const sinGrados = !borrador.todosLosGrados && borrador.idGrados.length === 0

  const cambiar = (campo, valor) => setBorrador((previo) => ({ ...previo, [campo]: valor }))

  const columnas = [
    {
      key: 'posicion',
      header: '#',
      align: 'center',
      render: (g) => (g.posicion == null ? '—' : g.posicion),
    },
    { key: 'nombre', header: propios.vista === 'detalle_grado' ? 'Colegio y grado' : 'Colegio' },
    ...(conIndice
      ? [{ key: 'indice', header: 'Índice', align: 'right', render: (g) => formatearIndice(g.indice) }]
      : []),
    // Las columnas son la escala del resultado elegido: la de Fluidez o la del
    // nivel alfabético no es la de Inicio a Avanzado.
    ...(datos?.escala?.length ? datos.escala.map((n) => n.nombre) : NIVELES_GLOBALES).map((nivel) => ({
      key: nivel,
      header: nivel,
      align: 'right',
      render: (g) => g.niveles?.find((n) => n.nombre === nivel)?.cantidad ?? 0,
    })),
    { key: 'evaluados', header: 'Evaluados', align: 'right' },
    { key: 'pendientes', header: 'Pendientes', align: 'right' },
    {
      key: 'estado',
      header: '',
      render: (g) => {
        const aviso = etiquetaDeEstado(g)
        return aviso ? <Badge tone="warning">{aviso}</Badge> : null
      },
    },
  ]

  return (
    <BloqueDashboard
      titulo="Comparación de resultados de aprendizaje"
      contexto={[
        ...contexto,
        datos?.programa ? `Subprograma: ${datos.programa}` : null,
        propios.todosLosGrados ? 'Todos los grados' : `${propios.idGrados.length} grados`,
      ]}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(datos) && grupos.length === 0 && (datos.sin_evaluaciones?.length ?? 0) === 0}
    >
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-wrap items-start gap-3 rounded-lg border border-line bg-surface-50 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setPropios(borrador)
          }}
        >
          <CeldaFiltro>
            <Select
              label="Subprograma"
              required
              value={borrador.idPrograma}
              options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
              onChange={(e) => cambiar('idPrograma', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Vista"
              value={borrador.vista}
              options={VISTAS}
              onChange={(e) => cambiar('vista', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro>
            <Select
              label="Resultado"
              value={borrador.resultado}
              options={RESULTADOS}
              onChange={(e) => cambiar('resultado', e.target.value)}
            />
          </CeldaFiltro>
          <CeldaFiltro className="min-w-[240px] basis-[240px]">
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-ink-700">
              <input
                type="checkbox"
                checked={borrador.todosLosGrados}
                onChange={(e) => {
                  cambiar('todosLosGrados', e.target.checked)
                  if (e.target.checked) cambiar('idGrados', [])
                }}
                className="h-4 w-4 rounded border-line-strong text-brand-600"
              />
              {'Todos los grados'}
            </label>
            {!borrador.todosLosGrados && (
              <SelectorMultiple
                label="Grados"
                valores={borrador.idGrados}
                opciones={grados.map((g) => ({ value: String(g.id_grado), label: g.nombre }))}
                error={sinGrados ? 'Selecciona al menos un grado.' : undefined}
                onChange={(valores) => cambiar('idGrados', valores)}
              />
            )}
          </CeldaFiltro>
          <div className="ml-auto self-end">
            <Button type="submit" size="sm" iconLeft={Filter} disabled={sinGrados || !borrador.idPrograma}>
              Aplicar
            </Button>
          </div>
        </form>

        <DataTable
          paginated={false}
          rows={grupos}
          getRowId={(g) => `${g.id_colegio}-${g.id_grado ?? 'todos'}`}
          columns={columnas}
          footNote={conIndice ? NOTA_INDICE : 'Esta vista usa su propia escala: no se le aplica el índice de 1 a 4 del nivel global.'}
        />

        {/* Sin ninguna evaluación completa: aparte, sin índice ni posición. */}
        {(datos?.sin_evaluaciones?.length ?? 0) > 0 && (
          <div>
            <h4 className="mb-1 text-sm font-semibold text-ink-900">Sin evaluaciones completas</h4>
            <p className="text-xs text-ink-500">
              {datos.sin_evaluaciones.map((g) => `${g.nombre} (${g.pendientes} pendientes)`).join(' · ')}
            </p>
          </div>
        )}

        {/* "No aplica" no es un cero: ahí ese subprograma no está configurado. */}
        {(datos?.no_aplica?.length ?? 0) > 0 && (
          <div>
            <h4 className="mb-1 text-sm font-semibold text-ink-900">No aplica</h4>
            <p className="text-xs text-ink-500">
              {datos.no_aplica.map((g) => g.nombre).join(' · ')} — el subprograma no está configurado para estos
              grupos, así que no reciben valor ni posición.
            </p>
          </div>
        )}
      </div>
    </BloqueDashboard>
  )
}
