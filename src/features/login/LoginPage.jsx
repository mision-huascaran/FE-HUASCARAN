// Cubre: RF-001, RNF-002, RNF-003, RNF-004
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Mail } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import PanelBienvenida from './PanelBienvenida'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Logo from '../../components/ui/Logo'
import { useAuth } from '../../auth/AuthProvider'
import { rutaInicioDe } from '../../auth/roles'
import { estadoDe, mensajeDeError } from '../../api/client'
import { cambiarPasswordConCodigo, solicitarCodigoRecuperacion, verificarCodigoRecuperacion } from '../../api/resources/auth'
import { useToast } from '../../components/ui/Toast'
import CredencialesDemo from './CredencialesDemo'

const esquema = z.object({
  correo: z.string().min(1, 'Ingrese su correo').email('Ingrese un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export default function LoginPage() {
  const { entrar, autenticado, usuario } = useAuth()
  const navegar = useNavigate()
  const { state } = useLocation()
  const toast = useToast()
  const [errorGeneral, setErrorGeneral] = useState(null)
  const [resetAbierto, setResetAbierto] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetCodigo, setResetCodigo] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmacion, setResetConfirmacion] = useState('')
  const [resetEnviando, setResetEnviando] = useState(false)
  const [resetPaso, setResetPaso] = useState('solicitar')

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(esquema), defaultValues: { correo: '', password: '' } })

  if (autenticado) return <Navigate to={state?.desde ?? rutaInicioDe(usuario.id_rol)} replace />

  const enviar = async ({ correo, password }) => {
    setErrorGeneral(null)
    try {
      const perfil = await entrar({ correo, password })
      navegar(state?.desde ?? rutaInicioDe(perfil.id_rol), { replace: true })
    } catch (error) {
      const estado = estadoDe(error)
      // Nunca se dice cuál de los dos campos falló (P1).
      if (estado === 401) {
        setErrorGeneral('Correo o contraseña incorrectos')
        return
      }
      setErrorGeneral('No se pudo conectar con el servidor. Intente nuevamente en unos segundos.')
    }
  }

  const cerrarReset = () => {
    setResetAbierto(false)
    setResetEmail('')
    setResetCodigo('')
    setResetPassword('')
    setResetConfirmacion('')
    setResetPaso('solicitar')
    setResetEnviando(false)
  }

  const pedirCodigo = async () => {
    if (!resetEmail.trim()) {
      toast.error('Falta el correo para recuperar la contraseña')
      return
    }

    setResetEnviando(true)
    try {
      await solicitarCodigoRecuperacion({ correo: resetEmail })
      setResetPaso('verificar')
      toast.success('Código enviado. Revisa tu correo institucional.')
    } catch (error) {
      toast.error('No se pudo enviar el código', mensajeDeError(error))
    } finally {
      setResetEnviando(false)
    }
  }

  const cambiarPassword = async () => {
    if (!resetCodigo.trim() || !resetPassword.trim() || !resetConfirmacion.trim()) {
      toast.error('Completa el código y la nueva contraseña')
      return
    }
    if (resetPassword.length < 8) {
      toast.error('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (resetPassword !== resetConfirmacion) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setResetEnviando(true)
    try {
      await verificarCodigoRecuperacion({ codigo: resetCodigo })
      await cambiarPasswordConCodigo({
        codigo: resetCodigo,
        contraseña_nueva: resetPassword,
        confirmar_contraseña_nueva: resetConfirmacion,
      })
      toast.success('Contraseña actualizada. Ya puedes volver a ingresar.')
      cerrarReset()
    } catch (error) {
      toast.error('No se pudo actualizar la contraseña', mensajeDeError(error))
    } finally {
      setResetEnviando(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <PanelBienvenida />

      <main className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Logo tone="dark" size="lg" />

          <h1 className="mt-8 text-2xl font-bold text-ink-900 md:text-3xl">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-500">Ingrese con el correo institucional que le asignaron.</p>

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
              <button
                type="button"
                onClick={() => setResetAbierto(true)}
                className="text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            <Button type="submit" loading={isSubmitting} className="w-full">
              Ingresar
            </Button>
          </form>

          <CredencialesDemo onUsar={(correo, password) => {
            setValue('correo', correo, { shouldValidate: true })
            setValue('password', password, { shouldValidate: true })
          }}
          />

          <Modal
            open={resetAbierto}
            onClose={cerrarReset}
            title="Recuperar contraseña"
            subtitle="Solicita un código de seguridad para restablecerla desde tu correo institucional."
            footer={
              <>
                <Button variant="ghost" onClick={cerrarReset}>Cancelar</Button>
                <Button
                  loading={resetEnviando}
                  onClick={resetPaso === 'solicitar' ? pedirCodigo : cambiarPassword}
                >
                  {resetPaso === 'solicitar' ? 'Enviar código' : 'Actualizar contraseña'}
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <Input
                label="Correo institucional"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="nombre@sicedu.test"
              />

              {resetPaso === 'verificar' && (
                <>
                  <Input
                    label="Código de verificación"
                    value={resetCodigo}
                    onChange={(e) => setResetCodigo(e.target.value)}
                    placeholder="AB12CD"
                  />
                  <Input
                    label="Nueva contraseña"
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                  <Input
                    label="Confirmar contraseña"
                    type="password"
                    value={resetConfirmacion}
                    onChange={(e) => setResetConfirmacion(e.target.value)}
                    placeholder="Repite la contraseña"
                  />
                </>
              )}
            </div>
          </Modal>

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
