// El popup único de la plantilla de mantenimiento: S1 Nuevo, S2 Editar,
// S3 Visualizar y S5 Ver auditoría.
//
// Es el MISMO popup en los tres modos, como pide la plantilla: cambia el título
// y qué campos se bloquean, no el formulario. Así "Editar" y "Visualizar"
// muestran exactamente lo mismo y no hay dos sitios donde se desincronice.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Skeleton from '../ui/Skeleton'
import Tabs from '../ui/Tabs'
import CampoMantenimiento from './CampoMantenimiento'
import PestanaAuditoria from './PestanaAuditoria'
import { MOSTRAR_AUDITORIA } from '../../config/funcionalidades'
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
/**
 * Qué campos se ven.
 *
 * `visible(valores)` depende de lo escrito —los grados solo si el rol es
 * Docente—; `soloEn` depende del MODO. La fecha de pertenencia del alumno, por
 * ejemplo, se pide al crear y no al editar: para moverlo de grupo hay otro
 * campo, con otra regla.
 */
/** Lo que es función se resuelve con lo escrito; lo demás pasa tal cual. */
const resolver = (valor, valores, contexto) =>
  typeof valor === 'function' ? valor(valores, contexto) : valor

const visiblesEn = (campos, valores, modo, registro, detalleListo = true) => {
  /**
   * `detalleListo` dice si el registro del contexto es ya el COMPLETO.
   *
   * Hace falta para los campos que aparecen por lo que el registro NO tiene:
   * "Pertenece al grupo desde" se pide cuando el alumno no tiene pertenencia,
   * y la fila de la tabla no trae ese dato, solo el detalle. Sin esperarlo, el
   * campo se asomaba un instante en cada edición y desaparecía después.
   */
  const contexto = { modo, registro, detalleListo }
  return (
    campos
      /**
       * `visible` recibe TAMBIÉN el registro original.
       *
       * Sin él no se puede preguntar "¿ha cambiado esto?", que es justo lo que
       * decide si hay que pedir la fecha de cambio de grupo: mover a un alumno
       * de aula la exige, corregirle una tilde al apellido no.
       */
      .filter(
        (c) =>
          (!c.visible || c.visible(valores, contexto)) && (!c.soloEn || c.soloEn === modo),
      )
      /**
       * `opciones`, `min` y `max` pueden ser FUNCIONES de lo escrito hasta ahora.
       *
       * Hacen falta para lo que depende de otro campo: las secciones son las
       * del colegio y grado elegidos, y el tope de una fecha puede depender de
       * cuándo empezó el grupo actual. Se resuelve aquí, que es donde viven
       * los valores.
       */
      .map((c) => ({
        ...c,
        opciones: resolver(c.opciones, valores, contexto),
        min: resolver(c.min, valores, contexto),
        max: resolver(c.max, valores, contexto),
        // La ayuda también: "este colegio está en receso (PR3) hasta el 08/11"
        // depende del colegio que se acabe de elegir.
        ayuda: resolver(c.ayuda, valores, contexto),
      }))
  )
}

/**
 * Lo escrito en un campo que luego se ocultó no se envía.
 *
 * Si alguien elige Docente, marca unos grados y después cambia el rol a
 * Supervisor, esos grados siguen en el estado aunque ya no se vean: hay que
 * devolverlos a vacío o se mandarían al servidor.
 */
/**
 * "Oculto" es lo que `visiblesEn` deja fuera, con el MISMO criterio: `visible`
 * con el contexto `{ modo, registro }` y también `soloEn`. Llamar aquí a
 * `visible(valores)` a secas reventaba el alta de alumnos —el campo de cambio
 * de grupo lee `registro` del segundo argumento— antes de llegar a `onGuardar`.
 */
function sinLosOcultos(campos, visibles, valores) {
  const seVen = new Set(visibles.map((c) => c.nombre))
  const limpio = { ...valores }
  for (const campo of campos) {
    if (!seVen.has(campo.nombre)) {
      limpio[campo.nombre] = campo.tipo === 'multiple' ? [] : ''
    }
  }
  return limpio
}

/**
 * Los desplegables con `unicaPorDefecto` que tienen UNA sola opción y no la
 * llevan puesta: la sección de un grado que solo tiene "Única", por ejemplo.
 * Un valor que sigue siendo una opción válida no se toca.
 */
