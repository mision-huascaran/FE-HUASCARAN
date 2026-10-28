// CU001 — "Cambio de contraseña obligatorio en el primer ingreso".
//
// Toda cuenta nueva nace con una contraseña TEMPORAL de 48 horas y la marca de
// "cambio obligatorio" (CU016). Con ella, `/login` responde 403
// `cambio_contrasena_requerido` y no deja entrar a nada protegido: ni al Inicio
// ni a ningún módulo. También le pasa al Supervisor original en un entorno
// nuevo, que es justo quien no tiene a nadie por encima para rescatarlo.
//
// Lo que hace que esto sea una interrupción y no un trámite aparte: la
// respuesta de `POST /password/primer-ingreso` es LA MISMA que la de `/login`,
// token incluido. Al terminar, el usuario ya está dentro, con su sesión de 8
// horas, sin volver a escribir sus credenciales.
//
// Las credenciales temporales se quedan EN MEMORIA, nunca en LocalStorage ni en
// IndexedDB: son una contraseña, y CU003 lo prohíbe expresamente.
import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import { establecerPasswordPrimerIngreso } from '../../api/resources/auth'
import { mensajeDeError, motivoDe } from '../../api/client'
import { REQUISITOS_PASSWORD, requisitosIncumplidos } from '../../lib/validacion'

export const TEXTO = {
  expirada: "Tu contraseña temporal ha expirado. Usa '¿Olvidaste tu contraseña?' para generar una nueva.",
  noCoinciden: 'Las contraseñas no coinciden.',
  igualAnterior: 'La nueva contraseña debe ser diferente de la contraseña anterior.',
}

export default function ModalPrimerIngreso({ abierto, correo, temporal, onListo, onCerrar }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const faltan = requisitosIncumplidos(password)
  const coinciden = password === confirmacion
  const puedeGuardar = faltan.length === 0 && coinciden

  const cerrar = () => {
    setPassword('')
    setConfirmacion('')
    setOcupado(false)
    onCerrar()
  }

  const guardar = async () => {
    setOcupado(true)
    try {
      const sesion = await establecerPasswordPrimerIngreso({
        correo,
        temporal,
        passwordNueva: password,
        confirmacion,
      })
      toast.success('Contraseña establecida', 'Ya puede trabajar con normalidad.')
      // Trae token: el usuario entra directamente, sin pasar otra vez por el
      // formulario de login.
      onListo(sesion)
      cerrar()
    } catch (error) {
      const motivo = motivoDe(error)
      if (motivo === 'contrasena_temporal_expirada') {
        toast.error('Contraseña temporal expirada', TEXTO.expirada)
        cerrar()
        return
      }
      toast.error(
        'No se pudo establecer la contraseña',
        motivo === 'password_igual' ? TEXTO.igualAnterior : mensajeDeError(error),
      )
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal
      open={abierto}
      onClose={cerrar}
      size="max-w-lg"
      title="Establecer nueva contraseña"
      subtitle="Es su primer ingreso: la contraseña temporal no sirve para trabajar"
      footer={
        <>
          <Button variant="ghost" onClick={cerrar}>
            Cancelar
          </Button>
          <Button loading={ocupado} disabled={!puedeGuardar} iconLeft={KeyRound} onClick={guardar}>
            Establecer y entrar
          </Button>
        </>
      }
    >
      <p className="rounded-xl border border-info-600/20 bg-info-100 p-4 text-sm text-ink-700">
        {`La contraseña que recibió por correo es temporal y caduca a las 48 horas. Elija una definitiva para
        continuar: al guardarla entrará directamente, sin volver a iniciar sesión.`}
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <Input label="Correo institucional" value={correo ?? ''} disabled />
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
          error={confirmacion && !coinciden ? TEXTO.noCoinciden : undefined}
        />
      </div>
    </Modal>
  )
}
