// Los cuatro filtros del GRUPO —colegio, grado, sección y subprograma— que
// comparten Seguimiento de Lectura, Rúbrica y Registro de Vuelo
// (`useFiltrosDeGrupo`).
//
// Es una FUNCIÓN que devuelve los `Select`, no un componente: `FilterBar`
// resume en el celular lo que está filtrado leyendo las props de sus hijos
// directos (`resumenDeFiltros`), y un componente envolvente los escondería.
import Select from '../ui/Select'
import { marcadorDeColegio } from '../../hooks/useFiltrosDeGrupo'

export default function selectsDelGrupo({ filtros, cambiar, colegios, grados, secciones, programas, esDocente }) {
  return [
    <Select
      key="colegio"
      ancho="largo"
      label="Colegio"
      value={filtros.idColegio}
      placeholder={marcadorDeColegio(esDocente)}
      onChange={(e) => cambiar('colegio', e.target.value)}
      options={colegios.map((c) => ({ value: c.id_colegio, label: c.nombre }))}
    />,
    <Select
      key="grado"
      label="Grado"
      value={filtros.idGrado}
      // Sin colegio no hay de dónde sacar los grados: un desplegable
      // vacío sin decir por qué parecía roto (D63/variante Supervisor).
      placeholder="Selecciona"
      pendienteDe={!filtros.idColegio && 'colegio'}
      onChange={(e) => cambiar('grado', e.target.value)}
      options={grados.map((g) => ({ value: g.id_grado, label: g.nombre ?? `${g.id_grado}.° grado` }))}
    />,
    <Select
      key="seccion"
      label="Sección"
      value={filtros.idSeccion}
      placeholder="Selecciona"
      pendienteDe={!filtros.idGrado && 'grado'}
      onChange={(e) => cambiar('seccion', e.target.value)}
      options={secciones.map((s) => ({ value: s.id, label: s.nombre }))}
    />,
    <Select
      key="subprograma"
      ancho="largo"
      label="Subprograma"
      value={filtros.idPrograma}
      placeholder="Selecciona"
      // Los subprogramas los dice el colegio.
      pendienteDe={!filtros.idColegio && 'colegio'}
      onChange={(e) => cambiar('subprograma', e.target.value)}
      options={programas.map((p) => ({ value: p.id_programa, label: p.nombre }))}
    />,
  ]
}
