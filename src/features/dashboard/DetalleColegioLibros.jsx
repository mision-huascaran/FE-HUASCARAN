// El detalle de un colegio del consolidado de libros (CU034, pasos 6 a 8).
//
// Grupos desplegables por grado, ordenados por su promedio, y dentro de cada
// uno una fila por alumno con los meses en orden cronológico. Lo que el CU
// obliga a respetar:
//
//  · LOS NOMBRES SE QUEDAN FIJOS al desplazar en horizontal, y no hay
//    numeración ni se repite el grado en cada fila: son doce columnas de meses
//    y sin columna fija no se sabe de quién es la fila que se está leyendo.
//  · LOS GRADOS SIN INFORMACIÓN SUFICIENTE VAN APARTE, sin posición.
//  · UNA CANTIDAD MENSUAL SE PUEDE ABRIR para ver de qué registros sale. Ese
//    desglose es el paso 8, y desde cada elemento se llega al Seguimiento de
//    Lectura en consulta.
//  · LA AGRUPACIÓN ES POR PERTENENCIA HISTÓRICA: un cambio posterior de
//    colegio, grado o subprograma no traslada las lecturas anteriores, y el
//    estado actual del alumno no basta para excluir sus registros.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import Select from '../../components/ui/Select'
import StatCard from '../../components/ui/StatCard'
import { obtenerLibrosDeColegio } from '../../api/resources/dashboard'
import BloqueDashboard from './BloqueDashboard'
import DesgloseMensual from './DesgloseMensual'
import Grafica from './graficas/Grafica'
import GraficaBarras from './graficas/GraficaBarras'
import { mesesDeGrado, resumenDeGrado } from './librosPorGrado'
import {
  SIN_INFORMACION,
  TOTAL_PARCIAL,
  celda,
  formatearCantidad,
  formatearIndice,
  sinInformacion,
} from './estados'

function GrupoDeGrado({ grado, meses, onCantidad }) {
  const [abierto, setAbierto] = useState(false)
  const Icono = abierto ? ChevronDown : ChevronRight

  return (
    <section className="rounded-lg border border-line">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-50"
      >
        <Icono className="h-4 w-4 text-ink-400" aria-hidden />
        <span className="font-semibold text-ink-900">
          {grado.posicion != null && <span className="mr-2 text-xs text-ink-400">{grado.posicion}.</span>}
          {grado.nombre}
        </span>
        <span className="text-xs text-ink-500">
          {celda(grado, 'total', formatearCantidad)} libros · {grado.alumnos_incluidos ?? 0} alumnos · promedio{' '}
          {celda(grado, 'promedio', formatearIndice)}
        </span>
        {grado.provisional && <Badge tone="warning">Provisional</Badge>}
      </button>

      {abierto && (
        <div className="border-t border-line">
          <DataTable
            paginated={false}
            stickyFirstColumn
            rows={grado.alumnos ?? []}
            getRowId={(a) => a.id_alumno}
            columns={[
              { key: 'nombre', header: 'Nombres y apellidos' },
              ...meses.map((mes) => ({
                key: `${mes.anio}-${mes.mes}`,
                header: mes.nombre,
                align: 'right',
                render: (alumno) => {
                  const suyo = alumno.meses?.find((m) => m.mes === mes.mes && m.anio === mes.anio)
                  if (sinInformacion(suyo, 'cantidad')) return <span className="text-ink-400">—</span>
                  return (
                    <button
                      type="button"
                      className="font-semibold text-brand-600 hover:underline"
                      onClick={() => onCantidad({ alumno, mes: suyo })}
                    >
                      {suyo.cantidad}
                    </button>
                  )
                },
              })),
              {
                key: 'total',
                header: 'Total por alumno',
                align: 'right',
                render: (a) => celda(a, 'total', formatearCantidad),
              },
            ]}
          />
        </div>
      )}
    </section>
  )
}