function unicasSinElegir(campos, valores, editable) {
  const pendientes = {}
  if (!editable) return pendientes
  for (const campo of campos) {
    if (campo.tipo !== 'select' || !campo.unicaPorDefecto || campo.opciones?.length !== 1) continue
    const unica = String(campo.opciones[0].value)
    if (String(valores[campo.nombre] ?? '') !== unica) pendientes[campo.nombre] = unica
  }
  return pendientes
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
  /**
   * Lo que el SERVIDOR rechazó, por campo (`errores[{campo, mensaje}]`).
   *
   * Pesa más que la validación local: el backend sabe cosas que el formulario
   * no puede saber, como que ese nombre de colegio ya existe.
   */
  erroresServidor = {},
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

  /**
   * El id del registro, probando los nombres con que puede venir.
   *
   * `entidad` ES SINGULAR y `seccion` PLURAL: la fila del alumno trae
   * `id_alumno`, no `id_alumnos`. Mirar solo la sección dejaba el id en `null`
   * en Alumnos, así que el popup NUNCA pedía el detalle —y con él
   * `pertenece_desde`— y la pestaña de auditoría salía siempre vacía, sin dar
   * ninguna señal de que faltaba el dato.
   */
  const idRegistro = registro?.id ?? registro?.[`id_${entidad}`] ?? registro?.[`id_${seccion}`] ?? null
  const detalle = useQuery({
    queryKey: ['detalle', seccion, idRegistro],
    queryFn: () => cargarDetalle(idRegistro),
    enabled: Boolean(abierto && cargarDetalle && idRegistro),
  })

  const [valores, setValores] = useState({})
  const [errores, setErrores] = useState({})
  const [pestana, setPestana] = useState('datos')

  /**
   * La fila COMPLETADA con el detalle, que es lo que manda.
   *
   * Un `undefined` del detalle NO BORRA lo que trae la fila. Con un spread a
   * secas, un detalle que omite una clave la dejaba vacía: en Alumnos el
   * detalle no trae `id_seccion` y la sección se perdía, con lo que el
   * formulario creía que el alumno cambiaba de grupo y pedía la fecha del
   * cambio en cada edición, aunque no se hubiera tocado nada.
   */
  const completo = useMemo(() => {
    const base = { ...registro }
    for (const [clave, valor] of Object.entries(detalle.data ?? {})) {
      if (valor !== undefined) base[clave] = valor
    }
    return base
  }, [registro, detalle.data])

  /**
   * ¿Es `completo` ya el registro de verdad?
   *
   * Sin detalle que pedir, lo es desde el primer render. Con detalle, no: hasta
   * que llega, lo que hay es la fila recortada de la tabla.
   */
  const detalleListo = !cargarDetalle || !idRegistro || detalle.isSuccess

  // Solo al abrir, cuando cambia el registro, y una vez más si llega el
  // detalle: lo que trae el servidor completa (y pisa) lo de la fila.
  useEffect(() => {
    if (!abierto) return
    const base = {}
    for (const campo of camposRef.current) {
      /**
       * `porDefecto` puede ser una FUNCIÓN del registro completo.
       *
       * Lo pide CU014 con "Pertenece al grupo desde": cuando el alumno no
       * tiene pertenencia, el valor propuesto es su fecha de creación, que
       * solo se sabe mirando el registro.
       */
      const propuesto = typeof campo.porDefecto === 'function' ? campo.porDefecto(completo) : campo.porDefecto
      base[campo.nombre] = completo[campo.nombre] ?? propuesto ?? (campo.tipo === 'multiple' ? [] : '')
    }
    setValores(base)
    setErrores({})
    setPestana('datos')
  }, [abierto, completo])

  const cambiar = (nombre, valor) => {
    setValores((v) => ({ ...v, [nombre]: valor }))
    setErrores((e) => (e[nombre] ? { ...e, [nombre]: undefined } : e))
  }

  // Lo que se ve y, por tanto, lo que se valida: exigir un campo escondido
  // dejaría el popup sin guardar y sin decir por qué.
  const camposVisibles = visiblesEn(campos, valores, modo, completo, detalleListo)

  // Con una sola opción no hay nada que decidir: se deja puesta. Va por clave
  // de texto porque `camposVisibles` es un array nuevo en cada render.
  const unicas = JSON.stringify(unicasSinElegir(camposVisibles, valores, abierto && modo !== 'ver'))
  useEffect(() => {
    const pendientes = JSON.parse(unicas)
    if (Object.keys(pendientes).length) setValores((v) => ({ ...v, ...pendientes }))
  }, [unicas])

  const enviar = () => {
    const problemas = validar(camposVisibles, valores, modo)
    setErrores(problemas)
    if (Object.keys(problemas).some((k) => problemas[k])) return
    onGuardar(sinLosOcultos(campos, camposVisibles, valores))
  }

  // La auditoría solo tiene sentido sobre un registro que ya existe. Con el
  // interruptor apagado no hay pestañas ni margen: solo los datos.
  const conAuditoria = MOSTRAR_AUDITORIA && puedeVerAuditoria && modo !== 'nuevo' && Boolean(registro)

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
          <PestanaAuditoria entidad={entidad} registro={registro} cargarAuditoria={cargarAuditoria} />
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
        <div className={conAuditoria ? 'mt-4' : ''}>
        {/* El asterisco no se explica solo. Sale únicamente si hay algún campo
            que lo lleve, para no prometer obligatorios donde no los hay. */}
        {camposVisibles.some((campo) => campo.requerido) && (
          <p className="mb-4 text-xs text-ink-500">
            Los campos marcados con <span className="font-semibold text-danger-600">*</span> son obligatorios.
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {camposVisibles.map((campo) => (
            <CampoMantenimiento
              key={campo.nombre}
              campo={campo}
              modo={modo}
              valor={valores[campo.nombre]}
              error={errores[campo.nombre] ?? erroresServidor[campo.nombre]}
              onCambio={cambiar}
            />
          ))}
        </div>
        </div>
        ))}
    </Modal>
  )
}
