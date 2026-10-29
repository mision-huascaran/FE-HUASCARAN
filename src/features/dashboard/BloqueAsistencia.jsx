// "Asistencia de Alumnos" (CU033 paso 8, CU035 paso 7).
//
// Las cuatro cosas que este bloque no puede confundir, y que son la mitad del
// caso de uso:
//
//  1. UNA ASISTENCIA SIN MARCAR NO ES UNA AUSENCIA. Va en su propia columna y
//     fuera del denominador. El porcentaje es
//     (Presentes + Tardanzas) ÷ (Presentes + Tardanzas + Ausentes) × 100.
//  2. LA TARDANZA CUENTA COMO ASISTENCIA, y además se muestra aparte.
//  3. LAS CLASES PROGRAMADAS SIN NINGÚN REGISTRO SE AVISAN APARTE ("Sin
//     registro"). No se consideran dictadas ni generan ausencias: una clase que
//     nadie registró no es una clase con 0 % de asistencia.
//  4. EL PORCENTAJE DE UN CONJUNTO NO ES EL PROMEDIO DE SUS PORCENTAJES. El CU
//     lo dice en negrita. Por eso aquí no se suma ni se divide nada: todos los
//     porcentajes llegan calculados por el servidor sobre el conjunto.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import StatCard from '../../components/ui/StatCard'
import { obtenerAsistenciaDashboard } from '../../api/resources/dashboard'
import BloqueDashboard from './BloqueDashboard'
import DetalleClases from './DetalleClases'
import Grafica from './graficas/Grafica'
import GraficaLineas from './graficas/GraficaLineas'
import { SIN_INFORMACION, etiquetaDeEstado, formatearPorcentaje, sinInformacion } from './estados'

const FORMULA = 'Porcentaje = (Presentes + Tardanzas) ÷ (Presentes + Tardanzas + Ausentes) × 100. La tardanza cuenta como asistencia; una asistencia sin marcar no es una ausencia y queda fuera del cálculo.'

export default function BloqueAsistencia({
  filtros,
  contexto,
  hayCambios,
  anioEscolar,
  periodo,
  alcance,
  /** El Directivo no tiene el detalle por clase: ese endpoint le da 403. */
  conDetalle = true,
}) {
  const [detalle, setDetalle] = useState(null)

  const consulta = useQuery({
    queryKey: ['dashboard', 'asistencia', filtros],
    queryFn: () => obtenerAsistenciaDashboard(filtros),
    enabled: Boolean(filtros),
  })

  const datos = consulta.data
  const resumen = datos?.resumen
  const mensual = datos?.mensual ?? []
  const aviso = etiquetaDeEstado(resumen)

  if (detalle) {
    return (
      <DetalleClases
        filtros={filtros}
        colegio={detalle}
        periodo={periodo}
        contexto={contexto}
        onVolver={() => setDetalle(null)}
      />
    )
  }

  return (
    <BloqueDashboard
      titulo="Asistencia de Alumnos"
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(datos) && sinInformacion(resumen, 'porcentaje')}
      acciones={aviso && <Badge tone="warning">{aviso}</Badge>}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Asistencia"
            value={formatearPorcentaje(resumen?.porcentaje)}
            hint={resumen?.provisional ? 'Provisional: hay registros incompletos' : undefined}
          />
          <StatCard label="Presentes" value={resumen?.presentes ?? SIN_INFORMACION} />
          <StatCard label="Tardanzas" value={resumen?.tardanzas ?? SIN_INFORMACION} hint="Cuentan como asistencia" />
          <StatCard label="Ausentes" value={resumen?.ausentes ?? SIN_INFORMACION} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Clases registradas como dictadas" value={resumen?.clases_dictadas ?? SIN_INFORMACION} />
          <StatCard
            label="Con asistencias pendientes"
            value={resumen?.clases_registro_incompleto ?? SIN_INFORMACION}
            hint="Su porcentaje es provisional"
          />
          <StatCard
            label="Programadas sin registro"
            value={resumen?.clases_sin_registro ?? SIN_INFORMACION}
            // El aviso que CU033 pide "junto al resumen", aunque las clases
            // registradas tengan sus listas completas.
            hint="No se consideran dictadas ni generan ausencias"
          />
        </div>

        <Grafica
          titulo={`Asistencia mensual ${alcance} · ${periodo?.nombre ?? ''}${anioEscolar ? ` de ${anioEscolar}` : ''}`}
          contexto={contexto}
          anioEscolar={anioEscolar}
          avisos={[resumen?.provisional ? 'Información incompleta: hay clases con asistencias pendientes.' : null]}
          hayDatos={mensual.some((m) => !sinInformacion(m, 'porcentaje'))}
        >
          <GraficaLineas datos={mensual} campo="porcentaje" maximo={100} />
        </Grafica>

        <DataTable
          paginated={false}
          rows={datos?.colegios ?? []}
          getRowId={(c) => c.id_colegio}
          columns={[
            { key: 'nombre', header: 'Colegio' },
            {
              key: 'porcentaje',
              header: 'Asistencia',
              align: 'right',
              render: (c) => formatearPorcentaje(c.porcentaje),
            },
            { key: 'presentes', header: 'Presentes', align: 'right' },
            { key: 'tardanzas', header: 'Tardanzas', align: 'right' },
            { key: 'ausentes', header: 'Ausentes', align: 'right' },
            {
              key: 'sin_marcar',
              header: 'Sin marcar',
              align: 'right',
              render: (c) => c.sin_marcar ?? 0,
            },
            {
              key: 'clases_sin_registro',
              header: 'Sin registro',
              align: 'right',
              render: (c) => c.clases_sin_registro ?? 0,
            },
            {
              key: 'estado',
              header: '',
              render: (c) => {
                const suyo = etiquetaDeEstado(c)
                return suyo ? <Badge tone="warning">{suyo}</Badge> : null
              },
            },
            ...(conDetalle
              ? [
                  {
                    key: 'acciones',
                    header: '',
                    render: (c) => (
                      <Button size="sm" variant="ghost" iconLeft={Eye} onClick={() => setDetalle(c)}>
                        Ver grados y clases
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
          footNote={FORMULA}
        />

        {(datos?.colegios_sin_informacion?.length ?? 0) > 0 && (
          <p className="text-xs text-warning-600">
            Sin información y fuera del cálculo:{' '}
            {datos.colegios_sin_informacion.map((c) => c.nombre).join(', ')}.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
