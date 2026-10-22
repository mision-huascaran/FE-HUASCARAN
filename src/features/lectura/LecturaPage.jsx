// Cubre: CU023 a CU026 · Seguimiento de Lectura, rehecho en la tanda 7.
//
// LO QUE CAMBIÓ DE RAÍZ: antes era una grilla de filas sueltas, una por alumno
// y semana. Ahora la unidad es la TABLA SEMANAL: un objeto que existe o no
// existe, se crea a mano, tiene su versión y se puede marcar "no realizada".
//
// Por eso la pantalla tiene TRES estados y no uno:
//
//   1. Filtros incompletos — no hay tabla que buscar todavía.
//   2. La tabla no existe — y eso NO es un error. Se ofrece crearla, diciendo
//      a qué clase quedará atada, porque crearla congela la lista de alumnos
//      de esa clase y eso no se puede deshacer sin consecuencias.
//   3. La tabla existe — se editan sus filas.
//
// Y la lectura DEPENDE DE LA ASISTENCIA: sin presente o tardanza en la clase de
// referencia no hay libros que registrar. La asistencia se muestra pero no se
// edita aquí; su sitio es el módulo de Asistencia, y duplicar el control haría
// que el docente marcara la falta dos veces.
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck, CalendarPlus } from 'lucide-react'
import AvisoActividades from '../../components/layout/AvisoActividades'
import AvisoModoConsulta from '../../components/layout/AvisoModoConsulta'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import Select from '../../components/ui/Select'
import ModalObservacionLectura from './ModalObservacionLectura'
import ModalNoRealizada from './ModalNoRealizada'
import TablaLectura from './TablaLectura'
import useFiltrosDeGrupo, { MESES, etiquetaDeSemanaDeGrupo } from '../../hooks/useFiltrosDeGrupo'
import useTablaLectura from './useTablaLectura'
import { anioVigente, listarAniosEscolares } from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { ACCION, puede } from '../../auth/permisos'
import { ROLES } from '../../auth/roles'
import useActividadStore from '../../store/actividadStore'
import useSessionStore from '../../store/sessionStore'

const SIEMPRE = { staleTime: Infinity, gcTime: Infinity }

const FECHA_LARGA = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
const comoFecha = (iso) => (iso ? FECHA_LARGA.format(new Date(`${iso}T12:00:00`)) : null)

