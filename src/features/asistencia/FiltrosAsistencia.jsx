// Cabecera de filtros de Asistencia (CU022, paso 3).
//
// Los cinco son obligatorios y el orden no es casual: cada uno acota al
// siguiente. La FECHA lleva `max` en hoy —según el reloj del servidor— porque
// CU022 prohíbe registrar en el futuro; las fechas pasadas del periodo sí se
// pueden consultar.
//
// La SECCIÓN se rellena sola cuando el colegio y el grado solo tienen una. Con
// más de una queda vacía a propósito, esperando que el docente elija: adivinar
// el aula haría registrar la asistencia de la clase equivocada.
import FilterBar from '../../components/ui/FilterBar'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { hoy } from '../../lib/relojServidor'

export default function FiltrosAsistencia({
  filtros,
  cambiar,
  colegios,
  grados,
  secciones,
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
        label="Sección"
        value={filtros.seccion}
        placeholder={secciones.length > 1 ? 'Seleccione' : ''}
        onChange={(e) => cambiar('seccion', e.target.value)}
        options={secciones.map((s) => ({ value: s, label: s }))}
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
