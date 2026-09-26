// Cubre: RF-009, RF-010, RF-016, RNF-004
import BloqueDescargas from './BloqueDescargas'

/**
 * Reportes y descargas (rol Directivos). Solo lectura: ningún formulario.
 * Pendiente: las funcionalidades propias de Directivos están "a definir" (§13);
 * esta pantalla es una propuesta y así queda señalada en docs/trazabilidad-rf.md.
 */
export default function ReportesPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Reportes</h1>
        <p className="mt-1 text-sm text-ink-500">Consolidados y rankings del programa, listos para descargar.</p>
      </header>
      <BloqueDescargas titulo="Reportes disponibles" />
    </div>
  )
}
