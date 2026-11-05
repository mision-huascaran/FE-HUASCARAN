// CU021 — Bitácora de un docente, vista por el Supervisor.
//
// Sin pestañas a propósito: el caso de uso pide la cabecera y, justo debajo,
// la tabla de sesiones de la más reciente a la más antigua.
//
// Los ATAJOS abren lo que ESA JORNADA tocó, en solo lectura.
//
// Antes no llevaban a ninguna parte: tres estaban deshabilitados porque sus
// módulos no existían, y "Ver Asistencias" navegaba al módulo con la FECHA de
// la sesión. Eso último casi funcionaba, pero mentía: dos actividades del mismo
// día tocaron cosas distintas y el filtro por fecha las mezclaba.
//
// Desde la tanda 10 hay un endpoint que responde desde la AUDITORÍA de la
// actividad, así que el atajo enseña lo que esta persona hizo en esta sesión,
// que es la pregunta de CU021, y no lo que pasó ese día.
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, History } from 'lucide-react'
import CeldaCierre from '../../components/actividades/CeldaCierre'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import DataTable from '../../components/ui/DataTable'
import EmptyState from '../../components/ui/EmptyState'
import RegistrosDeActividad from './RegistrosDeActividad'
import { MODULOS_DE_ACTIVIDAD, listarActividadesDe } from '../../api/resources/seguimiento'
import {
  AYUDA_SINCRONIZACION,
  ETIQUETA_SINCRONIZACION,
  TONO_SINCRONIZACION,
} from '../../api/resources/actividades'
import { mensajeDeError } from '../../api/client'
import { formatearFecha, formatearFechaHora } from '../../lib/format'
import { useMigaExtra } from '../../store/migaStore'

/**
 * El nombre del módulo que usa el endpoint de registros, a partir del que
 * nombra la productividad.
 *
 * La productividad dice `asistencia` en singular en `cambios_por_modulo` y
 * "Asistencias" en el texto; el endpoint de registros solo acepta la lista
 * cerrada `asistencias | lectura | rubrica | registro_vuelo | alumnos`, y
 * cualquier otra cosa responde 422. Se traduce aquí en vez de confiar en que
 * lleguen iguales.
 */
const ALIAS = { asistencia: 'asistencias', vuelo: 'registro_vuelo', alumno: 'alumnos' }

const claveDeModulo = (modulo) => {
  const texto = String(modulo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s-]+/g, '_')
  return ALIAS[texto] ?? texto
}

const etiquetaDeModulo = (clave) =>
  MODULOS_DE_ACTIVIDAD.find((m) => m.clave === clave)?.etiqueta ?? 'registros'

/** Iniciales para el avatar, que se genera en el cliente. */
const iniciales = (docente) =>
  [docente.nombres, docente.apellidos]
    .filter(Boolean)
    .map((p) => p.trim()[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export default function DetalleDocente({ docente, onVolver }) {
  useMigaExtra([docente?.nombres, docente?.apellidos].filter(Boolean).join(' '))
  const [viendo, setViendo] = useState(null)
  const consulta = useQuery({
    queryKey: ['seguimiento', 'actividades', docente.id_docente],
    queryFn: () => listarActividadesDe(docente.id_docente),
  })

  const nombre = [docente.nombres, docente.apellidos].filter(Boolean).join(' ')

  return (
    <div className="flex flex-col gap-5">
      <Button variant="ghost" iconLeft={ArrowLeft} onClick={onVolver} className="self-start">
        Volver al seguimiento
      </Button>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-base font-bold text-white"
            >
              {iniciales(docente)}
            </span>
            <h1 className="text-xl font-bold text-ink-900 md:text-2xl">{nombre}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(docente.colegios ?? []).map((c) => (
              <Badge key={c.id} tone="neutral">
                {c.nombre}
              </Badge>
            ))}
            <Badge
              tone={TONO_SINCRONIZACION[docente.sincronizacion] ?? 'neutral'}
              title={AYUDA_SINCRONIZACION[docente.sincronizacion]}
            >
              {ETIQUETA_SINCRONIZACION[docente.sincronizacion] ?? docente.sincronizacion}
            </Badge>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        {consulta.isError ? (
          <EmptyState title="No se pudo cargar la bitácora" description={mensajeDeError(consulta.error)} />
        ) : (
          <DataTable
            loading={consulta.isLoading}
            rows={consulta.data?.items ?? []}
            getRowId={(s) => s.id}
            empty={
              <EmptyState
                icon={History}
                title="Sin sesiones registradas"
                description="Este docente todavía no ha iniciado ninguna actividad."
              />
            }
            columns={[
              { key: 'fecha', header: 'Fecha', render: (s) => formatearFecha(s.fecha) },
              { key: 'inicio', header: 'Hora de inicio', render: (s) => formatearFechaHora(s.inicio) },
              {
                /*
                 * LA HORA DE FIN DICE TAMBIÉN SI LA JORNADA SIGUE ABIERTA.
                 *
                 * Para quien audita eso importa —lo que falte todavía puede
                 * aparecer, y un "Sin registros" no significa lo mismo en una
                 * jornada abierta que en una cerrada—, pero no necesita una
                 * columna propia: una fila con hora está cerrada y una sin
                 * ella no. Un guion ahí se leía como "falta el dato"; "En
                 * curso" lo dice. El estado completo sigue en el detalle.
                 */
                key: 'fin',
                header: 'Hora de finalización',
                render: (s) =>
                  s.fin ? (
                    formatearFechaHora(s.fin)
                  ) : (
                    <span className="font-medium text-info-600">En curso</span>
                  ),
              },
              { key: 'tipo_cierre', header: 'Tipo de cierre', render: (s) => <CeldaCierre tipo={s.tipo_cierre} /> },
              {
                key: 'productividad_texto',
                header: 'Productividad',
                render: (s) => s.productividad_texto || 'Sin registros',
              },
              {
                key: 'atajos',
                header: 'Atajos',
                /**
                 * CU021 — Saltar al módulo con los filtros de ESA jornada.
                 *
                 * "Ver Asistencias" ya tiene destino: el módulo existe. Lleva la
                 * FECHA EXACTA de la sesión, no la semana, porque el caso de uso
                 * lo prohíbe expresamente ("filtro por día, no por semana").
                 *
                 * Los demás siguen apagados: Rúbrica, Lectura y Registro de
                 * Vuelo no están publicados, y un atajo que lleva a una pantalla
                 * vacía es peor que uno que dice por qué no se puede.
                 */
                render: (s) => (
                  <div className="flex flex-wrap gap-1">
                    {(s.productividad ?? []).map((p) => {
                      const clave = claveDeModulo(p.modulo)
                      /*
                        Un módulo que no está en la lista cerrada del endpoint
                        respondería 422, así que no se ofrece el atajo: enseñar
                        un botón que solo puede fallar es peor que no tenerlo.
                      */
                      if (!MODULOS_DE_ACTIVIDAD.some((m) => m.clave === clave)) return null
                      return (
                        <Button
                          key={p.modulo}
                          size="sm"
                          variant="ghost"
                          iconLeft={Eye}
                          onClick={() => setViendo({ idDocente: docente.id_docente, actividad: s, modulo: clave })}
                        >
                          Ver {etiquetaDeModulo(clave)}
                        </Button>
                      )
                    })}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <RegistrosDeActividad contexto={viendo} onCerrar={() => setViendo(null)} />
    </div>
  )
}
