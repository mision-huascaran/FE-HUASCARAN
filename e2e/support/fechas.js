// Mismos formatos que src/lib/format.js, siempre en hora de Lima.
const ZONA = 'America/Lima'

function partes(fecha) {
  const formato = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(formato.formatToParts(new Date(fecha)).map((p) => [p.type, p.value]))
}

/** DD/MM/YYYY de hoy en Lima. */
export function hoyLima() {
  const p = partes(Date.now())
  return `${p.day}/${p.month}/${p.year}`
}

/** DD/MM/YYYY HH:mm, como `formatearFechaHora`. */
export function fechaHoraLima(fecha) {
  const p = partes(fecha)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/** AAAA-MM-DD de un instante, en Lima. */
export function fechaLima(fecha) {
  const p = partes(fecha)
  return `${p.year}-${p.month}-${p.day}`
}

/** Día de la semana de una fecha AAAA-MM-DD: 1 = lunes … 7 = domingo. */
export function diaSemana(fechaIso) {
  const dia = new Date(`${fechaIso}T12:00:00Z`).getUTCDay()
  return dia === 0 ? 7 : dia
}

/** La fecha AAAA-MM-DD `dias` días antes. */
export function restarDias(fechaIso, dias) {
  const fecha = new Date(`${fechaIso}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() - dias)
  return fecha.toISOString().slice(0, 10)
}
