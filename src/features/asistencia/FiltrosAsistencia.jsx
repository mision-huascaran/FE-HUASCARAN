// Cabecera de filtros de Asistencia (CU022, paso 3).
//
// Los cuatro son obligatorios y el orden no es casual: cada uno acota al
// siguiente. La FECHA lleva `max` en hoy —según el reloj del servidor— porque
// CU022 prohíbe registrar en el futuro; las fechas pasadas del periodo sí se
// pueden consultar.
//
// La SECCIÓN se muestra pero no se elige ni se envía. Un colegio tiene una sola
// —"Única" por defecto— y el alumno la hereda, así que no hay nada que decidir:
// `GET /asistencias` recibe colegio, grado, subprograma y fecha, y el alumno
// que devuelve no trae aula. Se deja a la vista porque CU022 la lista entre los
// filtros y porque confirma a qué aula pertenece lo que se está marcando.
import FilterBar from '../../components/ui/FilterBar'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { hoy } from '../../lib/relojServidor'

export default function FiltrosAsistencia({
  filtros,
  cambiar,
  colegios,
  grados,
  programas,
  seccion,
  docentes,
  eligeDocente,
}) {
  const opciones = (lista, clave, etiqueta = 'nombre') =>
    lista.map((x) => ({ value: String(x[clave]), label: x[etiqueta] }))

  return (
    <FilterBar>
      {/* El Supervisor ve la asistencia de todos, así que elige de quién. */}
      {eligeDocente && (
        <Select
          label="Docente"
          value={filtros.idDocente ?? ''}
          placeholder="Todos"
          onChange={(e) => cambiar('docente', e.target.value)}
          options={docentes.map((d) => ({ value: String(d.id_docente), label: d.nombre }))}
        />
      )}
      <Select
        label="Colegio"
        value={filtros.idColegio}
        onChange={(e) => cambiar('colegio', e.target.value)}
        options={opciones(colegios, 'id_colegio')}
      />
      <Select
        label="Grado"
        value={filtros.idGrado}
        onChange={(e) => cambiar('grado', e.target.value)}
        options={opciones(grados, 'id_grado')}
      />
      <Input label="Sección" value={seccion ?? '—'} readOnly disabled />
      <Select
        label="Subprograma"
        value={filtros.idPrograma}
        onChange={(e) => cambiar('subprograma', e.target.value)}
        options={opciones(programas, 'id_programa')}
      />
      <Input
        label="Fecha"
        type="date"
        max={hoy()}
        value={filtros.fecha}
        onChange={(e) => cambiar('fecha', e.target.value)}
      />
    </FilterBar>
  )
}
