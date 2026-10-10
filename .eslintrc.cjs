/* Configuración de ESLint 8 (formato .eslintrc, el que corresponde a la versión
   instalada). El script `npm run lint` del package.json depende de este archivo. */

/**
 * Reglas de SonarJS y de seguridad, todas como AVISO.
 *
 * Adelantan en local lo que SonarQube marcaría en el Quality Gate (complejidad
 * cognitiva, código duplicado, regex vulnerables, etc.), sin romper `npm run
 * lint` en Jenkins: el pipeline no usa `--max-warnings`, así que un aviso no
 * detiene la build. Subir alguna a `error` es una decisión del equipo.
 */
const comoAviso = (reglas) =>
  Object.fromEntries(
    Object.entries(reglas).map(([regla, valor]) => {
      const nivel = Array.isArray(valor) ? valor[0] : valor
      if (nivel === 'off' || nivel === 0) return [regla, valor]
      return [regla, Array.isArray(valor) ? ['warn', ...valor.slice(1)] : 'warn']
    }),
  )
const reglasSonar = comoAviso(require('eslint-plugin-sonarjs').configs['recommended-legacy'].rules)
const reglasSeguridad = comoAviso(require('eslint-plugin-security').configs['recommended-legacy'].rules)

module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist', 'node_modules', 'coverage'],
  plugins: ['sonarjs', 'security'],
  rules: {
    ...reglasSonar,
    ...reglasSeguridad,
    // `recommended-legacy` la trae apagada; es la S3776 de SonarQube, con su
    // mismo umbral de 15.
    'sonarjs/cognitive-complexity': ['warn', 15],
    // El proyecto es JavaScript sin TypeScript: no se validan los props (§2).
    'react/prop-types': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // RNF-003 / RN-019: ningún dato de alumnos debe terminar en la consola.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Herramientas de terminal: imprimir es su trabajo y no corren en el
      // navegador, así que no pueden filtrar datos de alumnos a la consola.
      files: ['scripts/**'],
      rules: { 'no-console': 'off' },
    },
    {
      files: ['**/*.test.{js,jsx}', 'src/test/**'],
      globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', vi: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
    },
  ],
}
