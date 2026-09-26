// Generador determinista de datos de prueba (§9).
//
// Semilla fija: las tablas y los gráficos son idénticos en cada recarga, para que
// las capturas del equipo siempre muestren lo mismo.
//
// Ley N.° 29733 (RN-019): todos los nombres, correos y códigos de aquí son
// FICTICIOS. No hay ni un dato real de un menor en este archivo.
//
// Los catálogos tienen exactamente la forma que devolverá el backend
// (`nivel_razkids`, `nivel_rubrica`, `nivel_general`, `nivel_esperado_por_grado`).
import dayjs from 'dayjs'

export const SEMILLA = 20260417
export const ANIO_LECTIVO = 2026

/** PRNG mulberry32: misma semilla → misma secuencia, en cualquier navegador. */
export function crearRandom(semilla) {
  let a = semilla >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const elegir = (random, lista) => lista[Math.floor(random() * lista.length)]

// ── Catálogos base ──────────────────────────────────────────────────────────

export const PROGRAMAS = [
  { id_programa: 1, nombre: 'Alfabetización' },
  { id_programa: 2, nombre: 'Comprensión Lectora' },
]

/** Ciclos de la EBR. El grado NO determina el ciclo evaluado (RN-004). */
export const CICLOS = [
  { id_ciclo: 1, nombre: 'III', grados: [1, 2] },
  { id_ciclo: 2, nombre: 'IV', grados: [3, 4] },
  { id_ciclo: 3, nombre: 'V', grados: [5, 6] },
]

export const GRADOS = [1, 2, 3, 4, 5, 6].map((n) => ({
  id_grado: n,
  numero: n,
  nombre: `${n}.°`,
  id_ciclo: CICLOS.find((c) => c.grados.includes(n)).id_ciclo,
}))

/** Escala Raz-Kids: aa, A…Z, Z1, Z2 (29 niveles). Se compara por `orden` (RN-012). */
export const NIVELES_RAZKIDS = ['aa', ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), 'Z1', 'Z2'].map(
  (letra, i) => ({ id_nivel_razkids: i + 1, letra, orden: i + 1 }),
)

export const TOTAL_NIVELES_RAZKIDS = NIVELES_RAZKIDS.length

export const letraPorOrden = (orden) =>
  NIVELES_RAZKIDS.find((n) => n.orden === Math.max(1, Math.min(TOTAL_NIVELES_RAZKIDS, orden)))?.letra ?? 'aa'

export const ordenDeLetra = (letra) => NIVELES_RAZKIDS.find((n) => n.letra === letra)?.orden ?? null

// TODO: los descriptores oficiales salen del instrumento de rúbrica de Misión
// Huascarán (RF-025). Los de abajo son provisionales, solo para poder ver el
// Tooltip de P5 mientras el documento llega.
const DESCRIPTORES = {
  Fluidez: {
    'Pre Inicio': 'Aún no reconoce todas las letras; necesita acompañamiento permanente para decodificar.',
    Inicio: 'Lee palabras sueltas de forma silábica, con pausas frecuentes.',
    Proceso: 'Lee oraciones cortas con vacilaciones y autocorrecciones.',
    Logrado: 'Lee textos del ciclo {ciclo} de corrido y con la entonación esperada.',
    Destacado: 'Lee con fluidez y expresividad textos por encima del ciclo {ciclo}.',
  },
  Comprensión: {
    Inicio: 'Recupera datos sueltos del texto solo con ayuda del docente.',
    Proceso: 'Identifica el tema y algunos detalles explícitos del texto del ciclo {ciclo}.',
    Logrado: 'Infiere el propósito del texto y relaciona sus partes sin ayuda.',
    Destacado: 'Interpreta el texto, lo compara con otros y sustenta su opinión.',
  },
}

/**
 * `nivel_rubrica`: 17 filas.
 * Alfabetización → Fluidez 5 niveles (incluye Pre Inicio) y Comprensión 4.
 * Comprensión Lectora → 4 y 4. Nunca se hardcodea en la interfaz (RN-011).
 */
export const NIVELES_RUBRICA = (() => {
  const combinaciones = [
    { id_programa: 1, dimension: 'Fluidez', niveles: ['Pre Inicio', 'Inicio', 'Proceso', 'Logrado', 'Destacado'] },
    { id_programa: 1, dimension: 'Comprensión', niveles: ['Inicio', 'Proceso', 'Logrado', 'Destacado'] },
    { id_programa: 2, dimension: 'Fluidez', niveles: ['Inicio', 'Proceso', 'Logrado', 'Destacado'] },
    { id_programa: 2, dimension: 'Comprensión', niveles: ['Inicio', 'Proceso', 'Logrado', 'Destacado'] },
  ]
  let id = 0
  return combinaciones.flatMap(({ id_programa, dimension, niveles }) =>
    niveles.map((nombre_nivel, i) => ({
      id_nivel_rubrica: ++id,
      id_programa,
      dimension,
      orden: i + 1,
      nombre_nivel,
      descriptores: Object.fromEntries(
        CICLOS.map((c) => [c.nombre, (DESCRIPTORES[dimension][nombre_nivel] ?? '').replace('{ciclo}', c.nombre)]),
      ),
    })),
  )
})()

