// Una tarjeta del Dashboard: UN módulo, UNA cifra, UNA gráfica y UNA salida.
//
// POR QUÉ ESTA FORMA. El dashboard anterior tenía nueve bloques y cada uno
// explicaba su propia fórmula en un párrafo: ocho tarjetas de cifras, tablas
// completas y títulos como "Distribución de alumnos por subprograma y nivel".
// Había que leerlo para entenderlo, y no llevaba a ninguna parte.
//
// Ahora cada tarjeta responde tres preguntas y se calla:
//
//   · ¿de qué módulo hablamos? → el TÍTULO, que es el nombre del módulo tal
//     como aparece en el menú lateral;
//   · ¿cómo va? → UNA cifra grande con una etiqueta de dos o tres palabras;
//   · ¿y qué hago? → UN enlace al módulo de verdad, ya filtrado.
//
// Lo que antes era párrafo vive ahora en el `title` de la cifra: quien quiera
// la fórmula la tiene, y quien solo quiera el número no la lee.
//
// El marco —carga, error, "sin datos", "información no actualizada" y
// "cambios sin aplicar"— lo sigue poniendo `BloqueDashboard`, que ya resuelve
// que un bloque roto no se lleve por delante a los otros tres.
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import BloqueDashboard from './BloqueDashboard'
import { SIN_INFORMACION } from './estados'

export default function TarjetaModulo({
  /** El nombre del módulo, igual que en el menú. Dos o tres palabras. */
  titulo,
  contexto,
  consulta,
  vacio = false,
  hayCambios = false,
  /** La cifra que resume el módulo, ya formateada. */
  cifra,
  /** Dos o tres palabras: de qué es la cifra. */
  etiqueta,
  /** La fórmula o el matiz, solo para quien lo busque. */
  detalle,
  /** Aviso corto: "Provisional", "Información incompleta". */
  aviso,
  /** `{ a, texto }` del módulo de destino, o `null` si este rol no entra. */
  enlace,
  /** Colegios que quedaron FUERA de la cifra, con su motivo. */
  sinInformacion = [],
  children,
}) {
  return (
    <BloqueDashboard
      titulo={titulo}
      contexto={contexto}
      consulta={consulta}
      vacio={vacio}
      hayCambios={hayCambios}
      /*
        LA SALIDA AL MÓDULO VA EN LA CABECERA, no entre los datos.

        Es lo que el dashboard viejo no tenía: se miraban indicadores y para
        actuar había que ir al menú, entrar al módulo y volver a montar los
        filtros a mano. Y va en la cabecera justamente porque NO depende de la
        consulta: si los datos fallan o están cargando, entrar al módulo sigue
        siendo lo más útil que se puede hacer desde aquí. Dentro del cuerpo
        quedaría escondido tras el "Reintentar".
      */
      acciones={
        <>
          {aviso && <Badge tone="warning">{aviso}</Badge>}
          {enlace && (
            <Link
              to={enlace.a}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong bg-surface-0 px-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-surface-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {enlace.texto}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-baseline gap-2" title={detalle}>
          <span className="text-3xl font-bold leading-none text-ink-900 md:text-4xl">
            {cifra ?? SIN_INFORMACION}
          </span>
          {etiqueta && <span className="text-sm text-ink-500">{etiqueta}</span>}
        </p>

        {children}

        {/* Un colegio cuyo periodo no empezó NO suma y se nombra: pintarlo
            como 0 alumnos sería decir que no tiene ninguno. */}
        {sinInformacion.length > 0 && (
          <p className="text-xs text-warning-600">
            Sin información y fuera del total: {sinInformacion.map((c) => c.nombre).join(', ')}. Todavía no
            empezaron el periodo seleccionado.
          </p>
        )}
      </div>
    </BloqueDashboard>
  )
}
