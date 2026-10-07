// Filtros de la plantilla de mantenimiento.
//
// El filtro de Estado va SIEMPRE y arranca en "Activos": es una de las reglas
// transversales del sprint, y vale para Alumnos, Usuarios y Colegios por igual.
// Por eso vive aquí y no en cada pantalla.
import Input from '../ui/Input'
import Select from '../ui/Select'

const ESTADOS = [
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
]

export default function FiltrosMantenimiento({ filtros = [], valores = {}, onCambio }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
      {filtros.map((filtro) =>
        filtro.tipo === 'busqueda' ? (
          <Input
            key={filtro.nombre}
            label={filtro.etiqueta}
            className="min-w-[200px] flex-1"
            value={valores[filtro.nombre] ?? ''}
            placeholder={filtro.placeholder}
            onChange={(e) => onCambio(filtro.nombre, e.target.value)}
          />
        ) : (
          <Select
            key={filtro.nombre}
            label={filtro.etiqueta}
            className="min-w-[160px]"
            value={valores[filtro.nombre] ?? ''}
            placeholder="Todos"
            options={filtro.opciones ?? []}
            onChange={(e) => onCambio(filtro.nombre, e.target.value)}
          />
        ),
      )}

      <Select
        label="Estado"
        className="min-w-[140px]"
        value={valores.estado ?? 'activo'}
        options={ESTADOS}
        onChange={(e) => onCambio('estado', e.target.value)}
      />
    </div>
  )
}
