// Cubre: sistema de diseño §4 (no cubre RF/RN de negocio).
// Catálogo visual de los componentes base. Solo se monta en desarrollo.
import { useState } from 'react'
import {
  Badge,
  Button,
  Drawer,
  Input,
  Logo,
  Modal,
  Select,
  SyncBadge,
  Tabs,
} from '../../components/ui'
import DemoControles from './DemoControles'
import DemoDatos from './DemoDatos'
import { NIVELES } from './datosDemo'
import { MarcaCard, PaletaTab, TipografiaTab } from './SeccionesUiKit'

export default function UiKitPage() {
  const [tab, setTab] = useState('componentes')
  const [modal, setModal] = useState(false)
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="sticky top-0 z-30 border-b border-line bg-navy-900 px-5 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Logo tone="light" />
          <div className="flex items-center gap-3">
            <SyncBadge pendientes={0} />
            <Badge tone="info">Solo desarrollo</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5">
        <h1 className="text-2xl font-bold text-ink-900 md:text-3xl">Sistema de diseño</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Catálogo de los componentes base de SICEDU. Todo color, radio y espaciado sale de los
          tokens declarados en <code className="rounded bg-surface-100 px-1">tailwind.config.js</code>.
        </p>

        <Tabs
          className="mt-6"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'componentes', label: 'Componentes' },
            { value: 'paleta', label: 'Paleta' },
            { value: 'tipografia', label: 'Tipografía' },
          ]}
        />

        {tab === 'componentes' && (
          <div className="mt-6 flex flex-col gap-5">
            <MarcaCard />

            <DemoControles />

            <DemoDatos setModal={setModal} setDrawer={setDrawer} />
          </div>
        )}

        {tab === 'paleta' && <PaletaTab />}
        {tab === 'tipografia' && <TipografiaTab />}
      </main>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Trazabilidad de la evaluación"
        subtitle="Rosa Meléndez Quispe · Julio"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>Cerrar</Button>
            <Button onClick={() => setModal(false)}>Entendido</Button>
          </>
        }
      >
        <p className="text-sm text-ink-700">
          Contenido de ejemplo. El modal cierra con Escape y con clic fuera.
        </p>
      </Modal>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Editar evaluación"
        subtitle="Rosa Meléndez Quispe · 3.° · I.E. Amauta"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>Cancelar</Button>
            <Button variant="secondary">Guardar borrador</Button>
            <Button onClick={() => setDrawer(false)}>Confirmar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select label="Fluidez lectora" required placeholder="Seleccione" options={NIVELES} />
          <Select label="Comprensión lectora" required placeholder="Seleccione" options={NIVELES} />
          <Input label="Nivel inicial Raz-Kids" value="F" disabled hint="Automático (RN-005)" />
        </div>
      </Drawer>
    </div>
  )
}
