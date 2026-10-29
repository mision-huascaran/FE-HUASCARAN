// Una fila de la tabla de lectura semanal (CU024).
//
// Cinco cosas por alumno: su asistencia en la clase de referencia (de solo
// lectura, viene de Asistencias), el LSN —título, nota y máximo—, cuántos LSL
// leyó, el total calculado y una observación.
//
// LO QUE MANDA EN ESTA FILA ES LA ASISTENCIA. Sin presente o tardanza en la
// clase de referencia no se pueden registrar libros: el servidor lo rechaza, y
// deshabilitar los campos aquí evita que el docente escriba para nada. La
// observación sí se admite siempre —salvo tabla "no realizada"—, porque
// justificar una falta es justo lo que hace falta ahí.
//
// `cantidad_lsl: null` NO ES CERO. Es "no registrado", y por eso la fila sigue
// pendiente en vez de darse por completada con cero libros. El campo se deja
// vacío, no a cero.
import { useEffect, useState } from 'react'
import { AlertTriangle, MessageSquare, MessageSquareText } from 'lucide-react'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ESTADO_FILA, MAXIMOS_LSN, MOTIVO_FILA } from '../../api/resources/lectura'

const TONO = {
  success: 'bg-success-100 text-success-600',
  warning: 'bg-warning-100 text-warning-600',
  neutral: 'bg-surface-100 text-ink-500',
}

const ASISTENCIA = {
  presente: 'Presente',
  tardanza: 'Tardanza',
  ausente: 'Ausente',
}

/** Vacío de verdad: `null` y `''` son lo mismo al escribir, 0 no lo es. */
const aNumero = (valor) => (valor === '' || valor == null ? null : Number(valor))

/**
 * D96 — EL LSN ES UNA SOLA COSA: TÍTULO, NOTA Y MÁXIMO.
 *
 * Antes cada campo se mandaba al salir de él, y el servidor rechaza un LSN
 * a medias (`lsn_incompleto`): el título solo, la nota sola o el máximo solo
 * volvían rechazados y la fila se vaciaba. No había forma de registrar uno.
 *
 * Ahora los tres viajan JUNTOS cuando están completos, o los tres en `null`
 * cuando se vacían (para borrarlo). A medias se quedan en la fila, sin enviar,
 * con el aviso de qué falta.
 */
/** El LSN del borrador ya normalizado: título sin espacios y números. */
const lsnDe = (b) => ({
  lsn_titulo: String(b.lsn_titulo ?? '').trim() || null,
  lsn_nota: aNumero(b.lsn_nota),
  lsn_maximo: aNumero(b.lsn_maximo),
})

/** Ni vacío ni completo: el estado que el servidor no acepta. */
const aMedias = (lsn) => {
  const llenos = [lsn.lsn_titulo, lsn.lsn_nota, lsn.lsn_maximo].filter((v) => v != null).length
  return llenos > 0 && llenos < 3
}

const mismoLsn = (lsn, fila) =>
  lsn.lsn_titulo === (fila.lsn_titulo ?? null) &&
  lsn.lsn_nota === (fila.lsn_nota ?? null) &&
  lsn.lsn_maximo === (fila.lsn_maximo ?? null)

