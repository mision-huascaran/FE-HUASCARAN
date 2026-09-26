// Cubre: RF-010, RF-016, RF-009
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { useToast } from '../../components/ui/Toast'
import { obtenerConsolidadoLibros, obtenerConsolidadoNivel } from '../../api/resources/consolidados'
import { obtenerRankingColegios } from '../../api/resources/dashboard'
import { mensajeDeError } from '../../api/client'
import { descargarCSV, descargarExcel } from '../../lib/export'
import useFiltrosStore from '../../store/filtrosStore'

/**
 * Descargas de solo lectura (P17 y /reportes). Cada reporte se pide al pulsar,
 * no al cargar la pantalla: con la conexión de RN-017 no tiene sentido traer
 * tres consolidados que quizá nadie descargue.
 */
function reportes(idPeriodo) {
  return [
    {
      id: 'niveles',
      titulo: 'Consolidado de niveles',
      descripcion: 'Estudiantes por nivel, grado y programa en el corte vigente.',
      obtener: async () => {
        const datos = await obtenerConsolidadoNivel({ periodo: idPeriodo })
        return {
          filas: datos.filas,
          columnas: [
            { titulo: 'Programa', valor: 'programa' },
            { titulo: 'Grado', valor: 'grado' },
            { titulo: 'Evaluados', valor: 'total' },
            ...datos.niveles.map((n) => ({ titulo: n, valor: (f) => f.conteos[n] ?? 0 })),
          ],
        }
      },
    },
    {
      id: 'libros',
      titulo: 'Consolidado de libros del mes',
      descripcion: 'Libros de subir de nivel y de sala de lectura por colegio y grado.',
      obtener: async () => {
        const datos = await obtenerConsolidadoLibros({})
        return {
          filas: [...datos.filas, { colegio: 'TOTAL GENERAL', grado: '', ...datos.total_general }],
          columnas: [
            { titulo: 'Colegio', valor: 'colegio' },
            { titulo: 'Grado', valor: 'grado' },
            { titulo: 'LSB', valor: 'lsb' },
            { titulo: 'LSL', valor: 'lsl' },
            { titulo: 'Total', valor: 'total' },
          ],
        }
      },
    },
    {
      id: 'ranking',
      titulo: 'Ranking de colegios',
      descripcion: '% de estudiantes en Logrado o Destacado y cobertura del corte.',
      obtener: async () => ({
        filas: await obtenerRankingColegios({ periodo: idPeriodo }),
        columnas: [
          { titulo: 'Posición', valor: 'posicion' },
          { titulo: 'Colegio', valor: 'colegio' },
          { titulo: 'Zona', valor: 'zona' },
          { titulo: '% logro', valor: 'pct_logro' },
          { titulo: 'Cobertura (%)', valor: 'cobertura' },
        ],
      }),
    },
  ]
}

export default function BloqueDescargas({ titulo = 'Descargas' }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const idPeriodo = useFiltrosStore((s) => s.idPeriodo)
  const [ocupado, setOcupado] = useState(null)

  async function descargar(reporte, formato) {
    setOcupado(`${reporte.id}-${formato}`)
    try {
      const { filas, columnas } = await queryClient.fetchQuery({
        queryKey: ['descarga', reporte.id, idPeriodo],
        queryFn: reporte.obtener,
        staleTime: 60_000,
      })
      if (formato === 'excel') descargarExcel(filas, columnas, reporte.titulo, reporte.titulo)
      else descargarCSV(filas, columnas, reporte.titulo)
    } catch (error) {
      toast.error('No se pudo generar la descarga', mensajeDeError(error))
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Card title={titulo} subtitle="Archivos para abrir en Excel o en cualquier hoja de cálculo">
      <ul className="flex flex-col divide-y divide-line">
        {reportes(idPeriodo).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{r.titulo}</p>
              <p className="text-xs text-ink-500">{r.descripcion}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" iconLeft={FileSpreadsheet} loading={ocupado === `${r.id}-excel`} disabled={Boolean(ocupado)} onClick={() => descargar(r, 'excel')}>
                Excel
              </Button>
              <Button size="sm" variant="outline" iconLeft={FileText} loading={ocupado === `${r.id}-csv`} disabled={Boolean(ocupado)} onClick={() => descargar(r, 'csv')}>
                CSV
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