/** `nivel_general`: 4 filas. "Pre Inicio" hoy solo existe en Fluidez (§13). */
export const NIVEL_GENERAL = ['Inicio', 'Proceso', 'Logrado', 'Destacado'].map((nombre_nivel, i) => ({
  id_nivel_general: i + 1,
  orden: i + 1,
  nombre_nivel,
}))

// TODO RN-013: el nivel Raz-Kids esperado por grado está pendiente de
// confirmación con Misión Huascarán. Esta tabla es provisional.
export const NIVEL_ESPERADO_POR_GRADO = [
  { id_grado: 1, letra: 'C' },
  { id_grado: 2, letra: 'G' },
  { id_grado: 3, letra: 'J' },
  { id_grado: 4, letra: 'M' },
  { id_grado: 5, letra: 'P' },
  { id_grado: 6, letra: 'S' },
].map((fila) => ({ ...fila, orden: ordenDeLetra(fila.letra) }))

/** Los nueve colegios del programa. Códigos y nombres de plantel ficticios. */
export const COLEGIOS = [
  { id_colegio: 1, nombre: 'I.E. 86021 Ranrahirca', abreviatura: 'RAN', zona: 'Yungay', distrito: 'Ranrahirca' },
  { id_colegio: 2, nombre: 'I.E. 86024 Mancos', abreviatura: 'MAN', zona: 'Yungay', distrito: 'Mancos' },
  { id_colegio: 3, nombre: 'I.E. 86031 Shupluy', abreviatura: 'SHU', zona: 'Yungay', distrito: 'Shupluy' },
  { id_colegio: 4, nombre: 'I.E. 86037 Cascapara', abreviatura: 'CAS', zona: 'Yungay', distrito: 'Cascapara' },
  { id_colegio: 5, nombre: 'I.E. 86042 Yanama', abreviatura: 'YAN', zona: 'Yungay', distrito: 'Yanama' },
  { id_colegio: 6, nombre: 'I.E. 86412 Marcará', abreviatura: 'MAR', zona: 'Carhuaz', distrito: 'Marcará' },
  { id_colegio: 7, nombre: 'I.E. 86418 Acopampa', abreviatura: 'ACO', zona: 'Carhuaz', distrito: 'Acopampa' },
  { id_colegio: 8, nombre: 'I.E. 86423 Shilla', abreviatura: 'SHI', zona: 'Carhuaz', distrito: 'Shilla' },
  { id_colegio: 9, nombre: 'I.E. 86427 Tinco', abreviatura: 'TIN', zona: 'Carhuaz', distrito: 'Tinco' },
]

/** Los cuatro cortes del año (RN-010). Solo uno está abierto a la vez. */
export const PERIODOS = [
  { id_periodo: 1, nombre: 'Abril', mes: 4, anio: ANIO_LECTIVO, estado: 'cerrado' },
  { id_periodo: 2, nombre: 'Julio', mes: 7, anio: ANIO_LECTIVO, estado: 'cerrado' },
  { id_periodo: 3, nombre: 'Octubre', mes: 10, anio: ANIO_LECTIVO, estado: 'abierto' },
  { id_periodo: 4, nombre: 'Diciembre', mes: 12, anio: ANIO_LECTIVO, estado: 'programado' },
]

export const PERIODO_VIGENTE = PERIODOS.find((p) => p.estado === 'abierto')

/**
 * Semanas lectivas, de lunes a viernes, desde el inicio del año escolar hasta la
 * semana en curso: así el docente siempre encuentra su semana abierta al entrar.
 * El mínimo son las 18 semanas de datos que pide §9 y el tope son 40.
 */
const INICIO_ANIO_ESCOLAR = `${ANIO_LECTIVO}-03-16`

const lunesDe = (fecha) => fecha.subtract((fecha.day() + 6) % 7, 'day')

export const SEMANAS = (() => {
  const primerLunes = lunesDe(dayjs(INICIO_ANIO_ESCOLAR))
  const semanasTranscurridas = lunesDe(dayjs()).diff(primerLunes, 'week') + 1
  const total = Math.min(40, Math.max(18, semanasTranscurridas))

  return Array.from({ length: total }, (_, i) => {
    const inicio = primerLunes.add(i, 'week')
    return {
      id_semana: i + 1,
      numero: i + 1,
      inicio: inicio.format('YYYY-MM-DD'),
      fin: inicio.add(4, 'day').format('YYYY-MM-DD'),
      mes: inicio.month() + 1,
      anio: inicio.year(),
    }
  })
})()

/** La semana que el reporte semanal abre por defecto (P4). */
export const SEMANA_ACTUAL = SEMANAS[SEMANAS.length - 1]

// ── Usuarios, docentes y asignaciones ───────────────────────────────────────

