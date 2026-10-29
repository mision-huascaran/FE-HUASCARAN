// CU011 / CU012 — Aviso de que el resumen viene de la copia local.
//
// Sin conexión se muestra el último resumen guardado, pero hay que decir que
// puede estar desactualizado: tomar una decisión con números viejos creyéndolos
// de hoy es peor que no verlos.
//
// Y cuando NO hay nada que mostrar, la causa importa: no es igual estar sin
// conexión que estar conectado y que el servidor no conteste. Los dos casos
// tienen texto propio, y además distinto por rol, porque CU011 y CU012 los
// dan literales y no coinciden entre sí.
import { ServerCrash, WifiOff } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'

const LITERALES = {
  supervisor: {
    sinConexion: 'No existe información operativa disponible sin conexión.',
    sinServidor: 'No hay conexión con el servidor ni un resumen local guardado. Inténtalo más tarde.',
  },
  directivo: {
    sinConexion: 'No existe información institucional disponible sin conexión.',
    sinServidor: 'No se pudieron cargar los indicadores y no hay datos locales. Inténtalo más tarde.',
  },
}

/**
 * @param rol      'supervisor' | 'directivo'; elige el literal del caso de uso.
 * @param sinDatos no hay nada que pintar, ni del servidor ni de la copia local.
 * @param enLinea  con `sinDatos`, distingue el fallo del servidor del corte.
 */
export default function AvisoDatosLocales({ rol = 'directivo', sinDatos = false, enLinea = false }) {
  if (sinDatos) {
    const textos = LITERALES[rol] ?? LITERALES.directivo
    return enLinea ? (
      <EmptyState
        icon={ServerCrash}
        title="No se pudieron cargar los indicadores"
        description={textos.sinServidor}
      />
    ) : (
      <EmptyState
        icon={WifiOff}
        title="Sin información para mostrar"
        description={textos.sinConexion}
      />
    )
  }

  // D52 — Con conexión y el servidor caído la copia también se marca, pero
  // decir "Sin conexión" a quien tiene internet sería falso.
  const Icono = enLinea ? ServerCrash : WifiOff
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-warning-600/20 bg-warning-100 px-4 py-3 text-sm text-warning-600"
    >
      <Icono className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {enLinea ? 'No se pudo recuperar la información del servidor' : 'Sin conexión'}: se muestra el último
        resumen guardado y <strong>puede estar desactualizado</strong>.
      </span>
    </div>
  )
}
