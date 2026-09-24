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

const json = () => ({ 'Content-Type': 'application/json' })

console.log(`\nSICEDU — verificación del backend en ${baseURL}\n`)

// ── 1. Servicio ─────────────────────────────────────────────────────────────
const raiz = await pedir('/')
if (raiz.cuerpo?.status === 'ok') console.log(ok('GET  /            → { status: "ok" }'))
else console.log(fallo(`GET  /            → inesperado: ${JSON.stringify(raiz.cuerpo)}`))

// ── 2. Autenticación ────────────────────────────────────────────────────────
const CUENTAS = [
  { rol: 'Docente', correo: 'profesor.prueba@sicedu.test', password: 'ProfesorTest123', esperaDocente: true },
  { rol: 'Supervisor', correo: 'jefa.prueba@sicedu.test', password: 'JefaTest123', esperaDocente: false },
  { rol: 'Directivo', correo: 'directivo.prueba@sicedu.test', password: 'DirectivoTest123', esperaDocente: false },
]

let algunToken = null
// Varios endpoints exigen rol Supervisor: con el token del Docente darían 403.
let tokenSupervisor = null

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
  if (cuenta.rol === 'Supervisor') tokenSupervisor = login.cuerpo.access_token

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
// Un 405 significa que la ruta existe pero no con ese método (por ejemplo,
// `/alumnos` acepta POST y todavía no GET).
const pendientes = ['/colegios', '/grados', '/programas', '/profesores', '/alumnos', '/reporte-semanal', '/evaluacion-diagnostica', '/nivel-final-mensual']
let algunoPublicado = false
for (const ruta of pendientes) {
  const token = tokenSupervisor ?? algunToken
  const r = await pedir(ruta, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  if (r.estado === 404) console.log(aviso(`${ruta.padEnd(26)} 404 — no implementado`))
  else if (r.estado === null) console.log(fallo(`${ruta.padEnd(26)} sin respuesta`))
  else {
    algunoPublicado = true
    const nota = r.estado === 405 ? 'la ruta existe, pero no con GET' : 'publicado'
    console.log(ok(`${ruta.padEnd(26)} HTTP ${r.estado} — ${nota}`))
  }
}


// ── 6. Endpoints nuevos (administración y recuperación) ─────────────────────
// Todo lo de aquí es de SOLO LECTURA: no crea ni desactiva nada. Los PATCH van
// contra un id que no existe, así que la respuesta dice si la ruta está
// publicada sin tocar ningún dato real.
console.log('\nAdministración y recuperación de contraseña:\n')

const ID_INEXISTENTE = 999999
const auth = tokenSupervisor ? { Authorization: `Bearer ${tokenSupervisor}` } : {}

const alumnosPag = await pedir('/alumnos?limit=5&offset=0', { headers: auth })
if (alumnosPag.estado === 200) {
  const cuerpo = alumnosPag.cuerpo
  const envuelto = cuerpo && !Array.isArray(cuerpo) && 'items' in cuerpo && 'total' in cuerpo
  console.log(
    envuelto
      ? ok(`GET   /alumnos?limit&offset     ${cuerpo.items.length} de ${cuerpo.total} — paginado`)
      : fallo(`GET   /alumnos                  responde ${Array.isArray(cuerpo) ? 'un array suelto' : 'una forma inesperada'}; el frontend espera { total, limit, offset, items }`),
  )
} else {
  console.log(fallo(`GET   /alumnos                  HTTP ${alumnosPag.estado}`))
}

const usuarios = await pedir('/usuarios', { headers: auth })
console.log(
  usuarios.estado === 200
    ? ok(`GET   /usuarios                 ${Array.isArray(usuarios.cuerpo) ? usuarios.cuerpo.length : (usuarios.cuerpo?.items?.length ?? '?')} cuentas`)
    : fallo(`GET   /usuarios                 HTTP ${usuarios.estado} ${JSON.stringify(usuarios.cuerpo)}`),
)

const filtrado = await pedir('/usuarios?rol=Supervisor', { headers: auth })
console.log(
  filtrado.estado === 200
    ? ok('GET   /usuarios?rol=…           filtro por rol aceptado')
    : fallo(`GET   /usuarios?rol=…           HTTP ${filtrado.estado}`),
)

// Un 404 o un 422 confirman que la ruta existe y llegó al handler; un 405 dice
// que el camino existe pero no admite PATCH.
const patches = [
  ['PATCH /alumnos/{id}', `/alumnos/${ID_INEXISTENTE}`, { nombres: 'X' }],
  ['PATCH /colegios/{id}', `/colegios/${ID_INEXISTENTE}`, { nombre: 'X' }],
  ['PATCH /profesores/{id}', `/profesores/${ID_INEXISTENTE}`, { nombres: 'X' }],
  ['PATCH /usuarios/{id}/desactivar', `/usuarios/${ID_INEXISTENTE}/desactivar`, null],
  ['PATCH /usuarios/{id}/activar', `/usuarios/${ID_INEXISTENTE}/activar`, null],
]
for (const [etiqueta, ruta, cuerpo] of patches) {
  const r = await pedir(ruta, {
    method: 'PATCH',
    headers: { ...auth, ...(cuerpo ? json() : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  })
  if (r.estado === 405) console.log(fallo(`${etiqueta.padEnd(31)} 405 — la ruta existe pero no admite PATCH`))
  else if (r.estado === 404 || r.estado === 422) console.log(ok(`${etiqueta.padEnd(31)} HTTP ${r.estado} — publicado (id inexistente)`))
  else console.log(aviso(`${etiqueta.padEnd(31)} HTTP ${r.estado} ${JSON.stringify(r.cuerpo)}`))
}

// Recuperación sin sesión: no debe revelar si el correo existe, así que
// responde 200 también con uno inventado.
const recuperar = await pedir('/password/recuperar', {
  method: 'POST',
  headers: json(),
  body: JSON.stringify({ correo: 'no-existe-en-ninguna-parte@sicedu.test' }),
})
console.log(
  recuperar.estado === 200
    ? ok('POST  /password/recuperar       200 sin revelar si el correo existe')
    : fallo(`POST  /password/recuperar       HTTP ${recuperar.estado} ${JSON.stringify(recuperar.cuerpo)} — si distingue el correo inexistente, filtra qué cuentas hay`),
)

const restablecer = await pedir('/password/restablecer', {
  method: 'POST',
  headers: json(),
  body: JSON.stringify({
    correo: 'no-existe-en-ninguna-parte@sicedu.test',
    codigo: '000000',
    'contraseña_nueva': 'PruebaFalsa12345',
    'confirmar_contraseña_nueva': 'PruebaFalsa12345',
  }),
})
console.log(
  restablecer.estado && restablecer.estado !== 404 && restablecer.estado !== 405
    ? ok(`POST  /password/restablecer     HTTP ${restablecer.estado} — publicado (rechaza el código falso)`)
    : fallo(`POST  /password/restablecer     HTTP ${restablecer.estado}`),
)

console.log(
  algunoPublicado
    ? '\nHay endpoints de negocio publicados: toca revisar src/api/endpoints.js.\n'
    : '\nMientras el negocio siga en 404, VITE_USE_MOCK=true y VITE_AUTH_REAL=true.\n' +
        `Documentación viva: ${baseURL}/docs\n`,
)
