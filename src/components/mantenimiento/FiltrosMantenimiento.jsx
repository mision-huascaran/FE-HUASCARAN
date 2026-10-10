// Filtros de la plantilla de mantenimiento.
//
// El filtro de Estado va SIEMPRE y arranca en "Activos": es una de las reglas
// transversales del sprint, y vale para Alumnos, Usuarios y Colegios por igual.
// Por eso vive aquí y no en cada pantalla.
//
// DOS COSAS QUE CAMBIARON tras la revisión del probador:
//
//   · Todo en UNA FILA. Antes cada filtro ocupaba el ancho completo y la
//     tabla quedaba empujada fuera de la pantalla: había que bajar seis veces
//     para ver el primer alumno. `Field` lleva `w-full`, así que la fila no se
//     arma con los controles sueltos sino envolviendo cada uno en una celda
//     flexible que sí puede encogerse.
//   · Se filtra al PULSAR, no al teclear. Con la lista contra el servidor,
//     cambiar cinco filtros disparaba cinco consultas y la tabla parpadeaba
//     entre resultados intermedios.
import { useEffect, useState } from 'react'
import { Filter, X } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

const ESTADOS = [
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
]

/** Una celda de la fila: puede encogerse, con un mínimo legible. */
function Celda({ children }) {
  return <div className="min-w-[150px] flex-1 basis-[150px]">{children}</div>
}

export default function FiltrosMantenimiento({ filtros = [], valores = {}, onCambio, onAplicar }) {
  // Lo que el usuario está escribiendo, todavía sin aplicar.
  const [borrador, setBorrador] = useState(valores)

  // Si la pantalla cambia los filtros por su cuenta (al limpiarlos, por
  // ejemplo), el borrador tiene que seguirlos o mostraría lo de antes.
  useEffect(() => setBorrador(valores), [valores])

  const escribir = (nombre, valor) => setBorrador((b) => ({ ...b, [nombre]: valor }))

  const aplicar = () => {
    if (onAplicar) onAplicar(borrador)
    else Object.entries(borrador).forEach(([nombre, valor]) => onCambio?.(nombre, valor))
  }

  const limpiar = () => {
    // Se nombran TODOS los filtros, no solo el estado: quien recibe esto los
    // aplica uno a uno, así que un filtro ausente se quedaría como estaba. Con
    // una sola barra de filtros no se notaba; con búsqueda, rol y colegio,
    // "Limpiar" dejaba media pantalla filtrada.
    const vacio = Object.fromEntries(filtros.map((f) => [f.nombre, '']))
    vacio.estado = 'activo'
    setBorrador(vacio)
    if (onAplicar) onAplicar(vacio)
    else Object.entries(vacio).forEach(([nombre, valor]) => onCambio?.(nombre, valor))
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3 border-b border-line p-4"
      onSubmit={(e) => {
        e.preventDefault()
        aplicar()
      }}
    >
      {filtros.map((filtro) => (
        <Celda key={filtro.nombre}>
          {filtro.tipo === 'busqueda' ? (
            <Input
              label={filtro.etiqueta}
              value={borrador[filtro.nombre] ?? ''}
              placeholder={filtro.placeholder}
              onChange={(e) => escribir(filtro.nombre, e.target.value)}
            />
          ) : (
            <Select
              label={filtro.etiqueta}
              value={borrador[filtro.nombre] ?? ''}
              placeholder="Todos"
              options={filtro.opciones ?? []}
              onChange={(e) => escribir(filtro.nombre, e.target.value)}
            />
          )}
        </Celda>
      ))}

      <Celda>
        <Select
          label="Estado"
          value={borrador.estado ?? 'activo'}
          options={ESTADOS}
          onChange={(e) => escribir('estado', e.target.value)}
        />
      </Celda>

      {/* Los botones no se estiran: lo que sobra es para los filtros. El
          margen inferior los alinea con los controles, que reservan un hueco
          bajo cada uno para su texto de ayuda. */}
      <div className="mb-6 flex shrink-0 items-center gap-2">
        <Button type="submit" iconLeft={Filter}>
          Filtrar
        </Button>
        <Button type="button" variant="ghost" iconLeft={X} onClick={limpiar}>
          Limpiar
        </Button>
      </div>
    </form>
  )
}
