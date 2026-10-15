// Cubre: RNF-003
import { useState } from 'react'
import { KeyRound, MailCheck } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Stepper from '../../components/ui/Stepper'
import { useToast } from '../../components/ui/Toast'
import { cambiarPasswordConCodigo, solicitarCodigoRecuperacion, verificarCodigoRecuperacion } from '../../api/resources/auth'
import { mensajeDeError } from '../../api/client'
import { REQUISITOS_PASSWORD, esPinValido, requisitosIncumplidos } from '../../lib/validacion'
import useConexion from '../../hooks/useConexion'

/**
 * Cambio de contraseña del usuario con sesión iniciada (APIS_BACKEND.md).
 *
 * Son tres llamadas y el orden importa:
 *   1. `POST /me/password/codigo`            envía un código de 6 caracteres al correo
 *   2. `POST /me/password/verificar-codigo`  solo para avisar al instante si es correcto
 *   3. `POST /me/password`                   cambia la contraseña, y vuelve a pedir el código
 *
 * El paso 2 NO consume el código: el backend lo revalida en el paso 3, así que
 * el código se guarda en el estado de esta pantalla y se reenvía al final.
 *
 * Los tres endpoints exigen `Authorization`, por eso esto vive en el menú de
 * usuario y no en la pantalla de inicio de sesión.
 */
const PASOS = ['Pedir código', 'Verificar código', 'Nueva contraseña']

/**
 * CU004 cubre recuperar Y cambiar la contraseña: las dos exigen conexión, y las
 * dos aplican la política de CU006 (8 caracteres, mayúscula, minúscula, número
 * y carácter especial), que vive en `lib/validacion`.
 */
const SIN_CONEXION =
  'No es posible recuperar o cambiar la contraseña sin conexión a Internet. Conéctese a Internet e inténtelo nuevamente.'

export default function ModalCambiarPassword({ abierto, onCerrar }) {
  const toast = useToast()
  const enLinea = useConexion()
  const [paso, setPaso] = useState(0)
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
      await solicitarCodigoRecuperacion()
      toast.success('PIN enviado', 'Revise su correo institucional. Caduca en 15 minutos.')
      setPaso(1)
    } catch (error) {
      toast.error('No se pudo enviar el código', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function verificar() {
    setOcupado(true)
    try {
      await verificarCodigoRecuperacion({ codigo: codigo.trim() })
      setPaso(2)
    } catch (error) {
      toast.error('Código incorrecto', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function guardar() {
    setOcupado(true)
    try {
      await cambiarPasswordConCodigo({
        codigo: codigo.trim(),
        'contraseña_nueva': password,
        'confirmar_contraseña_nueva': confirmacion,
      })
      toast.success('Contraseña actualizada', 'Úsela la próxima vez que inicie sesión.')
      cerrar()
    } catch (error) {
      toast.error('No se pudo actualizar la contraseña', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  const faltan = requisitosIncumplidos(password)
  const formatoValido = faltan.length === 0
  const coinciden = password === confirmacion
  const puedeGuardar = enLinea && formatoValido && coinciden && esPinValido(codigo.trim())

  return (
    <Modal
      open={abierto}
      onClose={cerrar}
      size="max-w-lg"
      title="Cambiar contraseña"
      subtitle="Le enviaremos un código a su correo institucional para confirmar que es usted"
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          {paso === 0 && <Button loading={ocupado} iconLeft={MailCheck} onClick={pedirCodigo}>Enviarme el código</Button>}
          {paso === 1 && <Button loading={ocupado} disabled={codigo.trim().length < 6} onClick={verificar}>Verificar</Button>}
          {paso === 2 && <Button loading={ocupado} disabled={!puedeGuardar} onClick={guardar}>Guardar contraseña</Button>}
        </>
      }
    >
      <Stepper steps={PASOS} current={paso} />

      {!enLinea && (
        <p role="alert" className="mt-4 rounded-xl border border-warning-600/20 bg-warning-100 p-4 text-sm font-medium text-warning-600">
          {SIN_CONEXION}
        </p>
      )}

      <div className="mt-5">
        {paso === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-info-600/20 bg-info-100 p-4 text-sm text-ink-700">
            <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-info-600" aria-hidden="true" />
            <p>
              Se enviará un PIN de 6 dígitos a su correo institucional. Caduca a los 15 minutos y
              solo sirve una vez.
            </p>
          </div>
        )}

        {paso === 1 && (
          <Input
            label="Código recibido"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            hint="Son 6 dígitos. Si no llegó, cierre y vuelva a pedirlo."
          />
        )}

        {paso === 2 && (
          <div className="flex flex-col gap-4">
            <Input
              label="Nueva contraseña"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Debe cumplir los cinco requisitos de abajo"
            />
            {/* CU006 pide decir QUÉ falta, no solo que la contraseña no vale. */}
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
              error={confirmacion && !coinciden ? 'Las contraseñas no coinciden' : undefined}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
