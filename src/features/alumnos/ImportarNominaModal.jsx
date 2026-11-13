// Importar nómina de alumnos desde Excel (CU014, semana 14) — exclusivo del
// Supervisor, exclusivamente en línea.
//
// Dos pasos, un solo modal:
//
//   1. Elegir el archivo: se manda a "vista previa", que LEE el .xlsx sin
//      registrar ningún alumno. El backend arma los conteos y la lista de
//      filas con advertencia o rechazo.
//   2. Revisar y confirmar: con la `huella` de la vista previa, se manda el
//      MISMO archivo a confirmar. El backend vuelve a leerlo; si algo cambió
//      desde la vista previa (un colegio inactivado, un alumno creado por
//      otra persona), lo rechaza con 409 y hay que empezar de nuevo.
//
// El archivo viaja como CUERPO CRUDO, no `multipart/form-data` (ver
// `api/resources/administracion.js`). El nombre y los demás datos van en el
// query, no en un formulario.
import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { Badge, Button, DataTable, Modal } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { confirmarImportacion, consultarImportacion, vistaPreviaImportacion } from '../../api/resources/administracion'
import { estadoDe, mensajeDeError, motivoDe } from '../../api/client'
import useConexion from '../../hooks/useConexion'
import { nuevoUuid } from '../../lib/uuid'

const ACEPTA = '.xlsx'
const MAXIMO_MB = 5

/** Un id nuevo por archivo elegido; se reutiliza en los reintentos del MISMO envío. */
const idNuevo = nuevoUuid

const TONO_OBSERVACION = { rechazo: 'danger', advertencia: 'warning', hoja_omitida: 'neutral' }

/** El texto final de éxito, con o sin filas que no entraron (CU014). */
const textoDeExito = ({ importados, no_importadas: noImportadas }) =>
  noImportadas > 0
    ? `Importación completada. Alumnos importados: ${importados}. Filas no importadas: ${noImportadas}.`
    : `Importación completada. Alumnos importados: ${importados}.`

/** El aspecto de la zona de soltar: deshabilitada, con un archivo encima o en reposo. */
function claseDeZona(puedeElegir, arrastrando) {
  if (!puedeElegir) return 'cursor-not-allowed border-line bg-surface-100'
  if (arrastrando) return 'cursor-pointer border-brand-500 bg-brand-50'
  return 'cursor-pointer border-line hover:border-brand-400 hover:bg-surface-50'
}

