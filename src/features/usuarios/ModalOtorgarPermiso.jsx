// CU028 — Otorgar un permiso excepcional de corrección.
//
// Lo que más condiciona este formulario es de dónde salen los PERIODOS: no son
// los cuatro PA del año, son los que `GET /permisos/opciones` devuelve, que son
// aquellos cuyo plazo ordinario ya terminó. Un periodo que todavía se puede
// regularizar por la vía normal el servidor lo rechaza con "este periodo
// todavía admite regularización ordinaria", así que ofrecerlo sería invitar a
// un error que va a llegar igual.
//
// Y "Desde ahora" no es un atajo cosmético: si el Supervisor escribe la hora de
// inicio a mano y tarda un minuto en guardar, el servidor la rechaza por estar
// en el pasado. Con `desde_ahora` la pone él y el problema desaparece.
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Switch from '../../components/ui/Switch'
import Textarea from '../../components/ui/Textarea'
import { useToast } from '../../components/ui/Toast'
import { MODULOS_PERMISO, opcionesDePermiso, otorgarPermiso } from '../../api/resources/permisos'
import { mensajeDeError } from '../../api/client'

const VACIO = {
  id_colegio: '',
  id_grado: '',
  id_periodo_academico: '',
  modulo: '',
  desde_ahora: true,
  inicio: '',
  fin: '',
  motivo: '',
}

export default function ModalOtorgarPermiso({ abierto, idUsuario, colegios = [], onCerrar, onOtorgado }) {
  const toast = useToast()
  const [datos, setDatos] = useState(VACIO)

  useEffect(() => {
    if (abierto) setDatos(VACIO)
  }, [abierto])

  /**
   * Los periodos y grados que ese colegio admite.
   *
   * Depende del colegio porque cada uno tiene su calendario: un PA puede estar
   * cerrado en un colegio y seguir abierto en otro.
   */
  const { data: opciones } = useQuery({
    queryKey: ['permisos', 'opciones', datos.id_colegio],
    queryFn: () => opcionesDePermiso({ idColegio: datos.id_colegio }),
    enabled: Boolean(abierto && datos.id_colegio),
  })

  const otorgar = useMutation({
    mutationFn: () => otorgarPermiso(idUsuario, { ...datos, id_anio_escolar: datos.id_anio_escolar ?? 1 }),
    onSuccess: onOtorgado,
    onError: (error) => toast.error('No se pudo otorgar el permiso', mensajeDeError(error)),
  })

  const cambiar = (campo, valor) =>
    setDatos((d) => {
      const siguiente = { ...d, [campo]: valor }
      // Cambiar de colegio invalida periodo y grado: son suyos.
      if (campo === 'id_colegio') {
        siguiente.id_periodo_academico = ''
        siguiente.id_grado = ''
      }
      return siguiente
    })

  const periodos = opciones?.periodos ?? []
  const grados = opciones?.grados ?? []

  const completo =
    datos.id_colegio &&
    datos.id_grado &&
    datos.id_periodo_academico &&
    datos.modulo &&
    datos.fin &&
    datos.motivo.trim() &&
    (datos.desde_ahora || datos.inicio)

  return (
    <Modal
      open={abierto}
      onClose={onCerrar}
      title="Otorgar permiso de corrección"
      subtitle="Un permiso autoriza un solo módulo: para otro, otorga uno aparte."
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button loading={otorgar.isPending} disabled={!completo} onClick={() => otorgar.mutate()}>
            Otorgar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Colegio"
          required
          placeholder="Seleccione"
          value={datos.id_colegio}
          options={colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre }))}
          onChange={(e) => cambiar('id_colegio', e.target.value)}
        />
        <Select
          label="Grado"
          required
          placeholder={datos.id_colegio ? 'Seleccione' : 'Elija antes un colegio'}
          value={datos.id_grado}
          options={grados.map((g) => ({ value: String(g.id), label: g.nombre }))}
          onChange={(e) => cambiar('id_grado', e.target.value)}
        />
        <Select
          label="Periodo académico"
          required
          placeholder={datos.id_colegio ? 'Seleccione' : 'Elija antes un colegio'}
          value={datos.id_periodo_academico}
          options={periodos.map((p) => ({ value: String(p.id), label: p.nombre }))}
          hint="Solo los periodos cuyo plazo ordinario ya terminó"
          onChange={(e) => cambiar('id_periodo_academico', e.target.value)}
        />
        <Select
          label="Módulo autorizado"
          required
          placeholder="Seleccione"
          value={datos.modulo}
          options={MODULOS_PERMISO}
          onChange={(e) => cambiar('modulo', e.target.value)}
        />

        <div className="flex flex-col gap-1 md:col-span-2">
          <div className="flex items-center gap-2">
            <Switch
              label="Empezar ahora mismo"
              checked={datos.desde_ahora}
              onChange={(valor) => cambiar('desde_ahora', valor)}
            />
            <span className="text-sm text-ink-900">Empezar ahora mismo</span>
          </div>
          <p className="text-xs text-ink-500">
            Evita que el servidor rechace una hora de inicio que quedó en el pasado mientras se llenaba el
            formulario.
          </p>
        </div>

        {!datos.desde_ahora && (
          <Input
            label="Inicio de vigencia"
            type="datetime-local"
            required
            value={datos.inicio}
            onChange={(e) => cambiar('inicio', e.target.value)}
          />
        )}
        <Input
          label="Fin de vigencia"
          type="datetime-local"
          required
          value={datos.fin}
          min={datos.inicio || undefined}
          onChange={(e) => cambiar('fin', e.target.value)}
        />

        <div className="md:col-span-2">
          <Textarea
            label="Motivo de la autorización"
            rows={3}
            required
            maxLength={300}
            value={datos.motivo}
            hint="Queda registrado junto a quién lo otorgó. Por ejemplo: faltó registrar la lectura de marzo."
            onChange={(e) => cambiar('motivo', e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
