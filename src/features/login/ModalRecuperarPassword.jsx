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
import { esCorreoValido } from '../../lib/validacion'

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
const PASOS = ['Pedir código', 'Nueva contraseña']

// El backend exige mínimo 8 caracteres, solo letras y números.
const FORMATO = /^[A-Za-z0-9]{8,}$/

export default function ModalRecuperarPassword({ abierto, onCerrar, correoInicial = '' }) {
  const toast = useToast()
  const [paso, setPaso] = useState(0)
  const [correo, setCorreo] = useState(correoInicial)
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)

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
      setPaso(1)
    } catch (error) {
      toast.error('No se pudo enviar el código', mensajeDeError(error))
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
      toast.success('Contraseña actualizada', 'Ya puede iniciar sesión con la nueva.')
      cerrar()
    } catch (error) {
      // Un 400 puede ser código incorrecto, caducado, ya usado o correo
      // inexistente: el backend no los distingue, así que se muestra su mensaje.
      toast.error('No se pudo cambiar la contraseña', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  const correoValido = esCorreoValido(correo.trim())
  const formatoValido = FORMATO.test(password)
  const coinciden = password === confirmacion
  const puedeGuardar = codigo.trim().length === 6 && formatoValido && coinciden

  return (
    <Modal
      open={abierto}
      onClose={cerrar}
      size="max-w-lg"
      title="Recuperar contraseña"
      subtitle="Le enviaremos un código a su correo institucional"
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          {paso === 0 ? (
            <Button loading={ocupado} disabled={!correoValido} iconLeft={MailCheck} onClick={pedirCodigo}>
              Enviarme el código
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
              Si ese correo está registrado, le enviamos un código de 6 caracteres. Caduca en 10 minutos
              y solo sirve una vez.
            </p>
            <Input
              label="Código recibido"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="AB12CD"
            />
            <Input
              label="Nueva contraseña"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={password && !formatoValido ? 'Mínimo 8 caracteres, solo letras y números' : undefined}
              hint="Mínimo 8 caracteres, sin símbolos ni espacios"
            />
            <Input
              label="Repita la nueva contraseña"
              type="password"
              required
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              error={confirmacion && !coinciden ? 'Las contraseñas no coinciden' : undefined}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
