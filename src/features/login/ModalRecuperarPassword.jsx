// Cubre: RF-001, RNF-003
import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Stepper from '../../components/ui/Stepper'
import { useToast } from '../../components/ui/Toast'
import { recuperarPassword, restablecerPassword, verificarCodigoPublico } from '../../api/resources/auth'
import { mensajeDeError, motivoDe } from '../../api/client'
import { REQUISITOS_PASSWORD, esCorreoValido, esPinValido, requisitosIncumplidos } from '../../lib/validacion'
import useConexion from '../../hooks/useConexion'

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
/**
 * TRES pasos, no dos. CU006 exige un "proceso estricto de dos pasos" a nivel de
 * interfaz: el PIN se valida POR SEPARADO y solo después aparece un formulario
 * nuevo y exclusivo para la contraseña. Antes se pedían PIN y contraseña en la
 * misma pantalla, así que un PIN equivocado se descubría después de escribir y
 * repetir la contraseña entera.
 */
const PASOS = ['Pedir PIN', 'Verificar PIN', 'Nueva contraseña']

/** Textos literales de CU004, CU005 y CU006. */
export const MENSAJE = {
  enviado: 'Si el correo está registrado y activo, recibirá un PIN.',
  sinConexion:
    'No es posible recuperar o cambiar la contraseña sin conexión a Internet. Conéctate a Internet e inténtalo nuevamente.',
  pinIncorrecto: 'El código ingresado es incorrecto. Inténtalo nuevamente.',
  pinExpirado: 'El código ha expirado. Solicite un nuevo PIN.',
  // Texto nuevo del contrato, literal.
  pinAgotado: 'Ha agotado los intentos permitidos. Solicite un nuevo PIN para continuar.',
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
  /**
   * PIN agotado: el campo se BLOQUEA hasta pedir uno nuevo (CU006).
   *
   * Y persiste: si se recarga la página e intenta otro código, el servidor
   * responde lo mismo. Antes el estado se perdía y el siguiente intento volvía
   * a decir "incorrecto", que da a entender que aún quedan oportunidades.
   */
  const [agotado, setAgotado] = useState(false)

  function cerrar() {
    setPaso(0)
    setCodigo('')
    setPassword('')
    setConfirmacion('')
    setAgotado(false)
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
      // Un PIN nuevo arranca con su contador de intentos a 0: se desbloquea.
      setAgotado(false)
      setCodigo('')
      setPaso(1)
    } catch (error) {
      toast.error('No se pudo enviar el PIN', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  /** Paso 2: validar el PIN sin gastarlo. Solo si vale se pide la contraseña. */
  async function verificarPin() {
    setOcupado(true)
    try {
      await verificarCodigoPublico({ correo: correo.trim(), codigo: codigo.trim() })
      setPaso(2)
    } catch (error) {
      if (motivoDe(error) === 'intentos_agotados') setAgotado(true)
      toast.error('No se pudo verificar el PIN', mensajeDelPin(error))
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
      toast.success('Contraseña actualizada', 'Vuelve a iniciar sesión con la nueva contraseña.')
      cerrar()
    } catch (error) {
      if (motivoDe(error) === 'intentos_agotados') {
        setAgotado(true)
        // El PIN murió: se vuelve al paso del código, que queda bloqueado
        // hasta pedir uno nuevo.
        setPaso(1)
      }
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
  const puedeGuardar = enLinea && formatoValido && coinciden
  const puedeVerificar = enLinea && pinValido && !agotado

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
          {paso === 0 && (
            <Button loading={ocupado} disabled={!correoValido || !enLinea} iconLeft={MailCheck} onClick={pedirCodigo}>
              Enviarme el PIN
            </Button>
          )}
          {paso === 1 && (
            <>
              {/* Con el PIN agotado, la única salida es pedir otro. */}
              <Button variant="outline" loading={ocupado} disabled={!enLinea} onClick={pedirCodigo}>
                Pedir un PIN nuevo
              </Button>
              {/* "Verificar y continuar" y no "Verificar PIN": el Stepper
                  pinta cada paso como un botón, así que ese nombre existía dos
                  veces en la misma pantalla y un lector de pantalla no podía
                  distinguir el paso de la acción. */}
              <Button loading={ocupado} disabled={!puedeVerificar} onClick={verificarPin}>
                Verificar y continuar
              </Button>
            </>
          )}
          {paso === 2 && (
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
          disabled={paso > 0}
          placeholder="nombre@sicedu.test"
        />

        {paso === 1 && (
          <>
            <p className="rounded-xl border border-info-600/20 bg-info-100 p-4 text-sm text-ink-700">
              {MENSAJE.enviado} El PIN tiene 6 dígitos, caduca en 15 minutos, admite 5 intentos y solo sirve
              una vez.
            </p>
            {agotado && (
              <p role="alert" className="rounded-xl border border-danger-600/20 bg-danger-100 p-4 text-sm font-medium text-danger-600">
                {MENSAJE.pinAgotado}
              </p>
            )}
            <Input
              label="PIN recibido"
              required
              value={codigo}
              inputMode="numeric"
              autoComplete="one-time-code"
              // CU006: al agotar los intentos el campo se BLOQUEA, para que no
              // se sigan probando códigos sobre un PIN que ya está muerto.
              disabled={agotado}
              /* CU005: son 6 DÍGITOS. Se filtra al teclear para que no se pueda
                 escribir una letra y luego culpar al servidor del rechazo. */
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              placeholder="123456"
            />
          </>
        )}

        {paso === 2 && (
          <>
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

      </div>
    </Modal>
  )
}
