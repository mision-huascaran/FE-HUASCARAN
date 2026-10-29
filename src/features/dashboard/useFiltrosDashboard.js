// Los filtros del dashboard: año escolar, periodo académico y colegios.
//
// Tiene más reglas de las que parece, y todas salen del flujo básico de CU033 y
// CU035. Las cuatro que condicionan el diseño:
//
//  1. HAY DOS ESTADOS, NO UNO: lo que se está eligiendo (`borrador`) y lo que
//     de verdad se consultó (`aplicados`). Mientras no se pulse "Aplicar", los
//     resultados conservan el contexto de SU consulta y la pantalla avisa
//     "Cambios sin aplicar". Un dashboard que se recarga a cada clic enseña
//     resultados intermedios que nadie pidió y, peor, los enseña bajo el
//     título de la selección nueva.
//  2. LA CARGA INICIAL SÍ ES AUTOMÁTICA, pero solo "cuando las selecciones
//     iniciales están completas y son válidas".
//  3. SE RESTAURA LA SELECCIÓN ANTERIOR, y si no hay, se usa la que calcula el
//     servidor (`seleccion_inicial`). Si el servidor no pudo determinarla
//     —hoy no cae en ningún PA ni PR—, los filtros se quedan vacíos y se pide
//     completarlos: el CU prohíbe elegir "un calendario por aproximación".
//  4. UNA SELECCIÓN VACÍA DE COLEGIOS NO ES "TODOS". Deshabilita "Aplicar".
//
// Y una que no es del flujo básico sino del alternativo de alcance: si el
// Supervisor pierde la autorización sobre un colegio que tenía elegido, ese
// colegio se retira de la selección y hay que decirlo, no consultar en silencio
// con menos colegios de los que la persona cree.
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerFiltrosDashboard, filtrosCompletos } from '../../api/resources/dashboard'
import useFiltrosGuardados from '../../hooks/useFiltrosGuardados'

export const SIN_FILTROS = {
  idAnioEscolar: '',
  idPeriodoAcademico: '',
  todosLosColegios: true,
  idColegios: [],
}

export const ALCANCE_CAMBIO = 'Tu acceso a los colegios ha cambiado. Revisa la selección para continuar.'

/** ¿Siguen siendo válidos unos filtros guardados con los permisos de hoy? */
export function vigentes(filtros, { colegios = [], anios = [] } = {}) {
  if (!filtros?.idAnioEscolar) return false
  const anio = anios.find((a) => String(a.id_anio_escolar) === String(filtros.idAnioEscolar))
  if (!anio) return false
  if (filtros.idPeriodoAcademico) {
    const existe = (anio.periodos ?? []).some(
      (p) => String(p.id_periodo_academico) === String(filtros.idPeriodoAcademico),
    )
    if (!existe) return false
  }
  if (filtros.todosLosColegios) return true
  const autorizados = new Set(colegios.map((c) => String(c.id_colegio)))
  return (
    (filtros.idColegios?.length ?? 0) > 0 && filtros.idColegios.every((id) => autorizados.has(String(id)))
  )
}

/** Quita de la selección los colegios que ya no están autorizados. */
const recortar = (filtros, colegios) => {
  const autorizados = new Set(colegios.map((c) => String(c.id_colegio)))
  return { ...filtros, idColegios: (filtros.idColegios ?? []).filter((id) => autorizados.has(String(id))) }
}

/** Los ids de una selección en un orden fijo, para compararla por valor. */
const conjunto = (ids) =>
  (ids ?? [])
    .map(String)
    .sort((x, y) => x.localeCompare(y))
    .join(',')

/** Mismos filtros, comparados por valor: el array de colegios no vale por referencia. */
const iguales = (a, b) =>
  String(a.idAnioEscolar) === String(b.idAnioEscolar) &&
  String(a.idPeriodoAcademico) === String(b.idPeriodoAcademico) &&
  Boolean(a.todosLosColegios) === Boolean(b.todosLosColegios) &&
  conjunto(a.idColegios) === conjunto(b.idColegios)

