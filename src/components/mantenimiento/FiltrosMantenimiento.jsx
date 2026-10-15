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
//     para ver el primer alumno. De eso se encarga ahora `BarraDeFiltros`, que
//     es la misma fila que usan Seguimiento y Sesiones.
//   · Se filtra al PULSAR, no al teclear. Con la lista contra el servidor,
//     cambiar cinco filtros disparaba cinco consultas y la tabla parpadeaba
//     entre resultados intermedios.
import { useEffect, useState } from 'react'
import BarraDeFiltros, { CeldaFiltro } from '../ui/BarraDeFiltros'
import Input from '../ui/Input'
import Select from '../ui/Select'

const ESTADOS = [
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
  { value: 'todos', label: 'Todos' },
]

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
    <BarraDeFiltros onFiltrar={aplicar} onLimpiar={limpiar}>
      {filtros.map((filtro) => (
        <CeldaFiltro key={filtro.nombre}>
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
        </CeldaFiltro>
      ))}

      <CeldaFiltro>
        <Select
          label="Estado"
          value={borrador.estado ?? 'activo'}
          options={ESTADOS}
          onChange={(e) => escribir('estado', e.target.value)}
        />
      </CeldaFiltro>
    </BarraDeFiltros>
  )
}
