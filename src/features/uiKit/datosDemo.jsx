// Datos ficticios del catálogo visual /_ui. Solo desarrollo.
import LevelChip from '../../components/ui/LevelChip'
import TrendIndicator from '../../components/ui/TrendIndicator'

export const NIVELES = ['Pre Inicio', 'Inicio', 'Proceso', 'Logrado', 'Destacado']

export const ALUMNOS_DEMO = [
  { id: 1, codigo: 'EST-AMA-1042', nombre: 'Rosa Meléndez Quispe', grado: '3.°', nivel: 'Logrado', letra: 'J', orden: 12, libros: 4, dir: 'up' },
  { id: 2, codigo: 'EST-AMA-1043', nombre: 'Julio Carhuaz Ramos', grado: '3.°', nivel: 'Proceso', letra: 'G', orden: 9, libros: 2, dir: 'flat' },
  { id: 3, codigo: 'EST-AMA-1044', nombre: 'Nayeli Tarazona Cruz', grado: '3.°', nivel: 'Inicio', letra: 'D', orden: 6, libros: 0, dir: 'down' },
  { id: 4, codigo: 'EST-YUN-2011', nombre: 'Edwin Sifuentes Loli', grado: '5.°', nivel: 'Destacado', letra: 'P', orden: 18, libros: 6, dir: 'up' },
  { id: 5, codigo: 'EST-YUN-2012', nombre: 'Mirtha Colonia Vega', grado: '5.°', nivel: 'Pre Inicio', letra: 'aa', orden: 1, libros: 1, dir: 'unknown' },
]

export const COLUMNAS = [
  { key: 'codigo', header: 'Código', sortable: true, className: 'font-medium text-ink-900' },
  { key: 'nombre', header: 'Estudiante', sortable: true },
  { key: 'grado', header: 'Grado', align: 'center' },
  {
    key: 'letra',
    header: 'Raz-Kids',
    align: 'center',
    render: (r) => <LevelChip letra={r.letra} orden={r.orden} totalNiveles={29} />,
  },
  {
    key: 'nivel',
    header: 'Nivel general',
    render: (r) => <LevelChip nivel={r.nivel} />,
  },
  { key: 'libros', header: 'Libros', align: 'right', sortable: true },
  {
    key: 'dir',
    header: 'Tendencia',
    render: (r) => <TrendIndicator dir={r.dir} />,
  },
]
