// Un campo del popup de mantenimiento, según su tipo.
//
// En modo "ver" TODOS los campos van bloqueados (S3), y en "editar" solo los
// que la sección declare `soloLectura`. El bloqueo se decide aquí y no en cada
// pantalla, para que los tres modos se comporten igual en Alumnos, Usuarios y
// Colegios.
import Input from '../ui/Input'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'

export default function CampoMantenimiento({ campo, valor, onCambio, modo, error }) {
  // Una sección puede traer su propio componente cuando el dato no cabe en un
  // input: por ejemplo los grados y secciones de un colegio, que son una lista.
  if (campo.componente) {
    const Propio = campo.componente
    return <Propio campo={campo} valor={valor} onCambio={onCambio} modo={modo} error={error} />
  }

  const bloqueado = modo === 'ver' || campo.soloLectura || (modo === 'editar' && campo.soloAlCrear)
  const comun = {
    label: campo.etiqueta,
    required: campo.requerido && modo !== 'ver',
    disabled: bloqueado,
    error,
    hint: campo.ayuda,
    className: campo.ancho === 'completo' ? 'md:col-span-2' : undefined,
  }

  if (campo.tipo === 'select') {
    return (
      <Select
        {...comun}
        value={valor ?? ''}
        placeholder={campo.placeholder ?? 'Seleccione'}
        options={campo.opciones ?? []}
        onChange={(e) => onCambio(campo.nombre, e.target.value)}
      />
    )
  }

  if (campo.tipo === 'multiple') {
    // Varias opciones a la vez: un docente tiene varios colegios y varias
    // secciones por colegio. Se usa un <select multiple> nativo porque el
    // sistema de diseño no tiene un componente propio para esto.
    const seleccion = Array.isArray(valor) ? valor.map(String) : []
    return (
      <label className={`flex flex-col gap-1.5 ${campo.ancho === 'completo' ? 'md:col-span-2' : ''}`}>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
          {campo.etiqueta}
          {campo.requerido && modo !== 'ver' && <span className="ml-1 text-danger-500">*</span>}
        </span>
        <select
          multiple
          disabled={bloqueado}
          value={seleccion}
          size={Math.min(6, Math.max(3, (campo.opciones ?? []).length))}
          onChange={(e) => onCambio(campo.nombre, [...e.target.selectedOptions].map((o) => o.value))}
          className="rounded-lg border border-line bg-surface-0 px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:bg-surface-100 disabled:text-ink-500"
        >
          {(campo.opciones ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {campo.ayuda && <span className="text-xs text-ink-400">{campo.ayuda}</span>}
        {error && <span className="text-xs font-medium text-danger-600">{error}</span>}
      </label>
    )
  }

  if (campo.tipo === 'textarea') {
    return (
      <Textarea
        {...comun}
        className="md:col-span-2"
        maxLength={campo.maximo ?? 500}
        value={valor ?? ''}
        onChange={(e) => onCambio(campo.nombre, e.target.value)}
      />
    )
  }

  return (
    <Input
      {...comun}
      type={campo.tipo === 'numero' ? 'number' : campo.tipo === 'email' ? 'email' : 'text'}
      value={valor ?? ''}
      onChange={(e) => onCambio(campo.nombre, e.target.value)}
    />
  )
}
