// Cabecera de filtros de Asistencia (CU022, paso 3).
//
// Los cuatro son obligatorios y el orden no es casual: cada uno acota al
// siguiente. La FECHA lleva `max` en hoy —según el reloj del servidor— porque
// CU022 prohíbe registrar en el futuro; las fechas pasadas del periodo sí se
// pueden consultar.
//
// Sin SECCIÓN: el contrato no la tiene. `GET /asistencias` recibe colegio,
// grado, subprograma y fecha, y el alumno que devuelve no trae aula.
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
