// Lo que está filtrado, en una línea (auditoría de UX #737, U18).
//
// En el celular los filtros se pliegan bajo un botón «Filtros» y no se veía
// qué colegio, grado o fecha estaba aplicado: en Asistencias es justo lo que
// hay que saber antes de marcar. La barra lo deduce de sus propios hijos —los
// `Select` y los `Input` de fecha que ya recibe—, así que ninguna pantalla
// tiene que repetirlo.
import { Children, isValidElement } from 'react'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

function textoDe(props) {
  const valor = props.value
  if (valor == null || valor === '') return null
  if (Array.isArray(props.options)) {
    const opcion = props.options
      .map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
      .find((o) => String(o.value) === String(valor))
    return opcion ? String(opcion.label) : null
  }
  const fecha = ISO.exec(String(valor))
  if (fecha) return `${fecha[3]}/${fecha[2]}`
  return null
}

/** "I.E. 86021 · 3.º · Única · 03/11", o '' si no hay nada elegido. */
export default function resumenDeFiltros(hijos) {
  return Children.toArray(hijos)
    .filter(isValidElement)
    .map((hijo) => textoDe(hijo.props))
    .filter(Boolean)
    .join(' · ')
}