export default function DetalleColegioLibros({ filtros, colegio, contexto, anioEscolar, onVolver }) {
  const [desglose, setDesglose] = useState(null)

  const consulta = useQuery({
    queryKey: ['dashboard', 'libros-colegio', colegio.id_colegio, filtros],
    queryFn: () => obtenerLibrosDeColegio(colegio.id_colegio, filtros),
    enabled: Boolean(filtros),
  })

  const datos = consulta.data
  const todosLosGrados = useMemo(() => datos?.grados ?? [], [datos])
  const sinInfoDelColegio = useMemo(() => datos?.sin_informacion ?? [], [datos])

  /**
   * El filtro por grado (CU034 paso 6) se aplica aquí, sobre la respuesta
   * del colegio entero: así las opciones no se encogen al elegir una y
   * siempre se puede volver a "Todos los grados".
   */
  const [idGrado, setIdGrado] = useState('')
  const opcionesDeGrado = [...todosLosGrados, ...sinInfoDelColegio]
  const elegido = opcionesDeGrado.find((g) => String(g.id_grado) === String(idGrado)) ?? null
  const delGrado = (g) => !elegido || g.id_grado === elegido.id_grado
  const grados = todosLosGrados.filter(delGrado)
  const sinInfo = sinInfoDelColegio.filter(delGrado)

  // Con un grado elegido, la tarjeta y el gráfico son SOLO de ese grado, y lo dicen.
  const meses = useMemo(() => {
    const delColegio = datos?.meses ?? []
    return elegido ? mesesDeGrado(elegido, delColegio) : delColegio
  }, [elegido, datos])
  const resumen = elegido ? resumenDeGrado(elegido) : datos?.resumen
  const consultado = elegido ? `${elegido.nombre} de ${colegio.nombre}` : colegio.nombre

  return (
    <>
      <BloqueDashboard
        titulo={`Libros leídos en ${colegio.nombre}`}
        contexto={contexto}
        consulta={consulta}
        vacio={Boolean(datos) && grados.length === 0 && sinInfo.length === 0}
        acciones={
          <Button size="sm" variant="ghost" iconLeft={ArrowLeft} onClick={onVolver}>
            Volver al consolidado
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          {opcionesDeGrado.length > 0 && (
            <div className="max-w-[220px]">
              <Select
                label="Grado"
                placeholder="Todos los grados"
                value={idGrado}
                options={opcionesDeGrado.map((g) => ({ value: g.id_grado, label: g.nombre }))}
                onChange={(e) => setIdGrado(e.target.value)}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={BookOpen}
              label={resumen?.provisional ? `${TOTAL_PARCIAL} en ${consultado}` : `Total de libros leídos en ${consultado}`}
              value={celda(resumen, 'total', formatearCantidad)}
            />
            <StatCard label="Alumnos incluidos" value={celda(resumen, 'alumnos', formatearCantidad)} />
            <StatCard label="Promedio por alumno" value={celda(resumen, 'promedio', formatearIndice)} />
          </div>

          <Grafica
            titulo={`Libros leídos por mes en ${consultado}`}
            contexto={contexto}
            anioEscolar={anioEscolar}
            hayDatos={meses.some((m) => !sinInformacion(m, 'cantidad'))}
          >
            <GraficaBarras datos={meses} campo="cantidad" />
          </Grafica>

          <div className="flex flex-col gap-2">
            {grados.map((grado) => (
              <GrupoDeGrado key={grado.id_grado} grado={grado} meses={meses} onCantidad={setDesglose} />
            ))}
          </div>

          {sinInfo.length > 0 && (
            <p className="text-xs text-warning-600">
              {SIN_INFORMACION} y sin posición: {sinInfo.map((g) => g.nombre).join(', ')}.
            </p>
          )}

          <p className="text-xs text-ink-500">
            La información se agrupa según la pertenencia histórica de cada clase de referencia. Un cambio posterior
            de colegio, grado o subprograma no traslada las lecturas anteriores al nuevo grupo.
          </p>
        </div>
      </BloqueDashboard>

      {desglose && (
        <DesgloseMensual
          alumno={desglose.alumno}
          mes={desglose.mes}
          filtros={filtros}
          onCerrar={() => setDesglose(null)}
        />
      )}
    </>
  )
}
