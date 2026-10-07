// T32 — "No existe una grilla registrada para esta semana".
//
// La grilla no se genera sola ni se copia de la semana anterior: eso daría por
// evaluado a un alumno que nadie miró. El docente la crea a propósito, y nace
// con las filas vacías.
import { CalendarPlus } from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'

export default function SinGrillaSemanal({ puedeCrear, creando, onCrear }) {
  return (
    <Card padded={false}>
      <EmptyState
        icon={CalendarPlus}
        title="No existe una grilla registrada para esta semana"
        description="Se creará con una fila por estudiante y los campos vacíos. No se copian datos de otras semanas."
        action={
          puedeCrear ? (
            <Button loading={creando} onClick={onCrear}>
              Crear grilla para esta semana
            </Button>
          ) : null
        }
      />
    </Card>
  )
}
