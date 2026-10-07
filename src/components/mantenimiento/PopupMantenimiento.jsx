// El popup único de la plantilla de mantenimiento: S1 Nuevo, S2 Editar,
// S3 Visualizar y S5 Ver auditoría.
//
// Es el MISMO popup en los tres modos, como pide la plantilla: cambia el título
// y qué campos se bloquean, no el formulario. Así "Editar" y "Visualizar"
// muestran exactamente lo mismo y no hay dos sitios donde se desincronice.
import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Tabs from '../ui/Tabs'
import CampoMantenimiento from './CampoMantenimiento'
import PestanaAuditoria from './PestanaAuditoria'

const TITULO = { nuevo: 'Nuevo', editar: 'Editar', ver: 'Visualizar' }

/** E1: obligatorios y formato, antes de molestar al servidor. */
function validar(campos, valores, modo) {
  if (modo === 'ver') return {}
  const errores = {}
  for (const campo of campos) {
    if (campo.soloLectura) continue
    const valor = valores[campo.nombre]
    const vacio = valor === '' || valor === null || valor === undefined || (Array.isArray(valor) && !valor.length)
    if (campo.requerido && vacio) {
      errores[campo.nombre] = 'Este campo es obligatorio'
      continue
    }
    if (!vacio && campo.validar) {
      const problema = campo.validar(valor, valores)
      if (problema) errores[campo.nombre] = problema
    }
  }
  return errores
}

export default function PopupMantenimiento({
  abierto,
  modo = 'nuevo',
  entidad,
  seccion,
  campos = [],
  registro = null,
  guardando = false,
  puedeVerAuditoria = false,
  cargarAuditoria,
  onGuardar,
  onCerrar,
}) {
  const inicial = useMemo(() => {
    const base = {}
    for (const campo of campos) {
      base[campo.nombre] = registro?.[campo.nombre] ?? campo.porDefecto ?? (campo.tipo === 'multiple' ? [] : '')
    }
    return base
  }, [campos, registro])

  const [valores, setValores] = useState(inicial)
  const [errores, setErrores] = useState({})
  const [pestana, setPestana] = useState('datos')

  // Al abrir con otro registro hay que repoblar: el popup se reutiliza.
  useEffect(() => {
    if (abierto) {
      setValores(inicial)
      setErrores({})
      setPestana('datos')
    }
  }, [abierto, inicial])

  const cambiar = (nombre, valor) => {
    setValores((v) => ({ ...v, [nombre]: valor }))
    setErrores((e) => (e[nombre] ? { ...e, [nombre]: undefined } : e))
  }

  const enviar = () => {
    const problemas = validar(campos, valores, modo)
    setErrores(problemas)
    if (Object.keys(problemas).some((k) => problemas[k])) return
    onGuardar(valores)
  }

  // La auditoría solo tiene sentido sobre un registro que ya existe.
  const conAuditoria = puedeVerAuditoria && modo !== 'nuevo' && Boolean(registro)

  return (
    <Modal
      open={abierto}
      onClose={onCerrar}
      title={`${TITULO[modo]} ${entidad}`}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            {modo === 'ver' ? 'Cerrar' : 'Cancelar'}
          </Button>
          {modo !== 'ver' && (
            <Button loading={guardando} onClick={enviar}>
              Guardar
            </Button>
          )}
        </>
      }
    >
      {conAuditoria && (
        <Tabs
          value={pestana}
          onChange={setPestana}
          items={[
            { value: 'datos', label: 'Datos' },
            { value: 'auditoria', label: 'Auditoría' },
          ]}
        />
      )}

      {pestana === 'auditoria' && conAuditoria ? (
        <div className="mt-4">
          <PestanaAuditoria seccion={seccion} registro={registro} cargarAuditoria={cargarAuditoria} />
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${conAuditoria ? 'mt-4' : ''}`}>
          {campos.map((campo) => (
            <CampoMantenimiento
              key={campo.nombre}
              campo={campo}
              modo={modo}
              valor={valores[campo.nombre]}
              error={errores[campo.nombre]}
              onCambio={cambiar}
            />
          ))}
        </div>
      )}
    </Modal>
  )
}
