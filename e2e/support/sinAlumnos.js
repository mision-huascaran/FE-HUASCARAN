// RN-033 / RN-034 — El Directivo no recibe datos personales de alumnos.
//
// No basta con que la pantalla no los pinte: tampoco pueden llegar en las
// respuestas de la API, donde cualquiera los lee desde las herramientas del
// navegador. Esto escucha cada respuesta JSON de /api mientras dura la prueba.

/** Campos que identifican a una persona. */
const CAMPOS_PERSONALES = ['nombres', 'apellidos', 'dni']

/**
 * Respuestas que son de la PROPIA cuenta, no de alumnos: el login y el perfil
 * traen el nombre del Directivo que entra.
 */
const DE_LA_CUENTA = new Set(['/api/login', '/api/me'])

/** Dónde aparece un campo personal dentro de `valor` (su ruta en el JSON). */
function camposPersonales(valor, ruta = '') {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => camposPersonales(v, `${ruta}[${i}]`))
  if (valor === null || typeof valor !== 'object') return []
  return Object.entries(valor).flatMap(([clave, v]) => [
    ...(CAMPOS_PERSONALES.includes(clave) && v != null && v !== '' ? [`${ruta}.${clave}`] : []),
    ...camposPersonales(v, `${ruta}.${clave}`),
  ])
}

/**
 * Empieza a escuchar. Devuelve `revisar(nombreDeAlumno)`, que espera a que se
 * lean todas las respuestas y devuelve los hallazgos (vacío si no hay ninguno):
 * peticiones a /api/alumnos o /api/estudiantes, campos personales y el nombre
 * del alumno que creó F3, si se conoce.
 */
export function vigilarDatosDeAlumnos(page) {
  const lecturas = []
  page.on('response', (respuesta) => {
    const { pathname } = new URL(respuesta.url())
    if (!pathname.startsWith('/api/') || DE_LA_CUENTA.has(pathname)) return
    lecturas.push(
      respuesta
        .text()
        .then((texto) => ({ pathname, texto }))
        .catch(() => ({ pathname, texto: '' })),
    )
  })

  return async function revisar(nombreDeAlumno = null) {
    const hallazgos = []
    for (const { pathname, texto } of await Promise.all(lecturas)) {
      if (/^\/api\/(alumnos|estudiantes)(\/|$)/.test(pathname)) hallazgos.push(`pidió ${pathname}`)
      if (nombreDeAlumno && texto.includes(nombreDeAlumno)) hallazgos.push(`${pathname} trae «${nombreDeAlumno}»`)
      let cuerpo = null
      try {
        cuerpo = JSON.parse(texto)
      } catch {
        continue
      }
      for (const campo of camposPersonales(cuerpo)) hallazgos.push(`${pathname} trae ${campo}`)
    }
    return { hallazgos, respuestas: lecturas.length }
  }
}
