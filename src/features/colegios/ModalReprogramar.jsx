// Trasladar una clase a otra fecha (CU013).
//
// NO SE CREA OTRA CLASE: la misma conserva su identificador y cambia su fecha
// vigente. La original queda en el historial, y la obligación de asistencia
// que evalúa CU011 pasa a la fecha nueva sin dejar otra pendiente en la vieja.
//
// SE APLICA A TODA LA CLASE. Si reúne alumnos de los dos subprogramas, los dos
// se trasladan: el filtro con el que se encontró la fila no limita el alcance
// del cambio, y conviene decirlo porque es justo lo que un Supervisor podría
// suponer al revés.
//
// Y NO ES UNA OPERACIÓN OFFLINE. Requiere conexión y no se encola. Si la
// solicitud se queda sin respuesta, se bloquea el reenvío: reenviarla podría
// trasladar la clase dos veces.
import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { CAMPO_DE_MOTIVO, MOTIVO_REPROGRAMACION, reprogramarClase } from '../../api/resources/clases'
import { erroresDeCampo, mensajeDeError, motivoDe } from '../../api/client'

const comoFecha = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')

/** Un dato de solo lectura del encabezado del modal. */
function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-900">{children ?? '—'}</dd>
    </div>
  )
}

export default function ModalReprogramar({ clase, colegio, onCerrar, onHecho }) {
  const toast = useToast()
  const [fechaNueva, setFechaNueva] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState({})
  /** Se envió y no se supo el resultado: no se puede reintentar a ciegas. */
  const [sinConfirmar, setSinConfirmar] = useState(false)

  useEffect(() => {
    if (!clase) return
    setFechaNueva('')
    setMotivo('')
    setErrores({})
    setSinConfirmar(false)
  }, [clase])

  const subprogramas = (clase?.subprogramas ?? []).map((sp) => sp.nombre)
  const mixta = subprogramas.length > 1

  const guardar = useMutation({
    mutationFn: () =>
      reprogramarClase(colegio.id_colegio, {
        idGrado: clase.id_grado,
        idSeccion: clase.id_seccion,
        fechaOriginal: clase.fecha_original,
        fechaNueva,
        motivo: motivo.trim(),
        version: clase.version,
      }),
    onSuccess: (respuesta) => {
      toast.success('Clase reprogramada correctamente.')
      // Si el traslado cae en otro mes, la fila desaparece de los filtros
      // actuales. Decirlo evita que parezca que se perdió.
      const nueva = respuesta?.fecha ?? fechaNueva
      if (nueva.slice(0, 7) !== clase.fecha.slice(0, 7)) {
        toast.info(`La clase fue trasladada al ${comoFecha(nueva)} y puede quedar fuera de los filtros actuales.`)
      }
      onHecho()
    },
    onError: (error) => {
      /**
       * Sin respuesta del servidor NO se vuelve a intentar.
       *
       * La solicitud pudo llegar y aplicarse: reenviarla trasladaría la clase
       * otra vez. CU013 lo prohíbe expresamente hasta verificar el resultado.
       */
      if (!error?.response) {
        setSinConfirmar(true)
        return
      }

      // Cada mensaje junto a su campo. El backend los manda en `errores`, y
      // si no, se deducen del `motivo`.
      const porCampo = erroresDeCampo(error)
      const motivoError = motivoDe(error)
      const campo = CAMPO_DE_MOTIVO[motivoError]
      setErrores(
        Object.keys(porCampo).length
          ? porCampo
          : campo
            ? { [campo]: MOTIVO_REPROGRAMACION[motivoError] }
            : {},
      )

      // Lo que no tiene campo —asistencias ya registradas, otro Supervisor la
      // movió— va arriba, porque no se arregla corrigiendo un control.
      if (!campo && !Object.keys(porCampo).length) {
        toast.error('No se pudo reprogramar la clase', mensajeDeError(error))
      }
    },
  })

  const completo = Boolean(fechaNueva && motivo.trim())

  return (
    <Modal
      open={Boolean(clase)}
      onClose={onCerrar}
      title="Reprogramar clase"
      size="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button
            loading={guardar.isPending}
            disabled={!completo || sinConfirmar}
            onClick={() => guardar.mutate()}
          >
            Guardar reprogramación
          </Button>
        </>
      }
    >
      {sinConfirmar && (
        <p role="alert" className="mb-4 rounded-lg bg-warning-100 px-3 py-2 text-sm text-warning-600">
          No se pudo confirmar el guardado. Vuelve a consultar la programación para comprobar si la clase se trasladó
          antes de intentarlo otra vez.
        </p>
      )}

      <dl className="mb-5 grid grid-cols-2 gap-4 rounded-lg bg-surface-100 px-4 py-3 md:grid-cols-3">
        <Dato etiqueta="Colegio">{colegio?.nombre}</Dato>
        <Dato etiqueta="Grado">{clase?.grado?.nombre ?? clase?.id_grado}</Dato>
        <Dato etiqueta="Sección">{clase?.seccion?.nombre}</Dato>
        <Dato etiqueta="Subprogramas">{subprogramas.join(', ') || '—'}</Dato>
        <Dato etiqueta="Fecha original">{comoFecha(clase?.fecha_original)}</Dato>
        <Dato etiqueta="Fecha vigente">{comoFecha(clase?.fecha)}</Dato>
      </dl>

      {mixta && (
        <p className="mb-4 text-sm text-ink-700">
          La reprogramación se aplica a toda la clase, incluidos los alumnos de ambos subprogramas.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Input
          label="Nueva fecha"
          type="date"
          required
          value={fechaNueva}
          error={errores.fecha_nueva}
          onChange={(e) => {
            setErrores((x) => ({ ...x, fecha_nueva: undefined }))
            setFechaNueva(e.target.value)
          }}
        />
        <Textarea
          label="Motivo"
          rows={3}
          required
          maxLength={300}
          value={motivo}
          error={errores.motivo}
          onChange={(e) => {
            setErrores((x) => ({ ...x, motivo: undefined }))
            setMotivo(e.target.value)
          }}
        />
        <p className="text-sm text-ink-500">
          Este cambio afecta únicamente a esta clase. El horario habitual del grado se mantiene.
        </p>
      </div>
    </Modal>
  )
}