/** Contraseña única del entorno de prueba. Nunca sale de modo mock. */
export const CLAVE_DEMO = 'sicedu123'

export const DOCENTES = [
  { id_docente: 1, nombres: 'Rosa Elena', apellidos: 'Cárdenas Villanueva' },
  { id_docente: 2, nombres: 'Julio César', apellidos: 'Meléndez Paredes' },
  { id_docente: 3, nombres: 'Marlene', apellidos: 'Huamán Salazar' },
]

// Misma forma que devuelve `GET /me` en el backend real (APIS_BACKEND.md):
// `nombres` y `apellidos` por separado, `activo`, e `id_docente` en null para
// las cuentas no docentes.
export const USUARIOS = [
  { id_usuario: 1, id_rol: 1, correo: 'rcardenas@sicedu.test', id_docente: 1, nombres: 'Rosa Elena', apellidos: 'Cárdenas Villanueva', activo: true },
  { id_usuario: 2, id_rol: 1, correo: 'jmelendez@sicedu.test', id_docente: 2, nombres: 'Julio César', apellidos: 'Meléndez Paredes', activo: true },
  { id_usuario: 3, id_rol: 1, correo: 'mhuaman@sicedu.test', id_docente: 3, nombres: 'Marlene', apellidos: 'Huamán Salazar', activo: true },
  { id_usuario: 4, id_rol: 2, correo: 'jefatura@sicedu.test', id_docente: null, nombres: 'Ana Lucía', apellidos: 'Bustamante Rojas', activo: true },
  { id_usuario: 5, id_rol: 3, correo: 'direccion@sicedu.test', id_docente: null, nombres: 'Gerardo', apellidos: 'Ríos Del Águila', activo: true },
]

/**
 * RN-003: cada docente lleva DOS colegios y en cada uno los SEIS grados.
 * La rotación ocurre solo al cierre de un periodo y cambia el colegio completo:
 * la docente 1 deja Mancos y toma Shupluy a partir de octubre.
 * Los colegios 8 y 9 no tienen docente con usuario en este mock: sirven para ver
 * la cobertura incompleta en los consolidados.
 */
export const ASIGNACIONES = [
  { id_asignacion: 1, id_docente: 1, id_colegio: 1, id_periodo: 1 },
  { id_asignacion: 2, id_docente: 1, id_colegio: 2, id_periodo: 1 },
  { id_asignacion: 3, id_docente: 1, id_colegio: 1, id_periodo: 2 },
  { id_asignacion: 4, id_docente: 1, id_colegio: 2, id_periodo: 2 },
  { id_asignacion: 5, id_docente: 1, id_colegio: 1, id_periodo: 3 },
  { id_asignacion: 6, id_docente: 1, id_colegio: 3, id_periodo: 3 },
  { id_asignacion: 7, id_docente: 1, id_colegio: 1, id_periodo: 4 },
  { id_asignacion: 8, id_docente: 1, id_colegio: 3, id_periodo: 4 },
  ...[2, 3].flatMap((id_docente, i) =>
    PERIODOS.flatMap((p) =>
      [4 + i * 2, 5 + i * 2].map((id_colegio, j) => ({
        id_asignacion: 100 + id_docente * 10 + p.id_periodo * 2 + j,
        id_docente,
        id_colegio,
        id_periodo: p.id_periodo,
      })),
    ),
  ),
].map((a) => ({ ...a, grados: GRADOS.map((g) => g.id_grado) }))

// ── Alumnos ─────────────────────────────────────────────────────────────────

const NOMBRES = [
  'Ana Lucía', 'Milagros', 'Yenifer', 'Rosmery', 'Katherine', 'Briseida', 'Nayeli', 'Maricielo',
  'Fiorella', 'Estrella', 'Jhoselyn', 'Dayana', 'Karen', 'Luz Marina', 'Yulisa', 'Anthony',
  'Jhon Kevin', 'Elmer', 'Wilmer', 'Yonatan', 'Franklin', 'Cristhian', 'Deysi', 'Rodrigo',
  'Jhordan', 'Alexander', 'Maribel', 'Leidy', 'Jhonatan', 'Kiara', 'Angie', 'Josué',
  'Piero', 'Diego Armando', 'Yoselin', 'Ruth Noemí', 'Erick', 'Jampier', 'Brayan', 'Nicol',
]

const APELLIDOS = [
  'Alvarado', 'Ascencio', 'Barreto', 'Cáceres', 'Camones', 'Cerna', 'Chauca', 'Colonia',
  'Cordero', 'Depaz', 'Espinoza', 'Figueroa', 'Garay', 'Guillén', 'Henostroza', 'Huamán',
  'Jamanca', 'Lliuya', 'Loli', 'Macedo', 'Maguiña', 'Mejía', 'Melgarejo', 'Minaya',
  'Morales', 'Norabuena', 'Obregón', 'Palacios', 'Paucar', 'Príncipe', 'Quispe', 'Ramírez',
  'Rosales', 'Salazar', 'Sánchez', 'Shuan', 'Tarazona', 'Toledo', 'Valverde', 'Villanueva',
]

