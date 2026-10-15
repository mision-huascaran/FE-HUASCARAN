// El popup único de la plantilla de mantenimiento: S1 Nuevo, S2 Editar,
// S3 Visualizar y S5 Ver auditoría.
//
// Es el MISMO popup en los tres modos, como pide la plantilla: cambia el título
// y qué campos se bloquean, no el formulario. Así "Editar" y "Visualizar"
// muestran exactamente lo mismo y no hay dos sitios donde se desincronice.
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Skeleton from '../ui/Skeleton'
import Tabs from '../ui/Tabs'
import CampoMantenimiento from './CampoMantenimiento'
import PestanaAuditoria from './PestanaAuditoria'
import VistaDetalle from './VistaDetalle'

const TITULO = { nuevo: 'Nuevo', editar: 'Editar', ver: 'Visualizar' }

/** "Nuevo alumno", pero "Nueva cuenta": el título concuerda con la entidad. */
const tituloDe = (modo, entidad, genero) =>
  `${modo === 'nuevo' && genero === 'f' ? 'Nueva' : TITULO[modo]} ${entidad}`

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
  // Opcional: cómo pedir el registro COMPLETO. La fila de la tabla puede venir
  // recortada (un `ColegioItem` no trae grados ni programas), y abrir "Editar"
  // con ella daría un formulario incompleto que al guardar borraría lo que no
  // se mostró.
  cargarDetalle = null,
  guardando = false,
  genero = 'm',
  puedeVerAuditoria = false,
  cargarAuditoria,
  onGuardar,
  onCerrar,
}) {
  /**
   * Los valores con los que ARRANCA el formulario.
   *
   * `camposRef` existe por un fallo molesto: el formulario se vaciaba solo
   * mientras se escribía. `campos` llega como un array nuevo en cada render de
   * la pantalla (en Usuarios cambia además cuando vuelven los catálogos de
   * colegios y grados, y en Alumnos al terminar la precarga de una actividad),
   * así que el efecto que repoblaba el formulario se disparaba a mitad del
   * trabajo y borraba lo escrito.
   *
   * Se lee por referencia para calcular el estado inicial SIN depender de la
   * identidad del array: el formulario se rellena al ABRIR y nunca más.
   */
  const camposRef = useRef(campos)
  camposRef.current = campos

  const idRegistro = registro?.id ?? registro?.[`id_${seccion}`] ?? null
  const detalle = useQuery({
    queryKey: ['detalle', seccion, idRegistro],
    queryFn: () => cargarDetalle(idRegistro),
    enabled: Boolean(abierto && cargarDetalle && idRegistro),
  })

  const [valores, setValores] = useState({})
  const [errores, setErrores] = useState({})
  const [pestana, setPestana] = useState('datos')

  // Solo al abrir, cuando cambia el registro, y una vez más si llega el
  // detalle: lo que trae el servidor completa (y pisa) lo de la fila.
  useEffect(() => {
    if (!abierto) return
    const completo = { ...registro, ...(detalle.data ?? {}) }
    const base = {}
    for (const campo of camposRef.current) {
      base[campo.nombre] = completo[campo.nombre] ?? campo.porDefecto ?? (campo.tipo === 'multiple' ? [] : '')
    }
    setValores(base)
    setErrores({})
    setPestana('datos')
  }, [abierto, registro, detalle.data])

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
      title={tituloDe(modo, entidad, genero)}
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
      ) : null}

      {pestana !== 'auditoria' && detalle.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full" />
      ) : null}

      {pestana !== 'auditoria' &&
        !detalle.isLoading &&
        (modo === 'ver' ? (
          <div className={conAuditoria ? 'mt-4' : ''}>
            {/* S3 — Visualizar es una FICHA, no un formulario en gris. */}
            <VistaDetalle campos={camposVisibles} valores={valores} />
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
        ))}
    </Modal>
  )
}
