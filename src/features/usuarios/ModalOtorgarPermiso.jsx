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
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { erroresDeCampo, mensajeDeError } from '../../api/client'

const VACIO = {
  id_anio_escolar: '',
  id_colegio: '',
  id_grado: '',
  id_periodo_academico: '',
  modulo: '',
  desde_ahora: true,
  inicio: '',
  fin: '',
  motivo: '',
}

export default function ModalOtorgarPermiso({
  abierto,
  idUsuario,
  colegios = [],
  idAnioEscolar = '',
  onCerrar,
  onOtorgado,
}) {
  const toast = useToast()
  const [datos, setDatos] = useState(VACIO)

  /**
   * Los años escolares, para elegir a cuál pertenece el periodo.
   *
   * NO es un campo de texto ni un DatePicker: un año escolar es una entidad
   * con id —el backend la pide así— y no siempre coincide con el año
   * calendario, porque el receso posterior a PA4 puede cruzar diciembre. Un
   * selector de los que existen es lo único que no se puede teclear mal.
   */
  const { data: anios = [] } = useQuery({
    queryKey: ['catalogo', 'anios-escolares'],
    queryFn: listarAniosEscolares,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (!abierto) return
    /**
     * Se precarga el año que se está CONSULTANDO, si sigue disponible: casi
     * siempre se otorga para lo que se acaba de mirar. Si no hay consulta o
     * ese año ya no está, se propone el vigente, y si tampoco, se deja vacío
     * para que el Supervisor elija —nunca se adivina un año—.
     */
    const disponible = anios.some((a) => String(a.id) === String(idAnioEscolar))
    const propuesto = disponible ? String(idAnioEscolar) : String(anioVigente(anios)?.id ?? '')
    setDatos({ ...VACIO, id_anio_escolar: propuesto })
  }, [abierto, anios, idAnioEscolar])

  /**
   * Los periodos y grados que ese colegio admite.
   *
   * Depende del colegio porque cada uno tiene su calendario: un PA puede estar
   * cerrado en un colegio y seguir abierto en otro.
   */
  const { data: opciones } = useQuery({
    queryKey: ['permisos', 'opciones', datos.id_colegio, datos.id_anio_escolar],
    queryFn: () => opcionesDePermiso({ idColegio: datos.id_colegio, idAnioEscolar: datos.id_anio_escolar }),
    enabled: Boolean(abierto && datos.id_colegio),
  })

  /**
   * Lo que el servidor rechaza POR CAMPO, para pintarlo debajo de su control.
   *
   * CU028 lo pide así campo a campo: "Selecciona una fecha y hora futura o
   * utiliza la opción 'Desde ahora'." va bajo Inicio de vigencia, y "El fin de
   * vigencia debe ser posterior al inicio." bajo Fin. En un toast suelto el
   * Supervisor tiene que adivinar cuál de los ocho campos corregir.
   */
  const [erroresCampo, setErroresCampo] = useState({})

  const otorgar = useMutation({
    mutationFn: () => {
      setErroresCampo({})
      return otorgarPermiso(idUsuario, datos)
    },
    onSuccess: onOtorgado,
    onError: (error) => {
      const porCampo = erroresDeCampo(error)
      setErroresCampo(porCampo)
      // El toast solo para lo que no tiene campo: un 409 de superposición, un
      // fallo de red. Si el error ya se señaló en su control, repetirlo arriba
      // es ruido.
      if (!Object.keys(porCampo).length) toast.error('No se pudo otorgar el permiso', mensajeDeError(error))
    },
  })

  const cambiar = (campo, valor) => {
    setErroresCampo((e) => (e[campo] ? { ...e, [campo]: undefined } : e))
    setDatos((d) => {
      const siguiente = { ...d, [campo]: valor }
      // Cambiar de colegio invalida periodo y grado: son suyos. Y cambiar de
      // año invalida el periodo, que pertenece a un año concreto.
      if (campo === 'id_colegio') {
        siguiente.id_periodo_academico = ''
        siguiente.id_grado = ''
      }
      if (campo === 'id_anio_escolar') siguiente.id_periodo_academico = ''
      return siguiente
    })
  }

  const periodos = opciones?.periodos ?? []
  const grados = opciones?.grados ?? []

  const completo =
    datos.id_anio_escolar &&
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
          label="Año escolar"
          required
          value={datos.id_anio_escolar}
          options={anios.map((a) => ({ value: String(a.id), label: a.nombre }))}
          placeholder="Seleccione"
          hint="El de la consulta, o el año en curso"
          onChange={(e) => cambiar('id_anio_escolar', e.target.value)}
        />
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
          error={erroresCampo.id_periodo_academico}
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
            error={erroresCampo.inicio}
            onChange={(e) => cambiar('inicio', e.target.value)}
          />
        )}
        <Input
          label="Fin de vigencia"
          type="datetime-local"
          required
          value={datos.fin}
          min={datos.inicio || undefined}
          error={erroresCampo.fin}
          onChange={(e) => cambiar('fin', e.target.value)}
        />

        <div className="md:col-span-2">
          <Textarea
            label="Motivo de la autorización"
            rows={3}
            required
            maxLength={300}
            value={datos.motivo}
            error={erroresCampo.motivo}
            hint="Queda registrado junto a quién lo otorgó. Por ejemplo: faltó registrar la lectura de marzo."
            onChange={(e) => cambiar('motivo', e.target.value)}
          />
        </div>
      </div>
    </Modal>
  )
}
