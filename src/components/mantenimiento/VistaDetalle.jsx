// Subflujo S3 — Visualizar.
//
// "Visualizar" enseñaba el MISMO formulario que "Editar", solo que en gris.
// Eso tiene dos problemas: se lee peor que una ficha (cada dato dentro de una
// caja que invita a escribir y no deja), y confunde sobre si se está editando.
// Y había un tercero, más serio: lo que no cabía en un input simplemente no se
// veía. Los "Grados que ofrece" de un colegio salían siempre vacíos porque los
// recuadros marcados se pintan desmarcados cuando están bloqueados.
//
// Aquí no hay controles: cada dato es una etiqueta y su valor, ya resuelto a
// texto. Un `select` muestra la ETIQUETA de la opción, no su id; una selección
// múltiple, la lista de lo elegido.
const VACIO = '—'

/** El texto que corresponde a un valor según las opciones del campo. */
function etiquetaDeOpcion(campo, valor) {
  const opcion = (campo.opciones ?? []).find((o) => String(o.value) === String(valor))
  return opcion?.label ?? (valor === '' || valor == null ? null : String(valor))
}

/** Lo elegido en un campo múltiple, en el orden en que se ofrecen las opciones. */
function elegidos(campo, valor) {
  const marcados = new Set((Array.isArray(valor) ? valor : []).map(String))
  return (campo.opciones ?? []).filter((o) => marcados.has(String(o.value)))
}

function Dato({ campo, children }) {
  return (
    <div className={campo.ancho === 'completo' ? 'md:col-span-2' : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{campo.etiqueta}</dt>
      <dd className="mt-1 text-sm text-ink-900">{children}</dd>
    </div>
  )
}

export default function VistaDetalle({ campos = [], valores = {} }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
      {campos.map((campo) => {
        const valor = valores[campo.nombre]

        // Un campo con componente propio sabe pintarse mejor que esto: los
        // grados de un colegio, por ejemplo, llevan su día de clase al lado.
        if (campo.componente) {
          const Propio = campo.componente
          return <Propio key={campo.nombre} campo={campo} valor={valor} modo="ver" onCambio={() => {}} />
        }

        if (campo.tipo === 'multiple') {
          const marcados = elegidos(campo, valor)
          return (
            <Dato key={campo.nombre} campo={{ ...campo, ancho: 'completo' }}>
              {marcados.length ? (
                <ul className="flex flex-wrap gap-2">
                  {marcados.map((o) => (
                    <li
                      key={o.value}
                      className="rounded-lg border border-brand-600/30 bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700"
                    >
                      {o.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-ink-400">{VACIO}</span>
              )}
            </Dato>
          )
        }

        const texto = campo.tipo === 'select' ? etiquetaDeOpcion(campo, valor) : valor
        const vacio = texto === '' || texto == null
        return (
          <Dato key={campo.nombre} campo={campo}>
            <span className={vacio ? 'text-ink-400' : undefined}>{vacio ? VACIO : String(texto)}</span>
          </Dato>
        )
      })}
    </dl>
  )
}
