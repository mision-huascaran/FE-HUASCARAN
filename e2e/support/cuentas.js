// Cuentas E2E. Las crea el seed del backend en cada despliegue de qa
// (`python -m app.cli sembrar-e2e`). Las credenciales SIEMPRE salen del entorno:
// nunca se escriben aquí ni se imprimen.
export const ROLES_E2E = ['docente', 'supervisor', 'directivo', 'inactivo']

export const VARIABLES_REQUERIDAS = ROLES_E2E.flatMap((rol) => {
  const prefijo = `E2E_${rol.toUpperCase()}`
  return [`${prefijo}_USER`, `${prefijo}_PASS`]
})

/** Datos fijos del seed (no son secretos). */
export const SEED = {
  colegio: 'I.E. E2E Playwright',
  docente: 'E2E Docente Playwright',
}

export function cuentaDe(rol) {
  const prefijo = `E2E_${rol.toUpperCase()}`
  const usuario = process.env[`${prefijo}_USER`]
  const password = process.env[`${prefijo}_PASS`]
  if (!usuario || !password) throw new Error(`Faltan ${prefijo}_USER o ${prefijo}_PASS (ver e2e/README.md)`)
  return { usuario, password }
}
