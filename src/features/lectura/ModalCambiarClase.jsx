// "Cambiar clase" — elegir otra clase de referencia de la semana (CU024, B6).
//
// NO HAY ENDPOINT DE "CLASES CANDIDATAS". La tanda B dice expresamente que no
// se creó y que el front use `GET /colegios/{id}/clases` con el rango de la
// semana, que es el mismo listado de Programación de clases (CU013).
//
// LA SEMANA PUEDE CAER EN DOS MESES y aun así tiene UNA sola tabla. Por eso se
// ofrecen todas las clases del lunes al viernes sin filtrar por mes: si la
// clase elegida es de otro mes, la respuesta trae el `mes` nuevo y la pantalla
// ajusta el filtro.
//
// Y HAY CLASES SIN FILA. Una clase habitual que nadie ha tocado todavía no
// existe como registro, así que no tiene `id_clase`: para esas se manda la
// FECHA. El contrato acepta una u otra, nunca las dos.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Skeleton from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'
import { listarClases, ETIQUETA_PROGRAMACION, estaReprogramada } from '../../api/resources/clases'
import { mensajeDeError } from '../../api/client'

const FECHA = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
const comoFecha = (iso) => (iso ? FECHA.format(new Date(`${iso}T12:00:00`)) : '—')

const etiqueta = (clase) =>
  `${comoFecha(clase.fecha)} · ${estaReprogramada(clase) ? 'Reprogramada' : (ETIQUETA_PROGRAMACION[clase.tipo] ?? 'Habitual')}`

export default function ModalCambiarClase({
  open,
  semana,
  filtros,
  claseActual,
  guardando,
  onConfirmar,
  onCerrar,
}) {
  const [elegida, setElegida] = useState('')

  const consulta = useQuery({
    queryKey: ['clases', 'semana', { ...filtros, desde: semana?.fecha_inicio, hasta: semana?.fecha_fin }],
    queryFn: () =>
      listarClases({
        idColegio: filtros.idColegio,
        idGrado: filtros.idGrado,
        idSeccion: filtros.idSeccion,
        idPrograma: filtros.idPrograma,
        desde: semana.fecha_inicio,
        hasta: semana.fecha_fin,
      }),
    enabled: Boolean(open && semana?.fecha_inicio && semana?.fecha_fin),
  })

  const clases = consulta.data?.items ?? []
  // La que ya está puesta no se ofrece: elegirla no cambiaría nada y el
  // servidor la rechazaría por fecha sin cambio.
  const candidatas = clases.filter((c) => c.fecha !== claseActual?.fecha)

  const confirmar = () => {
    const clase = candidatas.find((c) => c.fecha === elegida)
    if (!clase) return
    // Con `id_clase` se manda el id; sin él, la fecha. Nunca los dos.
    onConfirmar(clase.id_clase ? { idClase: clase.id_clase } : { fecha: clase.fecha })
  }

  return (
    <Modal
      open={open}
      onClose={guardando ? () => {} : onCerrar}
      cierreExterior={false}
      title="Cambiar la clase de referencia"
      subtitle="Las filas se rehacen con la lista de la clase elegida."
      size="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button loading={guardando} disabled={!elegida || guardando} onClick={confirmar}>
            Cambiar clase
          </Button>
        </>
      }
    >
      {consulta.isLoading && <Skeleton className="h-20 w-full" />}

      {consulta.isError && (
        <EmptyState title="No se pudieron cargar las clases" description={mensajeDeError(consulta.error)} />
      )}

      {!consulta.isLoading && !consulta.isError && candidatas.length === 0 && (
        <EmptyState
          title="No hay otra clase esta semana"
          description="El grupo solo tiene la clase que ya está puesta como referencia."
        />
      )}

      {candidatas.length > 0 && (
        <Select
          label="Clase de la semana"
          placeholder="Seleccione"
          value={elegida}
          onChange={(e) => setElegida(e.target.value)}
          options={candidatas.map((c) => ({ value: c.fecha, label: etiqueta(c) }))}
          hint="Se ofrecen todas las clases de la semana, aunque caigan en otro mes."
        />
      )}
    </Modal>
  )
}
