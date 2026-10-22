// Cabecera de filtros de Asistencia (CU022, paso 3).
//
// Los filtros son obligatorios y el orden no es casual: cada uno acota al
// siguiente. La FECHA lleva `max` en hoy —según el reloj del servidor— porque
// CU022 prohíbe registrar en el futuro; las fechas pasadas del periodo sí se
// pueden consultar.
//
// LA SECCIÓN VUELVE A ELEGIRSE, y esta vez de verdad. Pasó por tres formas en
// tres semanas, y conviene saber por qué: era un atributo del colegio
// ("Única") que el alumno heredaba, se quitó al ver que no estaba en el
// contrato de entonces —el desplegable nacía vacío y bloqueaba la pantalla—, y
// con T3 volvió como ENTIDAD POR GRADO. Ahora un grado puede tener varias y
// `GET /asistencias` recibe `id_seccion`: la clase es colegio × grado ×
// sección, sin subprograma, porque el subprograma es del alumno.
//
// Con una sola sección se elige sola y no hay nada que decidir, que es el caso
// corriente; con varias hay que escoger, porque son clases distintas.
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
  secciones,
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
        label="Sección"
        value={filtros.idSeccion}
        placeholder={secciones.length > 1 ? 'Seleccione' : ''}
        onChange={(e) => cambiar('seccion', e.target.value)}
        options={secciones.map((x) => ({ value: String(x.id), label: x.nombre }))}
      />
      {/* VISUAL: delimita a quién se ve, sin cambiar la clase ni perder lo
          marcado. Por eso su valor por defecto es "Todos": una clase reúne a
          los alumnos de los dos subprogramas que haya en esa aula. */}
      <Select
        label="Subprograma"
        placeholder="Todos"
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