export default function FilaLectura({ fila, soloLectura, bloqueada, onGuardar, onObservar }) {
  const estado = ESTADO_FILA[fila.estado_fila] ?? ESTADO_FILA.pendiente
  const asistio = ['presente', 'tardanza'].includes(fila.asistencia)
  // Los libros se bloquean sin asistencia; la observación, solo si la tabla
  // entera está marcada como no realizada.
  const sinLibros = soloLectura || bloqueada || !asistio
  const conNota = Boolean(fila.observacion)
  const Globo = conNota ? MessageSquareText : MessageSquare

  /**
   * El borrador vive en la fila para que escribir no vaya al servidor en cada
   * tecla: se manda al salir del campo, y solo si cambió.
   */
  const [borrador, setBorrador] = useState(fila)
  // Lo que llega del servidor (otro campo guardado, una recarga) no se come un
  // LSN a medio escribir: ese todavía no se ha enviado y solo existe aquí.
  useEffect(
    () =>
      setBorrador((previo) =>
        aMedias(lsnDe(previo))
          ? { ...fila, lsn_titulo: previo.lsn_titulo, lsn_nota: previo.lsn_nota, lsn_maximo: previo.lsn_maximo }
          : fila,
      ),
    [fila],
  )

  const alSalir = (campo, valor) => {
    if (valor === (fila[campo] ?? null)) return
    onGuardar(fila, { [campo]: valor })
  }

  /** Guarda el LSN entero, con `cambio` aplicado sobre lo que hay escrito. */
  const alSalirDelLsn = (cambio = {}) => {
    const lsn = lsnDe({ ...borrador, ...cambio })
    if (aMedias(lsn) || mismoLsn(lsn, fila)) return
    onGuardar(fila, lsn)
  }
  const lsnIncompleto = !sinLibros && aMedias(lsnDe(borrador))

  return (
    <tr className="border-t border-line align-top">
      <td className="px-3 py-2">
        <span className="font-medium text-ink-900">{fila.nombre}</span>
        {fila.inactivo && (
          <span
            title="Dado de baja: estaba en la clase de referencia"
            className="ml-2 whitespace-nowrap rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-ink-500"
          >
            Inactivo
          </span>
        )}
        {/*
          Tiene libros guardados pero HOY consta ausente: alguien corrigió la
          asistencia después. No se borra nada solo —sería decidir por el
          docente—, se avisa para que él resuelva (CU024).
        */}
        {fila.revisar_asistencia && (
          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Revisa la asistencia: hay lectura registrada y hoy consta ausente.
          </span>
        )}
      </td>

      {/* La asistencia se MUESTRA, no se edita: su sitio es Asistencias. */}
      <td className="px-3 py-2 text-center text-sm text-ink-700">
        {ASISTENCIA[fila.asistencia] ?? 'Sin marcar'}
      </td>

      <td className="px-3 py-2">
        <Input
          aria-label={`Título del LSN de ${fila.nombre}`}
          value={borrador.lsn_titulo ?? ''}
          disabled={sinLibros}
          placeholder={sinLibros ? '' : 'Título del libro'}
          onChange={(e) => setBorrador((b) => ({ ...b, lsn_titulo: e.target.value }))}
          onBlur={(e) => alSalirDelLsn({ lsn_titulo: e.target.value })}
        />
        {lsnIncompleto && (
          <span role="status" className="mt-1 flex items-center gap-1 text-xs font-medium text-warning-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {MOTIVO_FILA.lsn_incompleto}
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            aria-label={`Nota del LSN de ${fila.nombre}`}
            className="w-16"
            min={0}
            max={borrador.lsn_maximo ?? 10}
            value={borrador.lsn_nota ?? ''}
            disabled={sinLibros}
            onChange={(e) => setBorrador((b) => ({ ...b, lsn_nota: e.target.value }))}
            onBlur={(e) => alSalirDelLsn({ lsn_nota: e.target.value })}
          />
          <span className="text-ink-400">/</span>
          {/* Solo 5 o 10: no hay otros máximos (CU024). */}
          <Select
            aria-label={`Puntaje máximo del LSN de ${fila.nombre}`}
            className="w-20"
            value={borrador.lsn_maximo ?? ''}
            placeholder="—"
            disabled={sinLibros}
            onChange={(e) => {
              setBorrador((b) => ({ ...b, lsn_maximo: e.target.value }))
              alSalirDelLsn({ lsn_maximo: e.target.value })
            }}
            options={MAXIMOS_LSN.map((m) => ({ value: m, label: String(m) }))}
          />
        </div>
      </td>

      <td className="px-3 py-2">
        <Input
          type="number"
          aria-label={`Libros de sala de lectura de ${fila.nombre}`}
          className="w-20"
          min={0}
          step={1}
          // Vacío, no cero: "no registrado" y "leyó cero" son cosas distintas.
          value={borrador.cantidad_lsl ?? ''}
          disabled={sinLibros}
          onChange={(e) => setBorrador((b) => ({ ...b, cantidad_lsl: e.target.value }))}
          onBlur={(e) => alSalir('cantidad_lsl', aNumero(e.target.value))}
        />
      </td>

      {/* Calculado por el servidor: (1 si hay LSN) + los LSL. No editable. */}
      <td className="px-3 py-2 text-center font-semibold text-ink-900">{fila.total_libros ?? 0}</td>

      <td className="px-3 py-2 text-center">
        <button
          type="button"
          // Una nota existente se puede LEER aunque no se pueda escribir.
          disabled={(soloLectura || bloqueada) && !conNota}
          onClick={() => onObservar(fila)}
          aria-label={`${conNota ? 'Ver' : 'Añadir'} observación de ${fila.nombre}`}
          title={conNota ? fila.observacion : 'Sin observación'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-400 transition-colors hover:border-brand-500/60 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Globo className="h-4 w-4" aria-hidden="true" />
        </button>
      </td>

      <td className="px-3 py-2 text-center">
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONO[estado.tono]}`}>
          {estado.texto}
        </span>
      </td>
    </tr>
  )
}