/** 413 alumnos, repartidos de forma desigual como en la realidad. */
const ALUMNOS_POR_COLEGIO = [62, 54, 48, 45, 44, 42, 41, 40, 37]

/**
 * Probabilidad de seguir en Alfabetización por grado: alta en los primeros
 * grados, pero nunca cero en los últimos — el grado NO determina el programa
 * (§1, RN-004).
 */
const PROB_ALFABETIZACION = { 1: 0.85, 2: 0.7, 3: 0.35, 4: 0.2, 5: 0.12, 6: 0.08 }

export const ALUMNOS = (() => {
  const random = crearRandom(SEMILLA)
  const alumnos = []
  let idAlumno = 0

  COLEGIOS.forEach((colegio, indiceColegio) => {
    const total = ALUMNOS_POR_COLEGIO[indiceColegio]
    // Reparto del colegio entre sus seis grados, con el resto en los primeros.
    const base = Math.floor(total / 6)
    const porGrado = GRADOS.map((g, i) => base + (i < total % 6 ? 1 : 0))
    let correlativo = 1000

    GRADOS.forEach((grado, i) => {
      const cantidad = porGrado[i]
      const dosAulas = cantidad > 9
      for (let n = 0; n < cantidad; n += 1) {
        const esAlfabetizacion = random() < PROB_ALFABETIZACION[grado.numero]
        // RN-004: el ciclo evaluado puede ir por debajo del ciclo nominal.
        const cicloNominal = grado.id_ciclo
        const idCicloEvaluado = random() < 0.18 ? Math.max(1, cicloNominal - 1) : cicloNominal
        correlativo += 1
        idAlumno += 1
        alumnos.push({
          id_alumno: idAlumno,
          codigo: `EST-${colegio.abreviatura}-${correlativo}`,
          nombres: elegir(random, NOMBRES),
          apellidos: `${elegir(random, APELLIDOS)} ${elegir(random, APELLIDOS)}`,
          id_colegio: colegio.id_colegio,
          id_grado: grado.id_grado,
          aula: dosAulas ? (n % 2 === 0 ? 'A' : 'B') : 'A',
          id_ciclo_nominal: cicloNominal,
          id_ciclo_evaluado: idCicloEvaluado,
          id_programa: esAlfabetizacion ? 1 : 2,
          activo: random() > 0.02,
        })
      }
    })
  })

  return alumnos
})()

export const TOTAL_ALUMNOS = ALUMNOS.length

/** Nombre completo tal como se muestra en tablas y fichas. */
export const nombreCompleto = (alumno) => `${alumno.apellidos}, ${alumno.nombres}`


// ── Consultas sobre alumnos y asignaciones ──────────────────────────────────

const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()

export function alumnosDe({ colegio, grado, programa, q } = {}) {
  const busqueda = sinTildes(q)
  return ALUMNOS.filter(
    (a) =>
      (!colegio || a.id_colegio === Number(colegio)) &&
      (!grado || a.id_grado === Number(grado)) &&
      (!programa || a.id_programa === Number(programa)) &&
      (!busqueda || sinTildes(`${nombreCompleto(a)} ${a.codigo}`).includes(busqueda)),
  )
}

/** Colegios que el docente tiene asignados en un periodo (RN-003). */
export function asignacionesDe(idDocente, idPeriodo) {
  return ASIGNACIONES.filter(
    (a) => a.id_docente === Number(idDocente) && (!idPeriodo || a.id_periodo === Number(idPeriodo)),
  )
}

/** Los ids de colegio que el docente puede EDITAR en el periodo (§5). */
export const colegiosAsignadosA = (idDocente, idPeriodo) => [
  ...new Set(asignacionesDe(idDocente, idPeriodo).map((a) => a.id_colegio)),
]

// ── Evaluaciones diagnósticas (registro de vuelo) ───────────────────────────
//
// Se generan aquí los valores que el BACKEND tendría guardados. La fórmula del
// sistema no vive en este archivo: llega en la Fase 4 con `domain/nivelFinal.js`
// (RN-009). Lo de abajo solo produce datos verosímiles y coherentes entre sí.

/** Abril y julio completos; octubre a medias; diciembre casi vacío (§9). */
const COBERTURA_POR_PERIODO = { 1: 1, 2: 0.98, 3: 0.6, 4: 0.05 }

export const nivelesRubricaDe = (idPrograma, dimension) =>
  NIVELES_RUBRICA.filter((n) => n.id_programa === idPrograma && n.dimension === dimension)

function nivelPorDesempeno(random, idPrograma, dimension, razon) {
  const opciones = nivelesRubricaDe(idPrograma, dimension)
  const base = razon >= 0.8 ? 0.72 : razon >= 0.6 ? 0.5 : razon >= 0.4 ? 0.3 : 0.1
  const indice = Math.min(opciones.length - 1, Math.floor((base + random() * 0.27) * opciones.length))
  return opciones[indice].nombre_nivel
}

