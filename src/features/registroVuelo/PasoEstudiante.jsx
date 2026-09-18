// Cubre: RF-020, RN-004
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lock, Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Input from '../../components/ui/Input'
import { listarAlumnos } from '../../api/resources/alumnos'
import useDebounce from '../../hooks/useDebounce'

/**
 * Paso 1 (P7) — al elegir al estudiante, sus datos se autocompletan y se bloquean.
 * RN-004: grado, ciclo evaluado y programa son tres datos distintos; el grado no
 * determina ni el ciclo ni el programa.
 */
export default function PasoEstudiante({ alumno, programas, onSeleccionar }) {
  const [texto, setTexto] = useState('')
  const busqueda = useDebounce(texto, 400)

  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ['alumnos', 'buscar', busqueda],
    queryFn: () => listarAlumnos({ q: busqueda }),
    enabled: busqueda.trim().length >= 3,
  })

  const nombrePrograma = programas.find((p) => p.id_programa === alumno?.id_programa)?.nombre ?? '—'

  return (
    <Card title="Datos del estudiante">
      <Input
        label="Buscar estudiante"
        iconLeft={Search}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Nombre o código (mínimo 3 caracteres)"
        hint="Los datos se completan automáticamente al seleccionar al estudiante"
      />

      {busqueda.trim().length >= 3 && (
        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-line">
          {isFetching && <p className="p-4 text-sm text-ink-500">Buscando…</p>}
          {!isFetching && resultados.length === 0 && (
            <EmptyState title="Sin resultados" description="Revise el nombre o el código." />
          )}
          {resultados.slice(0, 25).map((a) => (
            <button
              key={a.id_alumno}
              type="button"
              onClick={() => onSeleccionar(a)}
              className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-0 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-900">{a.nombre}</span>
                <span className="block text-xs text-ink-400">
                  {a.codigo} · {a.colegio}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-brand-700">Seleccionar</span>
            </button>
          ))}
        </div>
      )}

      {alumno && (
        <div className="mt-5 border-t border-line pt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="ID del sistema" value={alumno.codigo} disabled />
            <Input label="Nombre" value={alumno.nombre} disabled />
            <Input label="Colegio" value={alumno.colegio ?? '—'} disabled />
            <Input label="Grado" value={`${alumno.id_grado}.°`} disabled />
            <Input label="Programa" value={nombrePrograma} disabled />
            <Input label="Ciclo evaluado" value={alumno.ciclo_evaluado ?? '—'} disabled />
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Estos datos se completan automáticamente al seleccionar al estudiante
          </p>
        </div>
      )}
    </Card>
  )
}
