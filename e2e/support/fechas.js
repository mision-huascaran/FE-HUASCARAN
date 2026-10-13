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
