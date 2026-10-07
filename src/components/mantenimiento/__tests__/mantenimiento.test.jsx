// Plantilla de mantenimiento: un solo CU base para Alumnos, Usuarios y Colegios.
//
// Se comprueban los subflujos de la plantilla (S1 Nuevo, S2 Editar,
// S3 Visualizar, S4 Inactivar) y las reglas transversales: Estado = Activo por
// defecto y que nunca se ofrezca borrar.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { crearQueryClient } from '../../../App'
import { ToastProvider } from '../../ui'
import Mantenimiento from '../Mantenimiento'
import useSessionStore from '../../../store/sessionStore'
import { ROLES } from '../../../auth/roles'

const FILAS = [
  { id_colegio: 1, nombre: 'I.E. 86021 Ranrahirca', zona: 'Yungay', activo: true },
  { id_colegio: 2, nombre: 'I.E. 86024 Mancos', zona: 'Yungay', activo: false },
]

const CAMPOS = [
  { nombre: 'nombre', etiqueta: 'Nombre del colegio', requerido: true },
  { nombre: 'zona', etiqueta: 'Ubicación', requerido: true },
]

function montar(idRol = ROLES.SUPERVISOR, props = {}) {
  useSessionStore.setState({
    token: 'mock.4.2026',
    usuario: { id_usuario: 4, id_rol: idRol, id_docente: null, nombre_completo: 'Prueba' },
    cargando: false,
  })
  const onGuardar = vi.fn()
  const onCambiarEstado = vi.fn()
  const onFiltro = vi.fn()
  render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <Mantenimiento
          seccion="colegios"
          entidad="colegio"
          titulo="Colegios"
          consulta={{ data: FILAS, isLoading: false, isError: false }}
          campos={CAMPOS}
          columnas={[{ key: 'nombre', header: 'Colegio' }, { key: 'zona', header: 'Ubicación' }]}
          valoresFiltro={{ estado: 'activo' }}
          onFiltro={onFiltro}
          onGuardar={onGuardar}
          onCambiarEstado={onCambiarEstado}
          {...props}
        />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onGuardar, onCambiarEstado, onFiltro }
}

describe('Plantilla de mantenimiento', () => {
  it('abre filtrada por Estado = Activo (regla transversal)', () => {
    montar()
    expect(screen.getByLabelText('Estado')).toHaveValue('activo')
  })

  it('nunca ofrece borrar: solo inactivar, y pide confirmación (S4)', () => {
    const { onCambiarEstado } = montar()
    expect(screen.queryByRole('button', { name: /eliminar|borrar/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^inactivar I\.E\. 86021/i }))

    // No se cambia el estado hasta confirmar.
    expect(onCambiarEstado).not.toHaveBeenCalled()
    const dialogo = screen.getByRole('dialog')
    // El aviso deja claro que el registro se conserva.
    expect(within(dialogo).getByText(/No se borra nada/i)).toBeInTheDocument()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Inactivar' }))
    expect(onCambiarEstado).toHaveBeenCalledWith(FILAS[0], false)
  })

  it('cancelar la confirmación deja el registro como estaba', () => {
    const { onCambiarEstado } = montar()
    fireEvent.click(screen.getByRole('button', { name: /^inactivar I\.E\. 86021/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    expect(onCambiarEstado).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un registro inactivo ofrece reactivarse', () => {
    const { onCambiarEstado } = montar()
    fireEvent.click(screen.getByRole('button', { name: /^activar I\.E\. 86024/i }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Activar' }))

    expect(onCambiarEstado).toHaveBeenCalledWith(FILAS[1], true)
  })

  it('S1 — Nuevo abre el popup vacío y exige los obligatorios', () => {
    const { onGuardar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo' }))

    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByLabelText(/Nombre del colegio/)).toHaveValue('')

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(onGuardar).not.toHaveBeenCalled()
    expect(within(dialogo).getAllByText('Este campo es obligatorio').length).toBe(2)
  })

  it('S2 — Editar abre el MISMO popup con los datos cargados', () => {
    const { onGuardar } = montar()
    fireEvent.click(screen.getByRole('button', { name: /^editar I\.E\. 86021/i }))

    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByLabelText(/Nombre del colegio/)).toHaveValue('I.E. 86021 Ranrahirca')

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    expect(onGuardar).toHaveBeenCalled()
  })

  it('S3 — Visualizar bloquea todos los campos y no deja guardar', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: /^visualizar I\.E\. 86021/i }))

    const dialogo = screen.getByRole('dialog')
    within(dialogo).getAllByRole('textbox').forEach((c) => expect(c).toBeDisabled())
    expect(within(dialogo).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  })

  it('sin permiso de alta en la matriz no aparece el botón Nuevo', () => {
    // El Docente no entra en Colegios: la matriz no le da ninguna acción.
    montar(ROLES.DOCENTE)
    expect(screen.queryByRole('button', { name: 'Nuevo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^editar /i })).not.toBeInTheDocument()
  })

  it('sin conexión, una sección solo-online muestra "Requiere conexión"', () => {
    montar(ROLES.SUPERVISOR, { soloOnline: true, sinConexion: true })
    expect(screen.getByText('Requiere conexión')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
