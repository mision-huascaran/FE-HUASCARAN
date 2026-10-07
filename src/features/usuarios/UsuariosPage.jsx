// Cubre: RF-002, RN-001 · Módulo Usuarios del Supervisor.
//
// D1: el alumno NO es un usuario —no inicia sesión—, pero el Supervisor lo da
// de alta desde aquí, así que vive como una pestaña dentro de Usuarios en vez
// de como una sección propia del menú.
import { useState } from 'react'
import Tabs from '../../components/ui/Tabs'
import MantenimientoAlumnos from '../alumnos/MantenimientoAlumnos'
import MantenimientoUsuarios from './MantenimientoUsuarios'

const PESTANAS = [
  { value: 'cuentas', label: 'Cuentas' },
  { value: 'alumnos', label: 'Alumnos' },
]

export default function UsuariosPage() {
  const [pestana, setPestana] = useState('cuentas')

  return (
    <div className="flex flex-col gap-5">
      <Tabs value={pestana} onChange={setPestana} items={PESTANAS} />
      {pestana === 'cuentas' ? <MantenimientoUsuarios /> : <MantenimientoAlumnos />}
    </div>
  )
}
