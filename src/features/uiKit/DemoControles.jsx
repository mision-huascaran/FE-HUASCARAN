import { useState } from 'react'
import { BookOpen, GraduationCap, Info, TrendingUp, Users } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  Input,
  LevelChip,
  Select,
  StatCard,
  SyncBadge,
  Textarea,
  Tooltip,
  TrendIndicator,
  useToast,
} from '../../components/ui'
import { NIVELES } from './datosDemo'

/** Catálogo /_ui: indicadores, botones, campos y distintivos. */
export default function DemoControles() {
  const toast = useToast()
  const [observacion, setObservacion] = useState('Faltó dos sesiones por lluvia.')

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Mis estudiantes" value="87" hint="2 colegios" />
        <StatCard
          icon={BookOpen}
          label="Reporte de esta semana"
          value="64 / 87"
          trend={{ dir: 'up', label: 'Mejora', value: '+12' }}
        />
        <StatCard icon={GraduationCap} label="Pendientes de rúbrica" value="23" hint="Semana 14" />
        <StatCard icon={TrendingUp} label="Ajustes por revisar" value="5" trend={{ dir: 'down' }} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Botones" subtitle="Variantes y tamaños">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Peligro</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" iconLeft={BookOpen}>Con icono</Button>
            <Button size="sm" loading>Guardando</Button>
            <Button size="sm" disabled>Deshabilitado</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button size="sm" variant="outline" onClick={() => toast.success('Semana guardada', 'Se registraron 87 filas.')}>
              Toast éxito
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.error('No se pudo conectar', 'El envío quedó en la cola local.')}>
              Toast error
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.warning('Faltan dimensiones de rúbrica')}>
              Toast aviso
            </Button>
          </div>
        </Card>

        <Card title="Campos de formulario" subtitle="Etiqueta, ayuda, error y contador">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Correo" type="email" required placeholder="docente@misionhuascaran.org" />
            <Input label="Contraseña" type="password" required hint="Mínimo 8 caracteres" />
            <Select
              label="Fluidez lectora"
              required
              placeholder="Seleccione"
              options={NIVELES}
              error="Ambas dimensiones son obligatorias"
            />
            <Input label="Nivel inicial Raz-Kids" value="F" disabled hint="Automático — no editable" />
            <Textarea
              className="sm:col-span-2"
              label="Observación"
              maxLength={500}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>
        </Card>
      </div>

      <Card title="Distintivos e indicadores" subtitle="Badge, LevelChip y TrendIndicator">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="info">Pendiente</Badge>
          <Badge tone="success">Revisado</Badge>
          <Badge tone="warning">Modificado por docente</Badge>
          <Badge tone="danger">Con error</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {NIVELES.map((n) => (
            <LevelChip key={n} nivel={n} />
          ))}
          <span className="mx-2 h-5 w-px bg-line" />
          {['aa', 'C', 'G', 'M', 'Z2'].map((l, i) => (
            <LevelChip key={l} letra={l} orden={[1, 5, 12, 20, 28][i]} totalNiveles={29} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-4">
          <TrendIndicator dir="up" />
          <TrendIndicator dir="flat" />
          <TrendIndicator dir="down" />
          <TrendIndicator dir="unknown" />
          <Tooltip content="Descriptor oficial del nivel según el ciclo evaluado del estudiante.">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
              <Info className="h-4 w-4" /> Tooltip (pase el cursor)
            </span>
          </Tooltip>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <SyncBadge pendientes={0} />
          <SyncBadge pendientes={3} />
          <SyncBadge pendientes={3} sincronizando />
          <SyncBadge pendientes={7} error />
        </div>
      </Card>
    </>
  )
}
