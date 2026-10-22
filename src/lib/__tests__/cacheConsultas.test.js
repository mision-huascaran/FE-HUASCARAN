// La caché de las pantallas de registro, copiada a IndexedDB para abrirlas sin
// conexión (RNF-001). jsdom no trae IndexedDB: se sustituye por un mapa.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { borrarCacheConsultas, conectarCacheConsultas as conectarReal } from '../cacheConsultas'

const almacen = new Map()
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (clave) => almacen.get(clave)),
  set: vi.fn(async (clave, valor) => void almacen.set(clave, valor)),
  del: vi.fn(async (clave) => void almacen.delete(clave)),
}))

const esperarEscritura = () => new Promise((listo) => setTimeout(listo, 350))
const CLAVE_TABLA = ['lectura', 'tabla', { idSemana: 23 }]

// Cada cliente se desconecta al terminar: si no, su escritura diferida caería
// en el test siguiente.
let conectados = []
const conectarCacheConsultas = (cliente, propietario) => {
  const desconectar = conectarReal(cliente, propietario)
  conectados.push(desconectar)
  return desconectar
}

afterEach(() => {
  conectados.forEach((desconectar) => desconectar())
  conectados = []
  almacen.clear()
})

describe('cacheConsultas', () => {
  it('guarda la última respuesta de Lectura y la vuelca al volver a entrar, del mismo usuario', async () => {
    const antes = new QueryClient()
    const desconectar = conectarCacheConsultas(antes, 4)
    antes.setQueryData(CLAVE_TABLA, { id: 7, filas: [{ id_alumno: 5, cantidad_lsl: 3 }] })
    await esperarEscritura()
    desconectar()

    const despues = new QueryClient()
    conectarCacheConsultas(despues, 4)
    await vi.waitFor(() => expect(despues.getQueryData(CLAVE_TABLA)).toEqual({ id: 7, filas: [{ id_alumno: 5, cantidad_lsl: 3 }] }))
  })

  it('no guarda consultas que no son de las pantallas de registro', async () => {
    const cliente = new QueryClient()
    conectarCacheConsultas(cliente, 4)
    cliente.setQueryData(['usuarios', 'lista'], [{ id: 1 }])
    await esperarEscritura()
    expect(almacen.size).toBe(0)
  })

  it('la copia de otro usuario no se vuelca nunca', async () => {
    const del4 = new QueryClient()
    conectarCacheConsultas(del4, 4)
    del4.setQueryData(CLAVE_TABLA, { id: 7 })
    await esperarEscritura()

    const del9 = new QueryClient()
    conectarCacheConsultas(del9, 9)
    await new Promise((listo) => setTimeout(listo, 20))
    expect(del9.getQueryData(CLAVE_TABLA)).toBeUndefined()
  })

  it('se borra al cerrar sesión', async () => {
    const cliente = new QueryClient()
    conectarCacheConsultas(cliente, 4)
    cliente.setQueryData(CLAVE_TABLA, { id: 7 })
    await esperarEscritura()
    await borrarCacheConsultas()
    expect(almacen.size).toBe(0)
  })
})
