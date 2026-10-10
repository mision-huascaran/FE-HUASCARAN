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

/**
 * Los campos que tocan AHORA MISMO, según lo que lleva escrito el formulario.
 *
 * Un campo con `visible(valores)` aparece y desaparece mientras se rellena:
 * "Año escolar", "Colegio asignado" y "Grados" solo tienen sentido para un
 * Docente, y pedírselos a un Supervisor confundía (se mostraban con la ayuda
 * "Solo para Docente" y aun así se podían rellenar).
 */
const visiblesEn = (campos, valores) => campos.filter((c) => !c.visible || c.visible(valores))

/**
 * Lo escrito en un campo que luego se ocultó no se envía.
 *
 * Si alguien elige Docente, marca unos grados y después cambia el rol a
 * Supervisor, esos grados siguen en el estado aunque ya no se vean: hay que
 * devolverlos a vacío o se mandarían al servidor.
 */
function sinLosOcultos(campos, valores) {
  const limpio = { ...valores }
  for (const campo of campos) {
    if (campo.visible && !campo.visible(valores)) {
      limpio[campo.nombre] = campo.tipo === 'multiple' ? [] : ''
    }
  }
  return limpio
}

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

  // Lo que se ve y, por tanto, lo que se valida: exigir un campo escondido
  // dejaría el popup sin guardar y sin decir por qué.
  const camposVisibles = visiblesEn(campos, valores)

  const enviar = () => {
    const problemas = validar(camposVisibles, valores, modo)
    setErrores(problemas)
    if (Object.keys(problemas).some((k) => problemas[k])) return
    onGuardar(sinLosOcultos(campos, valores))
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
          {camposVisibles.map((campo) => (
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
