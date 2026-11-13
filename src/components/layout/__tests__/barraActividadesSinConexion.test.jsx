// Sin conexión, el aviso de la barra dice solo eso: los pendientes ya los cuenta
// el indicador de sincronización.
import { afterEach, describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import BarraActividades from '../BarraActividades'
import useSyncStore from '../../../store/syncStore'
import { ROLES } from '../../../auth/roles'
import { renderConProveedores } from '../../../test/renderConProveedores'

const fijarRed = (valor) => Object.defineProperty(window.navigator, 'onLine', { value: valor, configurable: true })

afterEach(() => fijarRed(true))

describe('Aviso de sin conexión en la barra', () => {
  it('dice solo "Sin conexión", sin repetir cuántos pendientes hay', async () => {
    useSyncStore.setState({ pendientes: 1 })
    renderConProveedores(<BarraActividades />, { rol: ROLES.DOCENTE })
    act(() => {
      fijarRed(false)
      window.dispatchEvent(new Event('offline'))
    })
    const aviso = await screen.findByText('Sin conexión')
    expect(aviso.textContent).toBe('Sin conexión')
    expect(screen.queryByText(/1 pendiente/)).not.toBeInTheDocument()
  })
})