/** RN-013, tal como lo aplicaría el backend al guardar la evaluación. */
function nivelGeneralDe(fluidez, ordenAlcanzado, ordenEsperado) {
  if (fluidez === 'Pre Inicio' || ordenAlcanzado < ordenEsperado) return 'Inicio'
  const brecha = ordenAlcanzado - ordenEsperado
  return brecha >= 3 ? 'Destacado' : brecha >= 1 ? 'Logrado' : 'Proceso'
}

/** Docente a cargo de un colegio en un periodo, para firmar los hitos (P8). */
export function docenteDe(idColegio, idPeriodo) {
  const asignacion = ASIGNACIONES.find(
    (a) => a.id_colegio === Number(idColegio) && a.id_periodo === Number(idPeriodo),
  )
  const docente = DOCENTES.find((d) => d.id_docente === asignacion?.id_docente)
  return docente ? `${docente.nombres} ${docente.apellidos}` : 'Sin docente asignado'
}

/**
 * Línea de tiempo de una evaluación (RF-024, RN-014, RN-015).
 *
 * Tres hitos posibles: lo que sugirió el sistema, el cambio del docente si lo
 * hubo, y la confirmación. Cuando el docente acepta la sugerencia solo hay dos:
 * no se inventa un cambio que no ocurrió.
 */
function construirTrazabilidad({ fecha, docente, letraSugerida, letraFinal, ajustado }) {
  const hitos = [
    {
      tipo: 'sistema',
      titulo: `Sistema sugirió ${letraSugerida}`,
      autor: 'SICEDU',
      fecha: `${fecha}T08:15:00`,
    },
  ]

  if (ajustado) {
    hitos.push({
      tipo: 'docente',
      titulo: `Docente cambió a ${letraFinal}`,
      autor: docente,
      fecha: `${fecha}T10:42:00`,
    })
  }

  hitos.push({
    tipo: 'confirmado',
    titulo: ajustado ? 'Cambio guardado con justificación' : 'Sugerencia confirmada',
    autor: docente,
    fecha: `${fecha}T10:45:00`,
  })

  return hitos
}

const JUSTIFICACIONES = [
  'El alumno mostró mejor desempeño en clase que en la prueba escrita.',
  'Faltó a dos sesiones del mes; se mantiene el nivel hasta la próxima medición.',
  'La prueba se aplicó con ruido en el aula; se ajusta según la observación semanal.',
  'Su fluidez mejoró en la lectura en voz alta aunque la comprensión sigue en proceso.',
]

