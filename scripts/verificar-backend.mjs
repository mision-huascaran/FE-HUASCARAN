/**
 * Comprueba contra el backend REAL lo que documenta APIS_BACKEND.md.
 *
 *   npm run verificar:backend
 *   node scripts/verificar-backend.mjs [baseURL] [origenDelFrontend]
 *
 * No es un test unitario: necesita el backend levantado y por eso vive fuera de
 * vitest. Sirve para confirmar qué existe de verdad antes de cambiar
 * VITE_USE_MOCK, y para detectar cuándo el backend publica algo nuevo.
 */
const baseURL = process.argv[2] ?? 'http://127.0.0.1:8000'
const origen = process.argv[3] ?? 'http://localhost:5173'

const ok = (t) => `[32m✓[0m ${t}`
const fallo = (t) => `[31m✗[0m ${t}`
const aviso = (t) => `[33m·[0m ${t}`

async function pedir(ruta, opciones = {}) {
  try {
    const respuesta = await fetch(`${baseURL}${ruta}`, { signal: AbortSignal.timeout(5000), ...opciones })
    const texto = await respuesta.text()
    let cuerpo = texto
    try {
      cuerpo = JSON.parse(texto)
    } catch {
      // Respuesta no JSON: se deja el texto tal cual.
    }
    return { estado: respuesta.status, cuerpo, cabeceras: respuesta.headers }
  } catch (error) {
    return { estado: null, cuerpo: error.message, cabeceras: new Headers() }
  }
}

const json = (cuerpo) => ({ 'Content-Type': 'application/json' })

console.log(`\nSICEDU — verificación del backend en ${baseURL}\n`)

// ── 1. Servicio ─────────────────────────────────────────────────────────────
const raiz = await pedir('/')
if (raiz.cuerpo?.status === 'ok') console.log(ok('GET  /            → { status: "ok" }'))
else console.log(fallo(`GET  /            → inesperado: ${JSON.stringify(raiz.cuerpo)}`))

// ── 2. Autenticación ────────────────────────────────────────────────────────
const CUENTAS = [
  { rol: 'Profesor', correo: 'profesor.prueba@sicedu.test', password: 'ProfesorTest123', esperaDocente: true },
  { rol: 'Jefa_Profesores', correo: 'jefa.prueba@sicedu.test', password: 'JefaTest123', esperaDocente: false },
]

let algunToken = null

for (const cuenta of CUENTAS) {
  const login = await pedir('/login', {
    method: 'POST',
    headers: json(),
    body: JSON.stringify({ correo: cuenta.correo, password: cuenta.password }),
  })

  if (login.estado !== 200 || !login.cuerpo?.access_token) {
    console.log(fallo(`POST /login       → ${cuenta.rol}: HTTP ${login.estado} ${JSON.stringify(login.cuerpo)}`))
    continue
  }
  algunToken ??= login.cuerpo.access_token

  const me = await pedir('/me', { headers: { Authorization: `Bearer ${login.cuerpo.access_token}` } })
  const perfil = me.cuerpo ?? {}

  // El aviso de APIS_BACKEND.md: id_docente es null en cuentas no docentes.
  const docenteCorrecto = cuenta.esperaDocente ? perfil.id_docente != null : perfil.id_docente === null
  const campos = ['id_usuario', 'id_rol', 'correo', 'id_docente', 'nombres', 'apellidos', 'activo']
  const faltantes = campos.filter((c) => !(c in perfil))

  if (me.estado === 200 && !faltantes.length && docenteCorrecto) {
    console.log(
      ok(
        `POST /login + /me → ${cuenta.rol.padEnd(15)} id_rol ${perfil.id_rol} · id_docente ${String(perfil.id_docente)}`,
      ),
    )
  } else {
    if (faltantes.length) console.log(fallo(`GET  /me          → ${cuenta.rol}: faltan campos ${faltantes.join(', ')}`))
    if (!docenteCorrecto) console.log(fallo(`GET  /me          → ${cuenta.rol}: id_docente inesperado (${perfil.id_docente})`))
  }
}

// La caducidad del token, leída del propio JWT.
if (algunToken) {
  try {
    const payload = JSON.parse(Buffer.from(algunToken.split('.')[1], 'base64url').toString('utf8'))
    const horas = ((payload.exp - Date.now() / 1000) / 3600).toFixed(1)
    console.log(ok(`JWT               → expira en ~${horas} h (exp ${payload.exp})`))
  } catch {
    console.log(aviso('JWT               → no se pudo leer el payload'))
  }
}

// ── 3. Forma de los errores ─────────────────────────────────────────────────
const malasCredenciales = await pedir('/login', {
  method: 'POST',
  headers: json(),
  body: JSON.stringify({ correo: 'profesor.prueba@sicedu.test', password: 'incorrecta' }),
})
console.log(
  typeof malasCredenciales.cuerpo?.detail === 'string' && malasCredenciales.estado === 401
    ? ok('401               → detail es string, como espera mensajeDeError()')
    : fallo(`401               → forma inesperada: ${JSON.stringify(malasCredenciales.cuerpo)}`),
)

const faltaCampo = await pedir('/login', { method: 'POST', headers: json(), body: JSON.stringify({ correo: 'x@y.z' }) })
console.log(
  Array.isArray(faltaCampo.cuerpo?.detail) && faltaCampo.estado === 422
    ? ok('422               → detail es array, como espera mensajeDeError()')
    : fallo(`422               → forma inesperada: ${JSON.stringify(faltaCampo.cuerpo)}`),
)

// ── 4. CORS ─────────────────────────────────────────────────────────────────
// Para el navegador, localhost y 127.0.0.1 son orígenes DISTINTOS.
console.log('\nCORS (solo importa si se llama al backend sin el proxy de Vite):\n')
for (const candidato of [origen, origen.replace('localhost', '127.0.0.1')]) {
  const preflight = await pedir('/login', {
    method: 'OPTIONS',
    headers: { Origin: candidato, 'Access-Control-Request-Method': 'POST' },
  })
  const permitido = preflight.cabeceras.get('access-control-allow-origin')
  console.log(
    permitido === candidato
      ? ok(`${candidato.padEnd(24)} permitido`)
      : aviso(`${candidato.padEnd(24)} NO permitido — añádalo a CORS_ORIGINS o entre por el otro origen`),
  )
}

// ── 5. Lo que el frontend consume y todavía no existe ───────────────────────
console.log('\nEndpoints de negocio que el frontend consume:\n')
const pendientes = ['/colegios', '/grados', '/alumnos', '/reporte-semanal', '/evaluacion-diagnostica', '/nivel-final-mensual']
let algunoPublicado = false
for (const ruta of pendientes) {
  const r = await pedir(ruta, algunToken ? { headers: { Authorization: `Bearer ${algunToken}` } } : {})
  if (r.estado === 404) console.log(aviso(`${ruta.padEnd(26)} 404 — no implementado`))
  else if (r.estado === null) console.log(fallo(`${ruta.padEnd(26)} sin respuesta`))
  else {
    algunoPublicado = true
    console.log(ok(`${ruta.padEnd(26)} HTTP ${r.estado} — ¡ya existe! Actualice endpoints.js y quite el mock`))
  }
}

console.log(
  algunoPublicado
    ? '\nHay endpoints de negocio publicados: toca revisar src/api/endpoints.js.\n'
    : '\nMientras el negocio siga en 404, VITE_USE_MOCK=true y VITE_AUTH_REAL=true.\n' +
        `Documentación viva: ${baseURL}/docs\n`,
)