export default function useFiltrosDashboard({ clave = 'dashboard', exigePeriodo = true } = {}) {
  const catalogo = useQuery({
    queryKey: ['dashboard', 'filtros'],
    queryFn: obtenerFiltrosDashboard,
    // El alcance autorizado y los calendarios no cambian dentro de una
    // consulta, pero sí pueden cambiar en una sesión larga: se revalida al
    // montar la pantalla, no cada vez que se pulsa "Aplicar".
    staleTime: 5 * 60 * 1000,
  })

  // Memorizados porque el `?? []` crea un array NUEVO en cada render, y de
  // ellos dependen los memos de abajo: sin esto se recalculan siempre.
  const colegios = useMemo(() => catalogo.data?.colegios ?? [], [catalogo.data])
  const anios = useMemo(() => catalogo.data?.anios ?? [], [catalogo.data])

  const [guardados, setGuardados] = useFiltrosGuardados(clave, SIN_FILTROS)
  const [borrador, setBorrador] = useState(guardados)
  const [aplicados, setAplicados] = useState(null)
  const [avisoAlcance, setAvisoAlcance] = useState(null)

  /**
   * La primera consulta: restaurar, o la del servidor, o ninguna.
   *
   * Se ejecuta una sola vez por catálogo recibido. Si lo guardado dejó de ser
   * válido se recorta y NO se aplica: hace falta que la persona revise.
   */
  useEffect(() => {
    if (!catalogo.data || aplicados) return

    if (vigentes(guardados, { colegios, anios })) {
      setBorrador(guardados)
      setAplicados(guardados)
      return
    }

    const recortados = recortar(guardados, colegios)
    const perdioColegios =
      (guardados.idColegios?.length ?? 0) > 0 && recortados.idColegios.length !== guardados.idColegios.length
    if (perdioColegios) {
      setAvisoAlcance(ALCANCE_CAMBIO)
      setBorrador(recortados)
      return
    }

    const inicial = catalogo.data.seleccion_inicial
    if (!inicial) {
      // El servidor no pudo determinar una selección. No se aproxima nada.
      setBorrador(SIN_FILTROS)
      return
    }

    const desdeServidor = {
      idAnioEscolar: String(inicial.id_anio_escolar ?? ''),
      idPeriodoAcademico: String(inicial.id_periodo_academico ?? ''),
      todosLosColegios: inicial.todos_los_colegios !== false,
      idColegios: (inicial.id_colegios ?? []).map(String),
    }
    setBorrador(desdeServidor)
    if (filtrosCompletos(desdeServidor, { exigePeriodo })) {
      setGuardados(desdeServidor)
      setAplicados(desdeServidor)
    }
    // `guardados` y `setGuardados` quedan fuera a propósito: este efecto es la
    // carga inicial y volver a entrar al guardar se comería la elección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo.data])

  const periodos = useMemo(
    () => anios.find((a) => String(a.id_anio_escolar) === String(borrador.idAnioEscolar))?.periodos ?? [],
    [anios, borrador.idAnioEscolar],
  )

  const cambiar = (campo, valor) =>
    setBorrador((previo) => {
      const siguiente = { ...previo, [campo]: valor }
      // Cambiar de año invalida el periodo: los PA son de un año concreto y
      // mandar el de otro es un 422.
      if (campo === 'idAnioEscolar') siguiente.idPeriodoAcademico = ''
      // Marcar "Todos los colegios" y dejar además una lista es un 422.
      if (campo === 'todosLosColegios' && valor) siguiente.idColegios = []
      if (campo === 'idColegios' && valor.length) siguiente.todosLosColegios = false
      return siguiente
    })

  const completos = filtrosCompletos(borrador, { exigePeriodo })
  const hayCambios = Boolean(aplicados) && !iguales(borrador, aplicados)

  const aplicar = () => {
    if (!completos) return
    setAvisoAlcance(null)
    setGuardados(borrador)
    setAplicados(borrador)
  }

  return {
    catalogo,
    colegios,
    anios,
    periodos,
    borrador,
    aplicados,
    cambiar,
    aplicar,
    completos,
    hayCambios,
    avisoAlcance,
    /** El periodo de la consulta MOSTRADA, para los títulos de los bloques. */
    periodoAplicado:
      anios
        .find((a) => String(a.id_anio_escolar) === String(aplicados?.idAnioEscolar))
        ?.periodos?.find((p) => String(p.id_periodo_academico) === String(aplicados?.idPeriodoAcademico)) ?? null,
    anioAplicado: anios.find((a) => String(a.id_anio_escolar) === String(aplicados?.idAnioEscolar)) ?? null,
    /** Fija los filtros desde fuera: así CU034 recibe los de CU033. */
    heredar: (filtros) => {
      setBorrador(filtros)
      if (filtrosCompletos(filtros, { exigePeriodo })) setAplicados(filtros)
    },
  }
}
