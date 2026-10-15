// Cubre: RF-012, RF-013, RF-015, RF-016, RF-017, RF-025, RN-006, RN-007, RN-008,
//        RN-016, RN-024, RNF-001, RNF-006
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import FilterBar from '../../components/ui/FilterBar'
import GrillaRubrica from '../rubricaSemanal/GrillaRubrica'
import GrillaSemanal from './GrillaSemanal'
import Select from '../../components/ui/Select'
import useFiltrosSemanales from './useFiltrosSemanales'
import { useQuery } from '@tanstack/react-query'
import { listarDocentes } from '../../api/resources/administracion'
import useGrillaSemanal from './useGrillaSemanal'
import SinGrillaSemanal from './SinGrillaSemanal'
import { etiquetaDeSemana } from '../../lib/format'
import { ACCION, puede } from '../../auth/permisos'
import useSessionStore from '../../store/sessionStore'

const CICLOS = [
  { value: 1, label: 'Ciclo III' },
  { value: 2, label: 'Ciclo IV' },
  { value: 3, label: 'Ciclo V' },
]
import useActividadStore from '../../store/actividadStore'
import AvisoActividades from '../../components/layout/AvisoActividades'

/**
 * Rúbrica y Seguimiento de Lectura comparten grilla, filtros y alumnos, pero la
 * matriz del sprint las trata como DOS secciones con permisos propios. Con
 * `pestanaFija` cada ruta entra directamente en la suya y desaparecen las
 * pestañas: desde /rubrica no se llega a la otra sección saltándose su guarda.
 */
export default function ReporteSemanalPage({ pestanaFija = null }) {
  const {
    semanas,
    colegios,
    grados,
    secciones,
    idSemana,
    idColegio,
    idGrado,
    idCiclo,
    idSeccion,
    idDocenteFiltro,
    pestana: pestanaUrl,
    puedeEditar,
    cambiar,
  } = useFiltrosSemanales()

  const pestana = pestanaFija ?? pestanaUrl
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const seccion = pestana === 'rubrica' ? 'rubrica' : 'lectura'
  // D3: el Supervisor ve las grillas de todos los docentes, pero no las edita
  // ni crea grillas nuevas. El permiso sale de la matriz, no del rol a mano.
  const puedeEditarSeccion = puede(seccion, idRol, ACCION.EDITAR)

  // D4: la grilla solo se edita con ACTIVIDADES iniciadas. Tener sesión abierta
  // no basta: el botón de actividades es lo que marca que el docente está
  // trabajando en el aula, y es lo que ata cada cambio a una sesión auditable.
  const conActividades = Boolean(useActividadStore((s) => s.sesion))

  const soloLectura = !puedeEditar || !puedeEditarSeccion || !conActividades
  const filtrosListos = Boolean(idSemana && idColegio && idGrado)

  const grilla = useGrillaSemanal({ tipo: seccion, idSemana, idColegio, idGrado, idSeccion })

  // Solo hace falta para el Supervisor; al Docente no se le pide.
  const { data: docentes = [] } = useQuery({
    queryKey: ['admin', 'docentes'],
    queryFn: listarDocentes,
    enabled: !puedeEditarSeccion,
  })

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">
          {seccion === 'rubrica' ? 'Rúbrica' : 'Seguimiento de Lectura'}
        </h1>
      </header>

      {puedeEditarSeccion && !conActividades && <AvisoActividades />}
      {soloLectura && conActividades && idColegio && <AvisoModoConsulta />}

      {/* Orden de T32: cada filtro acota al siguiente. */}
      <FilterBar>
        {/* T22: el Supervisor ve las grillas de TODOS los docentes, así que
            necesita elegir de quién. El Docente solo ve las suyas. */}
        {!puedeEditarSeccion && (
          <Select
            label="Docente"
            value={idDocenteFiltro ?? ''}
            placeholder="Todos"
            onChange={(e) => cambiar('docente', e.target.value)}
            options={docentes.map((d) => ({ value: d.id_docente, label: d.nombre }))}
          />
        )}
        <Select
          label="Colegio"
          value={idColegio ?? ''}
          onChange={(e) => cambiar('colegio', e.target.value)}
          options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Ciclo"
          value={idCiclo ?? ''}
          onChange={(e) => cambiar('ciclo', e.target.value)}
          placeholder="Todos"
          options={CICLOS}
        />
        <Select
          label="Grado"
          value={idGrado ?? ''}
          onChange={(e) => cambiar('grado', e.target.value)}
          options={grados.map((g) => ({ value: g, label: `${g}.° grado` }))}
        />
        <Select
          label="Sección"
          value={idSeccion ?? ''}
          onChange={(e) => cambiar('seccion', e.target.value)}
          placeholder="Todas"
          options={secciones.map((s) => ({ value: s.id_seccion, label: s.nombre }))}
        />
        <Select
          label="Semana"
          value={idSemana ?? ''}
          onChange={(e) => cambiar('semana', e.target.value)}
          options={semanas.map((s) => ({ value: s.id_semana, label: etiquetaDeSemana(s) }))}
        />
      </FilterBar>

      {filtrosListos && !grilla.existe && !grilla.cargando && (
        <SinGrillaSemanal
          puedeCrear={puedeEditarSeccion && conActividades}
          creando={grilla.creando}
          onCrear={grilla.crear}
        />
      )}

      {filtrosListos &&
        grilla.existe &&
        (pestana === 'rubrica' ? (
          <GrillaRubrica
            idSemana={idSemana}
            idColegio={idColegio}
            idGrado={idGrado}
            ausentes={grilla.ausentes}
            soloLectura={soloLectura}
          />
        ) : (
          <GrillaSemanal
            idSemana={idSemana}
            idColegio={idColegio}
            idGrado={idGrado}
            soloLectura={soloLectura}
          />
        ))}
    </div>
  )
}