export default function LecturaPage() {
  const idRol = Number(useSessionStore((s) => s.usuario?.id_rol))
  const esDocente = idRol === ROLES.PROFESOR
  const conActividad = Boolean(useActividadStore((s) => s.sesion))
  const puedeEditar = puede('lectura', idRol, ACCION.EDITAR)

  const [observando, setObservando] = useState(null)
  const [justificando, setJustificando] = useState(false)

  // El año escolar en curso. La tabla lo exige, y no se puede deducir del mes:
  // enero y febrero pertenecen al año anterior en algunos colegios.
  const { data: anios = [] } = useQuery({
    queryKey: ['anios-escolares'],
    queryFn: listarAniosEscolares,
    ...SIEMPRE,
  })
  const idAnioEscolar = useMemo(() => anioVigente(anios)?.id ?? null, [anios])

  const { colegios, grados, secciones, programas, semanas, filtros, cambiar } = useFiltrosDeGrupo({
    esDocente,
    idAnioEscolar,
  })

  const { tabla, cargando, error, porCrear, crear, creando, marcarNoRealizada, marcando, guardarFila } =
    useTablaLectura(filtros)

  const listos = Boolean(
    filtros.idColegio &&
      filtros.idGrado &&
      filtros.idSeccion &&
      filtros.idPrograma &&
      filtros.mes &&
      filtros.idSemana &&
      idAnioEscolar,
  )

  /**
   * Quién escribe lo dice el servidor en `escritura.permitida` —cubre el rol,
   * la habilitación y el permiso excepcional—, y la actividad abierta se
   * comprueba aquí porque es del cliente.
   */
  const escritura = tabla?.escritura ?? porCrear?.escritura ?? null
  const puedeEscribir = Boolean(escritura?.permitida) && puedeEditar && conActividad
  const soloLectura = !puedeEscribir

  const guardar = (fila, cambios) =>
    guardarFila({ idAlumno: fila.id_alumno, cambios, version: fila.version })

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Seguimiento de Lectura</h1>
        <p className="mt-1 text-sm text-ink-500">
          Una tabla por grupo, subprograma y semana, atada a la clase en la que se tomó la lectura.
        </p>
      </header>

      {puedeEditar && !conActividad && <AvisoActividades />}
      {/* El servidor dice POR QUÉ no se puede escribir. Si la actividad ya se
          avisó arriba no se repite: es el mismo motivo dicho dos veces. */}
      {escritura?.permitida === false && escritura.motivo && conActividad && (
        <AvisoActividades mensaje={escritura.motivo} />
      )}
      {escritura?.permitida && escritura.aviso_permiso && <AvisoActividades mensaje={escritura.aviso_permiso} />}
      {soloLectura && conActividad && escritura?.permitida && <AvisoModoConsulta />}

      {/* El MES va antes que la semana: las semanas que se ofrecen son las que
          tienen clase de este grupo en ese mes, y no las del año entero. */}
      <FilterBar>
        <Select
          label="Colegio"
          value={filtros.idColegio}
          onChange={(e) => cambiar('colegio', e.target.value)}
          options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
        />
        <Select
          label="Grado"
          value={filtros.idGrado}
          onChange={(e) => cambiar('grado', e.target.value)}
          options={grados.map((g) => ({ value: g.id_grado, label: g.nombre ?? `${g.id_grado}.° grado` }))}
        />
        <Select
          label="Sección"
          value={filtros.idSeccion}
          placeholder="Seleccione"
          onChange={(e) => cambiar('seccion', e.target.value)}
          options={secciones.map((s) => ({ value: s.id, label: s.nombre }))}
        />
        <Select
          label="Subprograma"
          value={filtros.idPrograma}
          placeholder="Seleccione"
          onChange={(e) => cambiar('subprograma', e.target.value)}
          options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
        />
        <Select
          label="Mes"
          value={filtros.mes}
          onChange={(e) => cambiar('mes', e.target.value)}
          options={MESES}
        />
        <Select
          label="Semana"
          value={filtros.idSemana}
          placeholder={semanas.length ? 'Seleccione' : 'Sin clases este mes'}
          onChange={(e) => cambiar('semana', e.target.value)}
          options={semanas.map((s) => ({ value: s.id_semana, label: etiquetaDeSemanaDeGrupo(s) }))}
        />
      </FilterBar>

      {!listos && (
        <Card>
          <EmptyState
            title="Complete los filtros"
            description="La tabla se arma con colegio, grado, sección, subprograma, mes y semana."
          />
        </Card>
      )}

      {/* Una semana SIN CLASES del grupo no tiene tabla ni obligación: no es un
          hueco que el docente tenga que rellenar. */}
      {!listos && filtros.idSeccion && semanas.length === 0 && (
        <Card>
          <EmptyState
            title="Sin clases este mes"
            description="Este grupo no tiene clases en el mes seleccionado, así que no hay lectura que registrar."
          />
        </Card>
      )}

      {/*
        ESTE ES EL ESTADO QUE ANTES SE VEÍA COMO UN ERROR. La tabla no existe
        todavía, y crearla es lo único que se puede hacer aquí. Se dice a qué
        clase quedará atada porque crearla CONGELA la lista de alumnos de esa
        clase: no es un detalle, es la consecuencia.
      */}
      {listos && porCrear && !cargando && (
        <Card>
          <EmptyState
            icon={BookOpenCheck}
            title="Esta semana aún no tiene tabla de lectura"
            description={
              porCrear.claseSugerida
                ? `Se creará sobre la clase del ${comoFecha(porCrear.claseSugerida.fecha)}, con los alumnos que estaban en ella ese día.`
                : 'La semana no tiene una clase programada: hace falta elegir la clase de referencia para poder crearla.'
            }
            action={
              puedeEscribir && porCrear.claseSugerida ? (
                <Button iconLeft={CalendarPlus} loading={creando} onClick={() => crear({})}>
                  Crear la tabla de esta semana
                </Button>
              ) : null
            }
          />
        </Card>
      )}

      {listos && error && (
        <Card>
          <EmptyState title="No se pudo cargar la tabla" description={mensajeDeError(error)} />
        </Card>
      )}

      {listos && tabla && (
        <TablaLectura
          tabla={tabla}
          soloLectura={soloLectura}
          marcando={marcando}
          onGuardarFila={guardar}
          onObservar={setObservando}
          onNoRealizada={() => setJustificando(true)}
        />
      )}

      <ModalObservacionLectura
        fila={observando}
        soloLectura={soloLectura || tabla?.estado === 'no_realizada'}
        onGuardar={(texto) => {
          const fila = observando
          setObservando(null)
          guardar(fila, { observacion: texto || null })
        }}
        onCerrar={() => setObservando(null)}
      />

      <ModalNoRealizada
        open={justificando}
        guardando={marcando}
        onGuardar={(motivo) => {
          setJustificando(false)
          marcarNoRealizada(motivo)
        }}
        onCerrar={() => setJustificando(false)}
      />
    </div>
  )
}
