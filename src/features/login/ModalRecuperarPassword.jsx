// Cubre: RF-001, RNF-003
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Stepper from '../../components/ui/Stepper'
import { useToast } from '../../components/ui/Toast'
import { recuperarPassword, restablecerPassword } from '../../api/resources/auth'
import { mensajeDeError } from '../../api/client'
import { REQUISITOS_PASSWORD, esCorreoValido, esPinValido, requisitosIncumplidos } from '../../lib/validacion'
import useConexion from '../../hooks/useConexion'
import ModalRecoveryKey from './ModalRecoveryKey'

/**
 * "Olvidé mi contraseña", desde el login y SIN sesión iniciada.
 *
 * Dos llamadas públicas: `POST /password/recuperar` manda un código de 6
 * caracteres al correo, y `POST /password/restablecer` lo canjea por la
 * contraseña nueva.
 *
 * El primero responde 200 SIEMPRE, exista el correo o no —así nadie puede usar
 * el formulario para averiguar quién tiene cuenta—, de modo que esta pantalla
 * nunca afirma que el correo existe: solo dice "si está registrado, le llegará".
 */
const PASOS = ['Pedir PIN', 'Nueva contraseña']

/** Textos literales de CU004, CU005 y CU006. */
export const MENSAJE = {
  enviado: 'Si el correo está registrado y activo, recibirá un PIN.',
  sinConexion:
    'No es posible recuperar o cambiar la contraseña sin conexión a Internet. Conéctese a Internet e inténtelo nuevamente.',
  pinIncorrecto: 'El código ingresado es incorrecto. Inténtelo nuevamente.',
  pinExpirado: 'El código ha expirado. Solicite un nuevo PIN.',
  pinAgotado: 'Se alcanzó el número máximo de intentos permitidos. Solicite un nuevo PIN para continuar.',
  noCoinciden: 'Las contraseñas no coinciden.',
  igualAnterior: 'La nueva contraseña debe ser diferente de la contraseña anterior.',
}

/**
 * CU006 distingue PIN incorrecto, expirado y agotado, pero hoy el backend
 * responde 400 con un único texto para los tres. Se traduce por el `motivo` que
 * se le ha pedido añadir (APIS_BACKEND.md §12) y, mientras no llegue, se usa su
 * mensaje tal cual en vez de inventar cuál de los tres fue.
 */
function mensajeDelPin(error) {
  const motivo = error?.response?.data?.motivo
  if (motivo === 'expirado') return MENSAJE.pinExpirado
  if (motivo === 'intentos_agotados') return MENSAJE.pinAgotado
  if (motivo === 'incorrecto') return MENSAJE.pinIncorrecto
  if (motivo === 'password_igual') return MENSAJE.igualAnterior
  return mensajeDeError(error)
}

export default function ModalRecuperarPassword({ abierto, onCerrar, correoInicial = '' }) {
  const toast = useToast()
  const enLinea = useConexion()
  const [paso, setPaso] = useState(0)
  const [correo, setCorreo] = useState(correoInicial)
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)
  // CU001: la vía de emergencia del Supervisor original. Va escondida aquí
  // dentro, no en el login: quien no sepa qué es no debe tropezarse con ella.
  const [conLlave, setConLlave] = useState(false)

  function cerrar() {
    setPaso(0)
    setCodigo('')
    setPassword('')
    setConfirmacion('')
    setOcupado(false)
    onCerrar()
  }

  async function pedirCodigo() {
    setOcupado(true)
    try {
      await recuperarPassword({ correo: correo.trim() })
      // El mismo texto exista el correo o no: distinguir permitiría averiguar
      // quién tiene cuenta probando direcciones (CU005).
      toast.success('Solicitud enviada', MENSAJE.enviado)
      setPaso(1)
    } catch (error) {
      toast.error('No se pudo enviar el PIN', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function restablecer() {
    setOcupado(true)
    try {
      await restablecerPassword({
        correo: correo.trim(),
        codigo: codigo.trim(),
        passwordNueva: password,
        confirmacion,
      })
      // CU006: el restablecimiento invalida TODAS las sesiones del usuario, así
      // que hay que volver a entrar aunque ya se estuviera dentro.
      toast.success('Contraseña actualizada', 'Vuelva a iniciar sesión con la nueva contraseña.')
      cerrar()
    } catch (error) {
      toast.error('No se pudo cambiar la contraseña', mensajeDelPin(error))
    } finally {
      setOcupado(false)
    }
  }

  const correoValido = esCorreoValido(correo.trim())
  const faltan = requisitosIncumplidos(password)
  const formatoValido = faltan.length === 0
  const coinciden = password === confirmacion
  const pinValido = esPinValido(codigo.trim())
  const puedeGuardar = enLinea && pinValido && formatoValido && coinciden

  return (
    <Modal
      open={abierto}
      onClose={cerrar}
      size="max-w-lg"
      title="Recuperar contraseña"
      subtitle="Le enviaremos un PIN a su correo institucional"
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          {paso === 0 ? (
            <Button loading={ocupado} disabled={!correoValido || !enLinea} iconLeft={MailCheck} onClick={pedirCodigo}>
              Enviarme el PIN
            </Button>
          ) : (
            <Button loading={ocupado} disabled={!puedeGuardar} onClick={restablecer}>
              Cambiar contraseña
            </Button>
          )}
        </>
      }
    >
      <Stepper steps={PASOS} current={paso} />

      {/* CU004: sin conexión no se puede ni pedir el PIN ni cambiar nada. */}
      {!enLinea && (
        <p role="alert" className="mt-4 rounded-xl border border-warning-600/20 bg-warning-100 p-4 text-sm font-medium text-warning-600">
          {MENSAJE.sinConexion}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4">
        <Input
          label="Correo institucional"
          type="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          disabled={paso === 1}
          placeholder="nombre@sicedu.test"
        />

        {paso === 1 && (
          <>
            <p className="rounded-xl border border-info-600/20 bg-info-100 p-4 text-sm text-ink-700">
              {MENSAJE.enviado} El PIN tiene 6 dígitos, caduca en 15 minutos, admite 5 intentos y solo sirve
              una vez.
            </p>
            <Input
              label="PIN recibido"
              required
              value={codigo}
              inputMode="numeric"
              autoComplete="one-time-code"
              /* CU005: son 6 DÍGITOS. Se filtra al teclear para que no se pueda
                 escribir una letra y luego culpar al servidor del rechazo. */
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              placeholder="123456"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* CU006 pide decir QUÉ requisitos faltan, no solo que no vale. */}
            <ul className="-mt-2 flex flex-col gap-1 text-xs">
              {REQUISITOS_PASSWORD.map((requisito) => {
                const cumple = requisito.cumple(password)
                return (
                  <li key={requisito.id} className={cumple ? 'text-success-600' : 'text-ink-400'}>
                    {cumple ? '✓' : '○'} {requisito.texto}
                  </li>
                )
              })}
            </ul>
            <Input
              label="Repita la nueva contraseña"
              type="password"
              required
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              error={confirmacion && !coinciden ? MENSAJE.noCoinciden : undefined}
            />
          </>
        )}

        {paso === 0 && (
          <button
            type="button"
            onClick={() => setConLlave(true)}
            className="self-start text-xs text-ink-400 underline underline-offset-2 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            ¿Es la cuenta de Supervisor original y no recibe el correo?
          </button>
        )}
      </div>

      <ModalRecoveryKey
        abierto={conLlave}
        correoInicial={correo}
        onCerrar={() => {
          setConLlave(false)
          cerrar()
        }}
      />
    </Modal>
  )
}
