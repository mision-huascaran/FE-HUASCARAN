// Conecta las escrituras offline de Lectura, Rúbrica y Registro de Vuelo con la
// caché de la aplicación, y guarda esa caché para abrir las pantallas sin red.
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { conectarConsultas } from '../lib/registrosOffline'
import { conectarCacheConsultas } from '../lib/cacheConsultas'
import { propietarioDe } from '../lib/precarga'
import useSessionStore from '../store/sessionStore'

export default function useRegistrosOffline() {
  const cliente = useQueryClient()
  const propietario = useSessionStore((s) => propietarioDe(s.usuario))

  useEffect(() => conectarConsultas(cliente), [cliente])
  useEffect(() => conectarCacheConsultas(cliente, propietario), [cliente, propietario])
}
