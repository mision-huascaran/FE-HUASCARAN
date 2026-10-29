// Subflujo S5 — Ver auditoría. Para el alumno es el Historial de CU015.
//
// D29: ESTA PESTAÑA TUMBABA LA PANTALLA ENTERA. El backend responde un
// PAGINADO (`{items, total, page…}`) y aquí se le pasaba el objeto completo a
// la tabla, que llamaba a `.slice()` sobre él: "TypeError: k.slice is not a
// function" y, con el límite de error de por medio, "No se pudo mostrar esta
// pantalla". Además se leían `campo` y `valor_anterior`, que no existen: el
// detalle de una edición viene dentro de `cambios[]`.
//
// Ahora el recurso entrega siempre una lista (ver `listarAuditoria`) y aquí se
// pinta el formato que pide CU015 al pie de la letra:
//
//   "[Nombre Apellido] (Rol) creó / editó / inactivó al alumno
//    el DD/MM/AAAA a las HH:MM"
//
// y, en las ediciones, una línea por campo: "Grado: 1.º → 2.º".
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import DataTable from '../ui/DataTable'
import EmptyState from '../ui/EmptyState'
import { mensajeDeError } from '../../api/client'
import { formatearFechaHora } from '../../lib/format'

/**
 * El sujeto de la frase: "al alumno", "el colegio", "la cuenta".
 *
 * Va por ENTIDAD, en singular. Antes se buscaba por sección —"alumnos"—, que
 * no está en esta tabla, así que toda la auditoría decía "modificó el
 * registro" en vez de la frase de CU015.
 */
const SUJETO = { alumno: 'al alumno', colegio: 'el colegio', usuario: 'la cuenta' }

/**
 * `accion` ES UN CÓDIGO, no una frase.
 *
 * El contrato manda `crear` | `editar` | `activar` | `inactivar`, como cualquier
 * otro código: el front decide por códigos, nunca por textos. Aquí se pintaba
 * tal cual, y con el servidor de verdad la línea salía "Patricia Velásquez
 * (Docente) EDITAR al alumno el 20/11/2026". No se vio antes porque el
 * simulador devolvía el verbo ya conjugado.
 *
 * Los verbos son los de CU014, y el de editar NO es "editó al alumno": es
 * "editó la información del alumno". Por eso la frase entera se arma aquí y no
 * concatenando un sujeto común.
 */
/** "del alumno", o "de" y el sujeto tal cual. */
const deSujeto = (sujeto) => (sujeto === 'al alumno' ? 'del alumno' : `de ${sujeto}`)

const FRASE = {
  crear: (sujeto) => `creó ${sujeto}`,
  editar: (sujeto) => `editó la información ${deSujeto(sujeto)}`,
  activar: (sujeto) => `activó ${sujeto}`,
  inactivar: (sujeto) => `inactivó ${sujeto}`,
}

/**
 * Qué hizo, ya redactado.
 *
 * Un código que no esté en la tabla se dice en genérico en vez de pintarse en
 * crudo: inventaría una conjugación que nadie escribió.
 */
const fraseDe = (evento, entidad) => {
  const sujeto = SUJETO[entidad] ?? 'el registro'
  const armar = FRASE[evento?.accion]
  return armar ? armar(sujeto) : `modificó ${sujeto}`
}

export default function PestanaAuditoria({ entidad, registro, cargarAuditoria }) {
  const id = registro?.id ?? registro?.[`id_${entidad}`] ?? null
  const consulta = useQuery({
    queryKey: ['auditoria', entidad, id],
    queryFn: () => cargarAuditoria(id),
    enabled: Boolean(id && cargarAuditoria),
  })

  if (consulta.isError) {
    return <EmptyState title="No se pudo cargar el historial" description={mensajeDeError(consulta.error)} />
  }

  // Aunque el recurso ya normaliza, la tabla NO vuelve a confiar: este
  // componente se rompió justamente por dar por hecha la forma de los datos.
  const eventos = Array.isArray(consulta.data) ? consulta.data : []

  return (
    <DataTable
      loading={consulta.isLoading}
      rows={eventos}
      getRowId={(e, i) => `${e.fecha}-${e.usuario}-${i}`}
      initialPageSize={5}
      empty={
        <EmptyState
          icon={History}
          title="Sin cambios registrados"
          description="Todavía no se ha modificado este registro."
        />
      }
      columns={[
        {
          key: 'evento',
          header: 'Evento',
          render: (evento) => (
            <span className="font-medium text-ink-900">
              {evento.usuario}
              {evento.rol ? <span className="font-normal text-ink-500">{` (${evento.rol})`}</span> : null}
              {` ${fraseDe(evento, entidad)}`}
            </span>
          ),
        },
        {
          key: 'fecha',
          header: 'Cuándo',
          render: (evento) => <span className="text-ink-700">{formatearFechaHora(evento.fecha)}</span>,
        },
        {
          key: 'cambios',
          header: 'Detalle',
          render: (evento) =>
            evento.cambios?.length ? (
              <ul className="flex flex-col gap-0.5">
                {evento.cambios.map((cambio) => (
                  <li key={cambio.campo} className="text-xs">
                    <span className="font-medium text-ink-700">{`${cambio.campo}: `}</span>
                    <span className="text-ink-500">{cambio.anterior ?? '—'}</span>
                    <span className="text-ink-400">{' → '}</span>
                    <span className="font-medium text-ink-900">{cambio.nuevo ?? '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-ink-400">—</span>
            ),
        },
      ]}
    />
  )
}