export default function ImportarNominaModal({ open, onClose, onImportado }) {
  const toast = useToast()
  const enLinea = useConexion()
  const inputRef = useRef(null)

  // 'elegir' | 'cargando' | 'previa' | 'confirmando' | 'sinConfirmar'
  const [paso, setPaso] = useState('elegir')
  const [archivo, setArchivo] = useState(null)
  const [idImportacion, setIdImportacion] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [error, setError] = useState(null)
  // Resalta la zona mientras el archivo pasa por encima, arrastrándose.
  const [arrastrando, setArrastrando] = useState(false)

  const reiniciar = () => {
    setPaso('elegir')
    setArchivo(null)
    setIdImportacion(null)
    setPrevia(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const cerrar = () => {
    reiniciar()
    onClose()
  }

  const alTerminar = (resultado) => {
    toast.success(textoDeExito(resultado))
    reiniciar()
    // Éxito: "el sistema cierra el modal, actualiza la tabla..." (CU014).
    onClose()
    onImportado?.()
  }

  const elegirArchivo = async (lista) => {
    const elegido = lista?.[0]
    if (!elegido) return
    setError(null)
    setArchivo(elegido)
    setPaso('cargando')
    try {
      const datos = await vistaPreviaImportacion(elegido, elegido.name)
      setIdImportacion(idNuevo())
      setPrevia(datos)
      setPaso('previa')
    } catch (e) {
      setError(mensajeDeError(e, 'No se pudo leer el archivo.'))
      setArchivo(null)
      setPaso('elegir')
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const puedeElegir = enLinea && paso !== 'cargando'

  /** Arrastrar y soltar — mismo destino que el clic: a `elegirArchivo`. */
  const alEntrarArrastre = (e) => {
    e.preventDefault()
    if (puedeElegir) setArrastrando(true)
  }
  const alSalirArrastre = (e) => {
    e.preventDefault()
    setArrastrando(false)
  }
  const alSoltar = (e) => {
    e.preventDefault()
    setArrastrando(false)
    // `elegirArchivo` atrapa sus propios errores: no hay nada que esperar aquí.
    if (puedeElegir) void elegirArchivo(e.dataTransfer.files)
  }

  /**
   * `verSiSeAplico` resuelve la respuesta perdida de un "Confirmar" anterior.
   *
   * CU014: ante un envío sin respuesta no se genera otro id ni se reenvía a
   * ciegas —podría duplicar lo ya aplicado—. Se consulta el mismo id cuando
   * vuelve la conexión.
   */
  const verSiSeAplico = async () => {
    try {
      const resultado = await consultarImportacion(idImportacion)
      alTerminar(resultado)
    } catch (e) {
      if (estadoDe(e) === 404) {
        // No se aplicó: se puede reintentar con el mismo id y la misma huella.
        setError('No se pudo confirmar antes. Puedes intentarlo de nuevo.')
        setPaso('previa')
        return
      }
      // Sigue sin poder confirmarse (p. ej. sigue sin servidor): se queda igual.
    }
  }

  const confirmar = async () => {
    if (!enLinea) return
    setError(null)
    setPaso('confirmando')
    try {
      const resultado = await confirmarImportacion(archivo, {
        idImportacion,
        huella: previa.huella,
        nombreArchivo: archivo.name,
      })
      alTerminar(resultado)
    } catch (e) {
      const motivo = motivoDe(e)
      if (!e?.response) {
        // Sin respuesta: ni error de validación ni confirmación. Se espera a
        // que vuelva la conexión para preguntarle al servidor qué pasó.
        setError('No se pudo confirmar el resultado. Se verificará la importación al recuperar la comunicación con el servidor.')
        setPaso('sinConfirmar')
        return
      }
      if (motivo === 'importacion_desactualizada') {
        const mensaje = mensajeDeError(e)
        reiniciar()
        setError(mensaje)
        return
      }
      if (motivo === 'importacion_existente') {
        // Otro Supervisor usó este id: uno nuevo para el mismo archivo y huella.
        setIdImportacion(idNuevo())
        setError(mensajeDeError(e))
        setPaso('previa')
        return
      }
      setError(mensajeDeError(e))
      setPaso('previa')
    }
  }

  // Al recuperar la conexión mientras se esperaba la confirmación, se
  // pregunta sola: el Supervisor no tiene que acordarse de reintentar.
  useEffect(() => {
    if (paso === 'sinConfirmar' && enLinea) void verSiSeAplico()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, enLinea])

  const pie =
    paso === 'previa' || paso === 'confirmando' || paso === 'sinConfirmar' ? (
      <>
        <Button variant="ghost" onClick={cerrar} disabled={paso === 'confirmando'}>
          Cancelar
        </Button>
        <Button
          iconLeft={Upload}
          loading={paso === 'confirmando'}
          disabled={paso === 'sinConfirmar' || !enLinea || !previa || previa.listos === 0}
          onClick={confirmar}
        >
          Confirmar importación
        </Button>
      </>
    ) : (
      <Button variant="ghost" onClick={cerrar}>
        Cancelar
      </Button>
    )

  return (
    <Modal open={open} onClose={cerrar} title="Importar nómina" cierreExterior={false} footer={pie}>
      <div className="flex flex-col gap-4">
        {paso === 'elegir' || paso === 'cargando' ? (
          <>
            <p className="text-sm text-ink-500">
              Cada hoja del archivo corresponde a un colegio. Se importan solo las columnas II.EE, GRADO, NOMBRES Y
              APELLIDOS y DNI. Los alumnos que ya estén registrados en el colegio no se importan de nuevo.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACEPTA}
              className="hidden"
              onChange={(e) => elegirArchivo(e.target.files)}
            />
            {/*
              Arrastrar y soltar, con el clic como alternativa de siempre: el
              mismo destino (`elegirArchivo`), dos formas de llegar. El clic
              abre el selector nativo del sistema operativo —`inputRef`—, no
              hay que simularlo.
            */}
            {/*
              Un <button> de verdad: Enter y Espacio lo activan solos. Sin el
              atributo `disabled` a propósito: un botón deshabilitado no recibe
              los eventos de arrastre, y un archivo soltado ahí sin conexión lo
              abriría el navegador en la pestaña. Se bloquea con `puedeElegir`.
              Dentro van <span> y no <p>, que no es válido en un botón.
            */}
            <button
              type="button"
              aria-disabled={!puedeElegir}
              aria-label="Seleccionar archivo"
              onClick={() => puedeElegir && inputRef.current?.click()}
              onDragEnter={alEntrarArrastre}
              onDragOver={alEntrarArrastre}
              onDragLeave={alSalirArrastre}
              onDrop={alSoltar}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${claseDeZona(puedeElegir, arrastrando)}`}
            >
              {paso === 'cargando' ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
                  <span className="block text-sm font-medium text-ink-700">Leyendo el archivo…</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-8 w-8 text-brand-600" aria-hidden="true" />
                  <span className="block text-sm font-medium text-ink-700">
                    Arrastra aquí tu archivo, o <span className="text-brand-700 underline">selecciónalo</span>
                  </span>
                  <span className="block text-xs text-ink-400">Excel (.xlsx), hasta {MAXIMO_MB} MB y 3000 alumnos.</span>
                </>
              )}
            </button>
            {/* Fuera del botón a propósito: así no entra en su nombre accesible. */}
            <p className="text-xs text-ink-400">
              Ejemplo de fila: Amashca · 3° · QUISPE MAMANI, Juan Carlos · 01234567. Escribe el colegio tal como figura en SICEDU y los nombres como APELLIDOS, Nombres.
            </p>
            {!enLinea && <p className="text-xs text-warning-600">Sin conexión. Conéctate a Internet para continuar con la importación.</p>}
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">{previa.listos} alumnos listos para importar</Badge>
              {previa.con_advertencia > 0 && <Badge tone="warning">{previa.con_advertencia} filas con advertencia</Badge>}
              {previa.no_importadas > 0 && <Badge tone="danger">{previa.no_importadas} filas que no se importarán</Badge>}
            </div>
            <p className="text-xs text-ink-500">
              Los alumnos se importarán con estado activo, sin sección, subprograma, ciclo EBR ni inicio de
              pertenencia. Podrás completar esos datos después, desde la edición de cada alumno.
            </p>

            {previa.listos === 0 && (
              <p className="text-sm font-medium text-danger-600">No hay alumnos para importar en este archivo.</p>
            )}

            {previa.observaciones.length > 0 && (
              <DataTable
                initialPageSize={40}
                paginated
                rows={previa.observaciones}
                columns={[
                  { key: 'hoja', header: 'Hoja', render: (o) => o.hoja ?? '—' },
                  { key: 'fila', header: 'Fila', align: 'center', render: (o) => o.fila ?? '' },
                  {
                    key: 'motivo',
                    header: 'Motivo',
                    render: (o) => (
                      <span className="flex items-center gap-2">
                        <Badge tone={TONO_OBSERVACION[o.tipo] ?? 'neutral'}>{o.detalle}</Badge>
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </>
        )}

        {!enLinea && paso !== 'elegir' && paso !== 'cargando' && (
          <p className="text-xs text-warning-600">Sin conexión. Conéctate a Internet para continuar con la importación.</p>
        )}
        {error && <p className="text-sm font-medium text-danger-600">{error}</p>}
      </div>
    </Modal>
  )
}
