// CU001 — Recuperar la cuenta del Supervisor original con una Recovery Key.
//
// Es la salida de emergencia del sistema, y se diseña como tal:
//
//   · Llega desde un enlace DISCRETO dentro de la recuperación normal, no desde
//     un botón en el login. Quien no sepa qué es, no debe tropezarse con ella.
//   · Avisa de que la llave se gasta para siempre y de cuántas quedan, porque
//     son diez y no se regeneran solas.
//   · Avisa de que la comprobación tarda unos segundos. El backend se demora a
//     propósito —el mismo tiempo acierte o falle, para que nadie deduzca por la
//     espera si la llave era buena—, y sin decirlo la pantalla parecería colgada.
import { useState } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { recuperarConLlave } from '../../api/resources/auth'
import { mensajeDeError } from '../../api/client'
import { REQUISITOS_PASSWORD, esCorreoValido, requisitosIncumplidos } from '../../lib/validacion'
import useConexion from '../../hooks/useConexion'
import { MENSAJE } from './ModalRecuperarPassword'

export default function ModalRecoveryKey({ abierto, onCerrar, correoInicial = '' }) {
  const toast = useToast()
  const enLinea = useConexion()
  const [correo, setCorreo] = useState(correoInicial)
  const [llave, setLlave] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)

  function cerrar() {
    setLlave('')
    setPassword('')
    setConfirmacion('')
    setOcupado(false)
    onCerrar()
  }

  async function recuperar() {
    setOcupado(true)
    try {
      const resultado = await recuperarConLlave({
        correo: correo.trim(),
        llave: llave.trim(),
        passwordNueva: password,
        confirmacion,
      })

      const quedan = resultado?.llaves_restantes
      toast.success(
        'Acceso recuperado',
        quedan == null
          ? 'Inicie sesión con la contraseña nueva.'
          : `Le quedan ${quedan} llave${quedan === 1 ? '' : 's'} de recuperación. Guárdelas bien.`,
      )
      cerrar()
    } catch (error) {
      toast.error('No se pudo recuperar la cuenta', mensajeDeError(error))
    } finally {
      setOcupado(false)
    }
  }

  const faltan = requisitosIncumplidos(password)
  const coinciden = password === confirmacion
  const puede = enLinea && esCorreoValido(correo.trim()) && llave.trim().length >= 8 && faltan.length === 0 && coinciden

  return (
    <Modal
      open={abierto}
      onClose={cerrar}
      size="max-w-lg"
      title="Recuperar con llave de emergencia"
      subtitle="Solo para la cuenta de Supervisor original"
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          <Button loading={ocupado} disabled={!puede} iconLeft={KeyRound} onClick={recuperar}>
            Recuperar acceso
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-xl border border-warning-600/20 bg-warning-100 p-4 text-sm text-ink-700">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
          <span>
            Cada llave sirve <strong>una sola vez</strong> y queda inutilizada al usarla. Son diez y
            no se generan de nuevo: úselas solo si no hay otra forma de entrar.
          </span>
        </p>

        {!enLinea && (
          <p role="alert" className="rounded-xl border border-warning-600/20 bg-warning-100 p-4 text-sm font-medium text-warning-600">
            {MENSAJE.sinConexion}
          </p>
        )}

        <Input
          label="Correo institucional"
          type="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="nombre@sicedu.test"
        />

        <Input
          label="Llave de recuperación"
          required
          value={llave}
          onChange={(e) => setLlave(e.target.value.trim())}
          autoComplete="off"
          spellCheck={false}
          hint="Una de las diez del archivo entregado a la dirección"
        />

        <Input
          label="Nueva contraseña"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {/* La misma política de CU006: decir QUÉ falta, no solo que no vale. */}
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

        {ocupado && (
          <p role="status" className="text-sm text-ink-500">
            Comprobando la llave. Esto tarda unos segundos a propósito, por seguridad: no cierre la
            ventana.
          </p>
        )}
      </div>
    </Modal>
  )
}
