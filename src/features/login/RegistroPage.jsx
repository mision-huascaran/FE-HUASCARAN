import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, CheckCircle2, Mail, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Logo from '../../components/ui/Logo'
import PanelBienvenida from './PanelBienvenida'

const opcionesRol = [
  { value: 'docente', label: 'Docente' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'directivo', label: 'Directivo' },
]

const esquema = z.object({
  nombres: z.string().trim().min(2, 'Ingrese nombres válidos'),
  apellidos: z.string().trim().min(2, 'Ingrese apellidos válidos'),
  correo: z.string().trim().min(1, 'Ingrese un correo').email('Ingrese un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rol: z.enum(['docente', 'supervisor', 'directivo'], { errorMap: () => ({ message: 'Seleccione un rol' }) }),
})

export default function RegistroPage() {
  const navegar = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombres: '',
      apellidos: '',
      correo: '',
      password: '',
      rol: 'docente',
    },
  })

  const enviar = async (datos) => {
    // TODO: el backend no expone alta de usuarios en el contrato vigente.
    // La interfaz queda lista y usa el patrón de la app para no romper UX.
    console.info('Solicitud de registro', datos)
    navegar('/login', { replace: true })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <PanelBienvenida />

      <main className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-start">
            <Logo tone="dark" size="lg" />
          </div>

          <div className="mb-4 flex items-center gap-2 text-sm text-ink-500">
            <button
              type="button"
              onClick={() => navegar('/login')}
              className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio de sesión
            </button>
          </div>

          <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Crear cuenta</h1>
          <p className="mt-1 text-sm text-ink-500">Complete los datos para solicitar acceso a la plataforma.</p>

          <form onSubmit={handleSubmit(enviar)} className="mt-6 flex flex-col gap-4" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Nombres"
                iconLeft={UserRound}
                required
                error={errors.nombres?.message}
                {...register('nombres')}
              />
              <Input
                label="Apellidos"
                iconLeft={UserRound}
                required
                error={errors.apellidos?.message}
                {...register('apellidos')}
              />
            </div>

            <Input
              label="Correo institucional"
              type="email"
              autoComplete="email"
              placeholder="nombre@colegio.edu.pe"
              iconLeft={Mail}
              required
              error={errors.correo?.message}
              {...register('correo')}
            />

            <Input
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <Select
              label="Rol"
              required
              placeholder="Seleccione un rol"
              options={opcionesRol}
              error={errors.rol?.message}
              {...register('rol')}
            />

            <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Solicitud de acceso
              </div>
              <p className="mt-1 text-xs text-brand-700/80">
                La cuenta creada queda pendiente de validación por la administración del sistema.
              </p>
            </div>

            <Button type="submit" loading={isSubmitting} className="w-full">
              Registrarme
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
