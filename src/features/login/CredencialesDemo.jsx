import { authContraApiReal, usarMock } from '../../api/client'
import { CLAVE_DEMO, USUARIOS } from '../../api/mock/db'
import { NOMBRE_ROL, ROLES } from '../../auth/roles'

/**
 * Atajo para revisar la aplicación sin escribir credenciales a mano.
 *
 * Muestra las cuentas que sirven según de dónde venga la sesión:
 *  - autenticación real  → los usuarios sembrados por `python -m app.seed_data`
 *    (APIS_BACKEND.md): Profesor, Jefa_Profesores y Directivos.
 *  - modo mock           → los cinco usuarios de `db.js`.
 *
 * Solo se renderiza en desarrollo: en una construcción de producción este
 * bloque no existe y ninguna credencial queda escrita en la interfaz.
 */

/** Usuarios sembrados en la base de datos del backend. */
const CUENTAS_BACKEND = [
  { id: 'docente', correo: 'profesor.prueba@sicedu.test', password: 'ProfesorTest123', idRol: ROLES.PROFESOR },
  { id: 'supervisor', correo: 'jefa.prueba@sicedu.test', password: 'JefaTest123', idRol: ROLES.JEFA },
  { id: 'directivo', correo: 'directivo.prueba@sicedu.test', password: 'DirectivoTest123', idRol: ROLES.DIRECTIVOS },
]

export default function CredencialesDemo({ onUsar }) {
  if (!import.meta.env.DEV) return null

  const cuentas = authContraApiReal
    ? CUENTAS_BACKEND
    : [ROLES.PROFESOR, ROLES.JEFA, ROLES.DIRECTIVOS].map((idRol) => {
        const u = USUARIOS.find((usuario) => usuario.id_rol === idRol)
        return { id: u.id_usuario, correo: u.correo, password: CLAVE_DEMO, idRol: u.id_rol }
      })

  return (
    <section className="mt-8 rounded-xl border border-dashed border-line-strong bg-surface-0 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        {authContraApiReal ? 'Cuentas del backend (desarrollo)' : 'Datos de prueba (modo mock)'}
      </h2>

      <ul className="mt-3 flex flex-col gap-1.5">
        {cuentas.map((cuenta) => (
          <li key={cuenta.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink-700">{cuenta.correo}</span>
              <span className="block text-xs text-ink-400">{NOMBRE_ROL[cuenta.idRol]}</span>
            </span>
            <button
              type="button"
              onClick={() => onUsar(cuenta.correo, cuenta.password)}
              className="shrink-0 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              Usar
            </button>
          </li>
        ))}
      </ul>

      {authContraApiReal ? (
        <p className="mt-3 text-xs text-ink-400">
          La sesión se valida contra la API real.
          {usarMock && ' El resto de los datos sigue viniendo del mock: el backend aún no publica endpoints de negocio.'}
        </p>
      ) : (
        <p className="mt-3 text-xs text-ink-400">
          Contraseña para los tres: <span className="font-semibold text-ink-700">{CLAVE_DEMO}</span>
        </p>
      )}
    </section>
  )
}
