// Tarjeta de Asistencias: el porcentaje del periodo y su curva mensual.
//
// De las ocho cifras que tenía el bloque anterior (presentes, tardanzas,
// ausentes, sin marcar, clases dictadas, incompletas, sin registro y
// asistencias completadas) queda UNA en pantalla: el porcentaje. El resto no
// se pierde, está en el propio módulo de Asistencias, que es donde se actúa
// sobre ello; aquí solo había que saber si hay que ir.
//
// LA FÓRMULA SIGUE IMPORTANDO aunque ya no se escriba: la tardanza cuenta como
// asistencia y una asistencia sin marcar NO es una ausencia. El porcentaje lo
// calcula el servidor sobre el conjunto; aquí no se suma ni se promedia nada.
import { useQuery } from '@tanstack/react-query'
import { obtenerAsistenciaDashboard } from '../../api/resources/dashboard'
import TarjetaModulo from './TarjetaModulo'
import Grafica from './graficas/Grafica'
import GraficaLineas from './graficas/GraficaLineas'
import { enlaceDeModulo, tituloDeModulo } from './enlacesDeModulo'
import { etiquetaDeEstado, formatearPorcentaje, sinInformacion } from './estados'

const FORMULA =
  'Presentes y tardanzas sobre presentes, tardanzas y ausentes. La tardanza cuenta como asistencia; una asistencia sin marcar no es una ausencia y queda fuera del cálculo.'

export default function TarjetaAsistencia({ filtros, contexto, hayCambios, idRol, anioEscolar }) {
  const consulta = useQuery({
    queryKey: ['dashboard', 'asistencia', filtros],
    queryFn: () => obtenerAsistenciaDashboard(filtros),
    enabled: Boolean(filtros),
  })

  const resumen = consulta.data?.resumen
  const mensual = consulta.data?.mensual ?? []
  const titulo = tituloDeModulo('asistencia')

  return (
    <TarjetaModulo
      titulo={titulo}
      contexto={contexto}
      consulta={consulta}
      hayCambios={hayCambios}
      vacio={Boolean(consulta.data) && sinInformacion(resumen, 'porcentaje')}
      cifra={formatearPorcentaje(resumen?.porcentaje)}
      etiqueta="de asistencia"
      detalle={FORMULA}
      aviso={etiquetaDeEstado(resumen)}
      enlace={enlaceDeModulo('asistencia', { idRol, filtros })}
      sinInformacion={consulta.data?.colegios_sin_informacion ?? []}
    >
      {/*
        `tituloVisible={false}`: el título del bloque ya dice de qué es la
        gráfica. Se conserva para el lector de pantalla y para el PNG, que se
        descarga suelto y ahí sí necesita decir qué muestra.
      */}
      <Grafica
        titulo={`${titulo} por mes`}
        tituloVisible={false}
        contexto={contexto}
        anioEscolar={anioEscolar}
        hayDatos={mensual.some((m) => !sinInformacion(m, 'porcentaje'))}
      >
        <GraficaLineas datos={mensual} campo="porcentaje" maximo={100} />
      </Grafica>
    </TarjetaModulo>
  )
}