export const EVALUACIONES = (() => {
  const random = crearRandom(SEMILLA + 7)
  const filas = []
  let id = 0

  ALUMNOS.forEach((alumno) => {
    const esperado = NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)
    let ordenPrevio = Math.max(1, Math.min(TOTAL_NIVELES_RAZKIDS, esperado.orden - 3 + Math.floor(random() * 6)))

    PERIODOS.forEach((periodo) => {
      if (random() > COBERTURA_POR_PERIODO[periodo.id_periodo]) return

      const total = elegir(random, [5, 5, 10])
      const aciertos = Math.min(total, Math.round(total * (0.3 + random() * 0.72)))
      const razon = aciertos / total
      const delta = razon >= 0.8 ? 1 : razon <= 0.4 ? -1 : 0
      const ordenSugerido = Math.max(1, Math.min(TOTAL_NIVELES_RAZKIDS, ordenPrevio + delta))

      // RF-023 / RN-015: si el docente cambia la sugerencia, debe justificarlo.
      const ajustado = random() < 0.15
      const ordenFinal = ajustado
        ? Math.max(1, Math.min(TOTAL_NIVELES_RAZKIDS, ordenSugerido + (random() < 0.5 ? -1 : 1)))
        : ordenSugerido

      const fluidez = nivelPorDesempeno(random, alumno.id_programa, 'Fluidez', razon)
      const comprension = nivelPorDesempeno(random, alumno.id_programa, 'Comprensión', razon)
      const cerrado = periodo.estado === 'cerrado'

      const docente = docenteDe(alumno.id_colegio, periodo.id_periodo)
      const fecha = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}-15`

      id += 1
      filas.push({
        id_evaluacion: id,
        id_alumno: alumno.id_alumno,
        id_periodo: periodo.id_periodo,
        // RN-005: el nivel inicial es el nivel final del periodo anterior.
        nivel_inicial_razkids: letraPorOrden(ordenPrevio),
        nivel_prueba: letraPorOrden(ordenPrevio),
        aciertos,
        total,
        nivel_sugerido: letraPorOrden(ordenSugerido),
        nivel_ajustado: letraPorOrden(ordenFinal),
        fluidez,
        comprension,
        nivel_general: nivelGeneralDe(fluidez, ordenFinal, esperado.orden),
        ajustado_por_docente: ajustado,
        justificacion: ajustado ? elegir(random, JUSTIFICACIONES) : null,
        observacion: null,
        estado: cerrado ? (random() < 0.05 ? 'error' : 'revisado') : random() < 0.6 ? 'pendiente' : 'revisado',
        fecha,
        // RF-024: hitos de la revisión humana, lo que pinta la línea de tiempo de P8.
        trazabilidad: construirTrazabilidad({
          fecha,
          docente,
          letraSugerida: letraPorOrden(ordenSugerido),
          letraFinal: letraPorOrden(ordenFinal),
          ajustado,
        }),
      })

      ordenPrevio = ordenFinal
    })
  })

  return filas
})()

export const evaluacionesDe = (idAlumno) => EVALUACIONES.filter((e) => e.id_alumno === idAlumno)

export const ultimaEvaluacionDe = (idAlumno) => evaluacionesDe(idAlumno).at(-1) ?? null

/**
 * Columnas de referencia del reporte semanal (P4): el docente NO las llena, se
 * copian del último registro de vuelo y del catálogo de nivel esperado.
 */
export function referenciaDe(alumno) {
  const esperado = NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)
  const ultima = ultimaEvaluacionDe(alumno.id_alumno)
  return {
    nivel_esperado_razkids: esperado?.letra ?? null,
    orden_esperado: esperado?.orden ?? null,
    nivel_colocado: ultima?.nivel_ajustado ?? null,
    orden_colocado: ultima ? ordenDeLetra(ultima.nivel_ajustado) : null,
  }
}

// ── Reporte semanal y rúbrica semanal ───────────────────────────────────────
//
// Se generan por semana y bajo demanda: 413 alumnos × 30 semanas de golpe sería
// tiempo de arranque regalado. Lo generado se queda en memoria, así que lo que
// el docente guarda en el mock sobrevive mientras dure la sesión.

const TITULOS_LSB = [
  'El zorro y el cuy', 'La laguna de Llanganuco', 'Mi abuela teje', 'El picaflor viajero',
  'La chacra de don Aurelio', 'Nevado de mi ventana', 'La feria de los domingos',
  'El perro que no ladraba', 'Semillas de quinua', 'Las trenzas de Rosa', 'El río que canta',
  'Un cóndor sobre el valle',
]

const OBSERVACIONES = [
  'Leyó en voz alta frente al grupo.',
  'Necesitó apoyo con las palabras largas.',
  'Avanzó bien, pero se distrae con facilidad.',
  'Faltó el día de la lectura grupal.',
  '',
  '',
]

const cacheReportes = new Map()
const cacheRubricas = new Map()

const esSemanaActual = (idSemana) => idSemana === SEMANA_ACTUAL.id_semana

function generarReporteDeSemana(idSemana) {
  const random = crearRandom(SEMILLA + idSemana * 131)
  const filas = new Map()
  let idLibro = idSemana * 100_000

  ALUMNOS.forEach((alumno) => {
    // La semana en curso está a medio llenar: es justo lo que el docente entra a
    // completar, y es lo que mide el indicador "Reporte de esta semana" (P3).
    const capturado = random() < (esSemanaActual(idSemana) ? 0.4 : 0.93)
    if (!capturado) return

    const asistio = random() > 0.09
    const cantidadLsb = asistio ? Math.floor(random() * 3.4) : 0
    const libros = Array.from({ length: cantidadLsb }, () => {
      const total = elegir(random, [5, 5, 10])
      idLibro += 1
      return {
        id_libro: idLibro,
        titulo: elegir(random, TITULOS_LSB),
        aciertos: Math.min(total, Math.round(total * (0.4 + random() * 0.6))),
        total,
      }
    })

    filas.set(alumno.id_alumno, {
      id_reporte: idSemana * 10_000 + alumno.id_alumno,
      id_alumno: alumno.id_alumno,
      id_semana: idSemana,
      asistio,
      // RF-015: los libros de sala de lectura son solo una cantidad.
      lsl: asistio ? Math.floor(random() * 4) : 0,
      libros,
      observacion: asistio ? elegir(random, OBSERVACIONES) : '',
      actualizado_en: null,
    })
  })

  return filas
}

function generarRubricaDeSemana(idSemana) {
  const random = crearRandom(SEMILLA + idSemana * 977)
  const filas = new Map()

  ALUMNOS.forEach((alumno) => {
    if (random() > (esSemanaActual(idSemana) ? 0.25 : 0.88)) return
    const razon = 0.25 + random() * 0.7
    const fluidez = nivelesRubricaDe(alumno.id_programa, 'Fluidez').find(
      (n) => n.nombre_nivel === nivelPorDesempeno(random, alumno.id_programa, 'Fluidez', razon),
    )
    const comprension = nivelesRubricaDe(alumno.id_programa, 'Comprensión').find(
      (n) => n.nombre_nivel === nivelPorDesempeno(random, alumno.id_programa, 'Comprensión', razon),
    )

    filas.set(alumno.id_alumno, {
      id_rubrica: idSemana * 10_000 + alumno.id_alumno,
      id_alumno: alumno.id_alumno,
      id_semana: idSemana,
      // RN-008: las dos dimensiones se guardan siempre juntas.
      id_nivel_fluidez: fluidez?.id_nivel_rubrica ?? null,
      id_nivel_comprension: comprension?.id_nivel_rubrica ?? null,
      actualizado_en: null,
    })
  })

  return filas
}

export function reporteSemanalDe(idSemana) {
  const clave = Number(idSemana)
  if (!cacheReportes.has(clave)) cacheReportes.set(clave, generarReporteDeSemana(clave))
  return cacheReportes.get(clave)
}

export function rubricaSemanalDe(idSemana) {
  const clave = Number(idSemana)
  if (!cacheRubricas.has(clave)) cacheRubricas.set(clave, generarRubricaDeSemana(clave))
  return cacheRubricas.get(clave)
}

/**
 * Alta o actualización de una fila del reporte semanal.
 *
 * RNF-001: la clave es `alumno-semana`, así que un reintento del mismo envío
 * pisa la fila anterior en vez de crear una nueva. Es la contraparte de la
 * `idempotency_key` que manda la cola offline del cliente.
 */
export function guardarReporteSemanal(fila) {
  const filas = reporteSemanalDe(fila.id_semana)
  const previa = filas.get(fila.id_alumno)
  const guardada = {
    ...previa,
    ...fila,
    id_reporte: previa?.id_reporte ?? fila.id_semana * 10_000 + fila.id_alumno,
    actualizado_en: new Date().toISOString(),
  }
  filas.set(fila.id_alumno, guardada)
  return guardada
}

export function guardarRubricaSemanal(fila) {
  const filas = rubricaSemanalDe(fila.id_semana)
  const previa = filas.get(fila.id_alumno)
  const guardada = {
    ...previa,
    ...fila,
    id_rubrica: previa?.id_rubrica ?? fila.id_semana * 10_000 + fila.id_alumno,
    actualizado_en: new Date().toISOString(),
  }
  filas.set(fila.id_alumno, guardada)
  return guardada
}

// ── Evaluaciones diagnósticas: escritura ────────────────────────────────────

const proximoIdEvaluacion = () => Math.max(0, ...EVALUACIONES.map((e) => e.id_evaluacion)) + 1

/**
 * Alta o actualización de una evaluación diagnóstica (P6 y P7).
 *
 * La clave es `alumno-periodo`: un alumno tiene como mucho una evaluación por
 * corte, así que un reintento del mismo envío actualiza la fila en lugar de
 * duplicarla (RN-010, RNF-001).
 */
export function guardarEvaluacion(payload) {
  const indice = EVALUACIONES.findIndex(
    (e) => e.id_alumno === Number(payload.id_alumno) && e.id_periodo === Number(payload.id_periodo),
  )
  const previa = indice >= 0 ? EVALUACIONES[indice] : null

  const alumno = ALUMNOS.find((a) => a.id_alumno === Number(payload.id_alumno))
  const periodo = PERIODOS.find((p) => p.id_periodo === Number(payload.id_periodo))
  const fecha = previa?.fecha ?? new Date().toISOString().slice(0, 10)
  const docente = alumno ? docenteDe(alumno.id_colegio, payload.id_periodo) : 'Sin docente asignado'

  const ajustado = Boolean(payload.nivel_ajustado && payload.nivel_ajustado !== payload.nivel_sugerido)

  const guardada = {
    ...previa,
    id_evaluacion: previa?.id_evaluacion ?? proximoIdEvaluacion(),
    id_alumno: Number(payload.id_alumno),
    id_periodo: Number(payload.id_periodo),
    nivel_inicial_razkids: payload.nivel_inicial_razkids ?? previa?.nivel_inicial_razkids ?? null,
    nivel_prueba: payload.nivel_prueba ?? previa?.nivel_prueba ?? null,
    aciertos: Number(payload.aciertos ?? previa?.aciertos ?? 0),
    total: Number(payload.total ?? previa?.total ?? 0),
    nivel_sugerido: payload.nivel_sugerido ?? previa?.nivel_sugerido ?? null,
    nivel_ajustado: payload.nivel_ajustado ?? payload.nivel_sugerido ?? previa?.nivel_ajustado ?? null,
    fluidez: payload.fluidez ?? previa?.fluidez ?? null,
    comprension: payload.comprension ?? previa?.comprension ?? null,
    nivel_general: payload.nivel_general ?? previa?.nivel_general ?? null,
    ajustado_por_docente: ajustado,
    // RN-015: sin justificación no se guarda un cambio del nivel sugerido.
    justificacion: ajustado ? (payload.justificacion ?? previa?.justificacion ?? null) : null,
    observacion: payload.observacion ?? previa?.observacion ?? null,
    estado: payload.estado ?? previa?.estado ?? 'pendiente',
    fecha,
    trazabilidad: construirTrazabilidad({
      fecha,
      docente,
      letraSugerida: payload.nivel_sugerido ?? previa?.nivel_sugerido,
      letraFinal: payload.nivel_ajustado ?? payload.nivel_sugerido ?? previa?.nivel_ajustado,
      ajustado,
    }),
    periodo_cerrado: periodo?.estado === 'cerrado',
  }

  if (indice >= 0) EVALUACIONES[indice] = guardada
  else EVALUACIONES.push(guardada)

  return guardada
}

// ── Nivel final mensual (P9) ────────────────────────────────────────────────
//
// RF-018: el consolidado mensual NO es un dato que el docente escriba: se deriva
// de las rúbricas semanales del mes. Se guarda cuántas semanas lo sustentan para
// poder advertir cuando son menos de tres.

const cacheNivelFinal = new Map()

const nombreNivelRubrica = (idNivel) =>
  NIVELES_RUBRICA.find((n) => n.id_nivel_rubrica === idNivel)?.nombre_nivel ?? null

/** Meses del año escolar con semanas lectivas cargadas. */
export const MESES_CON_SEMANAS = [...new Set(SEMANAS.map((s) => `${s.anio}-${String(s.mes).padStart(2, '0')}`))]

export const MES_ACTUAL = `${SEMANA_ACTUAL.anio}-${String(SEMANA_ACTUAL.mes).padStart(2, '0')}`

function generarNivelFinalDeMes(clave) {
  const [anio, mes] = clave.split('-').map(Number)
  const random = crearRandom(SEMILLA + anio * 31 + mes * 577)
  const semanasDelMes = SEMANAS.filter((s) => s.anio === anio && s.mes === mes)
  const filas = new Map()

  ALUMNOS.forEach((alumno) => {
    const rubricas = semanasDelMes
      .map((s) => rubricaSemanalDe(s.id_semana).get(alumno.id_alumno))
      .filter(Boolean)

    // Sin ninguna rúbrica del mes no hay nada que consolidar para este alumno.
    if (!rubricas.length) return

    const ultima = rubricas.at(-1)
    const fluidez = nombreNivelRubrica(ultima.id_nivel_fluidez)
    const comprension = nombreNivelRubrica(ultima.id_nivel_comprension)

    const esperado = NIVEL_ESPERADO_POR_GRADO.find((e) => e.id_grado === alumno.id_grado)
    const evaluacion = ultimaEvaluacionDe(alumno.id_alumno)
    const razkids = evaluacion?.nivel_ajustado ?? null
    const ordenAlcanzado = razkids ? ordenDeLetra(razkids) : null

    const calculado = nivelGeneralDe(fluidez, ordenAlcanzado ?? 0, esperado?.orden ?? 0)

    // RF-023 / RN-015: algunos meses el docente ajusta el nivel y lo justifica.
    const ajustado = random() < 0.18
    const indiceCalculado = NIVEL_GENERAL.findIndex((n) => n.nombre_nivel === calculado)
    const indiceFinal = ajustado
      ? Math.max(0, Math.min(NIVEL_GENERAL.length - 1, indiceCalculado + (random() < 0.5 ? -1 : 1)))
      : indiceCalculado

    filas.set(alumno.id_alumno, {
      id_nivel_final: Number(`${anio}${String(mes).padStart(2, '0')}${alumno.id_alumno}`),
      id_alumno: alumno.id_alumno,
      mes: clave,
      razkids_referencial: razkids,
      nivel_calculado: calculado,
      nivel_final: NIVEL_GENERAL[indiceFinal]?.nombre_nivel ?? calculado,
      ajustado,
      justificacion: ajustado ? elegir(random, JUSTIFICACIONES) : null,
      docente: docenteDe(alumno.id_colegio, PERIODO_VIGENTE.id_periodo),
      // RF-018: cuántas rúbricas semanales sustentan el consolidado.
      semanas_sustento: rubricas.length,
      semanas_mes: semanasDelMes.length,
      fluidez,
      comprension,
      actualizado_en: null,
    })
  })

  return filas
}

export function nivelFinalDeMes(mes) {
  const clave = String(mes ?? MES_ACTUAL)
  if (!cacheNivelFinal.has(clave)) cacheNivelFinal.set(clave, generarNivelFinalDeMes(clave))
  return cacheNivelFinal.get(clave)
}

/**
 * Ajuste del nivel final por el docente (RF-023, RN-015).
 * La justificación es obligatoria: sin ella el servidor rechaza el cambio.
 */
export function ajustarNivelFinal({ mes, id_alumno: idAlumno, nivel_final: nivelFinal, justificacion }) {
  const filas = nivelFinalDeMes(mes)
  const previa = filas.get(Number(idAlumno))
  if (!previa) return null

  const guardada = {
    ...previa,
    nivel_final: nivelFinal,
    ajustado: nivelFinal !== previa.nivel_calculado,
    justificacion: nivelFinal !== previa.nivel_calculado ? justificacion : null,
    actualizado_en: new Date().toISOString(),
  }
  filas.set(Number(idAlumno), guardada)
  return guardada
}
