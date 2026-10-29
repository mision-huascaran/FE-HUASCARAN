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
/**
 * Los campos de una semana, con los DOS nombres (D58).
 *
 * `GET /semanas` pasó a devolver `numero_semana`, `fecha_inicio` y
 * `fecha_fin`; antes eran `numero`, `inicio` y `fin`. Leer solo los viejos era
 * lo que pintaba "Semana undefined · 22 – 22 oct" en el Inicio: el número no
 * existía y las dos fechas caían en `Invalid Date`, que dayjs resuelve al día
 * de hoy sin quejarse.
 */
const campoSemana = (semana, nuevo, viejo) => semana?.[nuevo] ?? semana?.[viejo]

export function formatearRangoSemana(semana) {
  if (!semana) return ''
  const desde = campoSemana(semana, 'fecha_inicio', 'inicio')
  const hasta = campoSemana(semana, 'fecha_fin', 'fin')
  // `dayjs(undefined)` es AHORA, y `isValid()` dice que sí: por eso una
  // semana sin fechas se pintaba como "28 – 28 oct" en vez de callarse.
  if (!desde || !hasta) return ''
  const inicio = dayjs(desde)
  const fin = dayjs(hasta)
  if (!inicio.isValid() || !fin.isValid()) return ''

  /**
   * Una semana que CRUZA DE MES se escribe con las fechas completas.
   *
   * Desde la tanda B una semana vive en un solo mes, aunque sus días caigan
   * en dos (lunes 29/06 a viernes 03/07). Escribirla "29 jun – 3 jul" se lee
   * bien, pero el caso de uso pide las fechas completas justo ahí, porque es
   * donde la gente se pierde al buscar en qué mes está su tabla.
   */
  if (inicio.year() !== fin.year() || inicio.month() !== fin.month()) {
    return `${inicio.format('DD/MM/YYYY')} – ${fin.format('DD/MM/YYYY')}`
  }
  return `${inicio.date()} – ${fin.date()} ${MESES[fin.month()].slice(0, 3)}`
}

/** "Semana 12 · 14 – 18 set", o "Semana 27 · 29/06/2026 – 03/07/2026". */
export const etiquetaDeSemana = (semana) => {
  if (!semana) return ''
  const numero = campoSemana(semana, 'numero_semana', 'numero')
  const rango = formatearRangoSemana(semana)
  // Sin número no se escribe "Semana undefined": se dice solo el rango, que
  // es lo que de verdad ubica a la persona.
  if (numero == null) return rango
  return rango ? `Semana ${numero} · ${rango}` : `Semana ${numero}`
}

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

/** `true` si los dos instantes caen en días distintos en hora de Lima. */
export const enOtroDia = (a, b) =>
  Boolean(a && b) && dayjs(a).tz(LIMA).format('YYYY-MM-DD') !== dayjs(b).tz(LIMA).format('YYYY-MM-DD')

/** `DD/MM`, para el aviso de CU010 cuando la sesión cruza la medianoche. */
export const formatearDiaMes = (valor) => (valor ? dayjs(valor).tz(LIMA).format('DD/MM') : '—')

/**
 * `AAAA-MM-DD` del día de Lima, para filtros y URLs.
 *
 * Un instante se convierte a Lima: recortar el texto UTC daría el día
 * siguiente entre las 19:00 y las 24:00. Un día de calendario ya es de Lima y
 * se devuelve tal cual: convertirlo lo movería al día anterior.
 */
export const fechaIsoLima = (valor) => {
  if (!valor) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) return String(valor)
  return dayjs(valor).tz(LIMA).format('YYYY-MM-DD')
}

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
