// Cubre: RF-001, RNF-002, RNF-003, RNF-004 - CU001 y CU002.
//
// Los textos de error NO son libres: CU002 los fija palabra por palabra, para
// que el mensaje no delate si un correo existe. Se definen en MENSAJE y se usan
// tal cual; cambiarlos rompe el caso de uso.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Mail } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import PanelBienvenida from './PanelBienvenida'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ModalRecuperarPassword from './ModalRecuperarPassword'
import Logo from '../../components/ui/Logo'
import { useAuth } from '../../auth/AuthProvider'
import { destinoTrasLogin } from '../../rutas'
import { estadoDe, mensajeDeError } from '../../api/client'
import useConexion from '../../hooks/useConexion'
import CredencialesDemo from './CredencialesDemo'

/** Textos literales de CU001 y CU002. No se improvisan ni se traducen. */
export const MENSAJE = {
  sinConexion:
    'No se pudo establecer conexión con el servidor. Para iniciar sesión es necesario disponer de conexión a Internet.',
  credenciales: 'Correo o contraseña incorrectos.',
  bloqueo: 'Demasiados intentos fallidos. Por seguridad, intente nuevamente en 15 minutos.',
  desactivada: 'Su cuenta se encuentra desactivada. Comuníquese con el Supervisor para solicitar su habilitación.',
}

const esquema = z.object({
  correo: z.string().min(1, 'Ingrese su correo').email('Ingrese un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export default function LoginPage() {
  const { entrar, autenticado, usuario, motivoCierre, limpiarMotivoCierre } = useAuth()
  const navegar = useNavigate()
  const { state } = useLocation()
  const [errorGeneral, setErrorGeneral] = useState(null)
  // El inicio de sesión NUNCA es offline: hace falta el servidor para validar
  // las credenciales y emitir el token. Se avisa antes de dejar escribir.
  const enLinea = useConexion()
  const [resetAbierto, setResetAbierto] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: { correo: '', password: '' } })

  if (autenticado) return <Navigate to={destinoTrasLogin(state?.desde, usuario.id_rol)} replace />

  const enviar = async ({ correo, password }) => {
    setErrorGeneral(null)
    limpiarMotivoCierre()
    try {
      const perfil = await entrar({ correo, password })
      navegar(destinoTrasLogin(state?.desde, perfil.id_rol), { replace: true })
    } catch (error) {
      const estado = estadoDe(error)

      /**
       * El backend puede responder 401 TAMBIÉN para una cuenta desactivada
       * (api_sicedu_frontend §3.1: "401/403, ver /docs"), y en ese caso el
       * texto correcto es el de la cuenta deshabilitada, no el de credenciales.
       * Por eso se prefiere su `detail`, que ya viene redactado palabra por
       * palabra como pide CU002; los textos locales son solo el respaldo.
       */
      if (estado === 401) {
        setErrorGeneral(mensajeDeError(error, MENSAJE.credenciales))
        return
      }
      // 429: cinco intentos seguidos fallidos bloquean ese correo 15 minutos,
      // exista la cuenta o no. El bloqueo no desactiva nada.
      if (estado === 429) {
        setErrorGeneral(mensajeDeError(error, MENSAJE.bloqueo))
        return
      }
      // Credenciales correctas pero cuenta dada de baja. El texto lo fija
      // CU002: se ignora el del servidor para no decir de más.
      if (estado === 403) {
        setErrorGeneral(mensajeDeError(error, MENSAJE.desactivada))
        return
      }
      if (estado) {
        setErrorGeneral(mensajeDeError(error, 'No se pudo iniciar sesión. Intente nuevamente.'))
        return
      }
      // Sin respuesta del servidor: para CU001 es el mismo caso que estar sin red.
      setErrorGeneral(MENSAJE.sinConexion)
    }
  }

  const cerrarReset = () => setResetAbierto(false)



  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <PanelBienvenida />

      <main className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Logo tone="dark" size="lg" />

          <h1 className="mt-8 text-2xl font-bold text-ink-900 md:text-3xl">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-500">Ingrese con el correo institucional que le asignaron.</p>

          {/* CU007: si la sesión venció sola hay que decirlo, o el usuario
              aparece aquí sin saber por qué y cree que perdió su trabajo. */}
          {motivoCierre === 'expiracion' && (
            <div
              role="status"
              className="mt-6 flex items-start gap-2 rounded-lg border border-info-600/20 bg-info-100 p-3 text-sm font-medium text-info-600"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Su sesión terminó por alcanzar su tiempo máximo de 8 horas. Los cambios que no se
                hubieran enviado siguen guardados y se sincronizarán al volver a entrar.
              </span>
            </div>
          )}

          {!enLinea && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg border border-warning-600/20 bg-warning-100 p-3 text-sm font-medium text-warning-600"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {MENSAJE.sinConexion}
            </div>
          )}

          {errorGeneral && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg border border-danger-600/20 bg-danger-100 p-3 text-sm font-medium text-danger-600"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {errorGeneral}
            </div>
          )}

          <form onSubmit={handleSubmit(enviar)} className="mt-6 flex flex-col gap-4" noValidate>
            <Input
              label="Correo"
              type="email"
              autoComplete="username"
              placeholder="nombre@sicedu.test"
              iconLeft={Mail}
              required
              error={errors.correo?.message}
              {...register('correo')}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-end gap-2">
              {/* CU001: sin conexión también se deshabilita y se ve gris. El
                  proceso de recuperación necesita servidor de principio a fin. */}
              <button
                type="button"
                disabled={!enLinea}
                onClick={() => setResetAbierto(true)}
                className="text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:text-ink-400 disabled:hover:text-ink-400"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            <Button type="submit" loading={isSubmitting} disabled={!enLinea} className="w-full">
              Ingresar
            </Button>
          </form>

          <CredencialesDemo onUsar={(correo, password) => {
            setValue('correo', correo, { shouldValidate: true })
            setValue('password', password, { shouldValidate: true })
          }}
          />

          <ModalRecuperarPassword
            abierto={resetAbierto}
            onCerrar={cerrarReset}
            correoInicial={watch('correo') ?? ''}
          />

          <footer className="mt-10 border-t border-line pt-4 text-xs text-ink-400">
            <p>Conexión cifrada (TLS).</p>
            <p className="mt-1">
              Los datos de los estudiantes se tratan conforme a la Ley N.° 29733 de Protección de Datos
              Personales.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
