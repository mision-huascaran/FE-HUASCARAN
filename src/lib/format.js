// Formato de fechas y números de la interfaz. Español, sin librería de i18n.
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import 'dayjs/locale/es'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('es')

/**
 * El backend manda los INSTANTES en UTC con `Z` y pide mostrarlos siempre en
 * hora de Lima. Sin fijar la zona, `dayjs` usaría la del navegador: un portátil
 * con la zona mal puesta —o alguien revisando desde fuera del país— vería horas
 * corridas, y en esta aplicación las horas son la prueba de cuándo se trabajó.
 *
 * Los DÍAS de calendario (`AAAA-MM-DD`) son harina de otro costal: ya son días
 * de Lima y convertirlos los movería un día. Por eso se formatean aparte.
 */
const LIMA = 'America/Lima'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "14 – 18 set" para el selector de semanas del reporte semanal (P4). */
export function formatearRangoSemana(semana) {
  if (!semana) return ''
  const inicio = dayjs(semana.inicio)
  const fin = dayjs(semana.fin)
  const mesInicio = MESES[inicio.month()].slice(0, 3)
  const mesFin = MESES[fin.month()].slice(0, 3)
  return inicio.month() === fin.month()
    ? `${inicio.date()} – ${fin.date()} ${mesFin}`
    : `${inicio.date()} ${mesInicio} – ${fin.date()} ${mesFin}`
}

/** "Semana 12 · 14 – 18 set" */
export const etiquetaDeSemana = (semana) =>
  semana ? `Semana ${semana.numero} · ${formatearRangoSemana(semana)}` : ''

/** Día de calendario: se muestra tal cual, SIN convertir zona. */
export const formatearFecha = (valor) => {
  if (!valor) return '—'
  const soloDia = /^\d{4}-\d{2}-\d{2}$/.test(String(valor))
  return soloDia ? dayjs(valor).format('DD/MM/YYYY') : dayjs(valor).tz(LIMA).format('DD/MM/YYYY')
}

/** Instante: siempre en hora de Lima, venga como venga del servidor. */
export const formatearFechaHora = (valor) => (valor ? dayjs(valor).tz(LIMA).format('DD/MM/YYYY HH:mm') : '—')

/** Solo la hora, para "Actividad iniciada a las HH:MM" (CU010). */
export const formatearHora = (valor) => (valor ? dayjs(valor).tz(LIMA).format('HH:mm') : '—')

/** Porcentaje entero, sin decimales de más en las tarjetas. */
export const porcentaje = (parte, total) => (total ? Math.round((parte / total) * 100) : 0)

/**
 * Texto de un campo que puede llegar como cadena o como objeto.
 *
 * El backend devuelve unas veces `"I.E. 86021"` y otras
 * `{id: 1, nombre: "I.E. 86021"}`, según el endpoint. Pintar el objeto tal cual
 * lanza "Objects are not valid as a React child" y tumba el árbol entero: una
 * celda mal puesta deja la pantalla EN BLANCO. Por eso toda celda que venga de
 * la API pasa por aquí.
 */
export function etiquetaDe(valor, porDefecto = '—') {
  if (valor == null || valor === '') return porDefecto
  if (typeof valor === 'object') return valor.nombre ?? valor.label ?? porDefecto
  return String(valor)
}
