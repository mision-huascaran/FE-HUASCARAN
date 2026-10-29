// Cubre: RF-002, RN-001 · Sección "Usuarios" de la matriz.
//
// D2: el Supervisor crea a TODOS los roles —Docente, Supervisor y Directivo— y
// el Directivo ya no gestiona cuentas. Antes era al revés; se corrigió aquí.
//
// Los campos del popup dependen del rol elegido: una cuenta de Docente lleva
// además sus colegios y secciones, porque esas asignaciones son las que definen
// su alcance. Las de Supervisor y Directivo no tienen alcance que definir.
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Mantenimiento from '../../components/mantenimiento/Mantenimiento'
import Badge from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import ModalCredencialDocente from '../administracion/ModalCredencialDocente'
import DetalleDocente from './DetalleDocente'
import ColegiosDelDocente from './ColegiosDelDocente'
import {
  activarUsuario,
  actualizarUsuario,
  crearUsuario,
  desactivarUsuario,
  filtrarUsuariosPorColegio,
  listarAuditoria,
  listarColegiosAdmin,
  listarEstadoCalendario,
  recesoDelColegio,
  listarGradosAdmin,
  listarUsuariosAdmin,
  obtenerUsuario,
} from '../../api/resources/administracion'
import { mensajeDeError } from '../../api/client'
import { etiquetaDe } from '../../lib/format'
import useConexion from '../../hooks/useConexion'
import { ROLES } from '../../auth/roles'
import useSessionStore from '../../store/sessionStore'

/**
 * El rol se guarda como texto en el `<select>`, así que se compara en texto.
 * Al editar, el registro puede traer `rol: 'Docente'` en vez del id.
 */
const esDocente = (valores) =>
  String(valores.id_rol ?? '') === String(ROLES.DOCENTE) || valores.rol === 'Docente'

const ROLES_CREABLES = [
  { value: String(ROLES.DOCENTE), label: 'Docente' },
  { value: String(ROLES.SUPERVISOR), label: 'Supervisor' },
  { value: String(ROLES.DIRECTIVO), label: 'Directivo' },
]

/**
 * ¿La asignación es la misma que traía la ficha?
 *
 * Se compara la LISTA COMPLETA: en la edición, `colegios` es el conjunto del
 * año y lo que no viene se libera. Mandarla cuando no cambió nada haría que
 * corregir un DNI reescribiera las asignaciones del Docente.
 */
const ordenados = (lista) => lista.map(String).sort((x, y) => x.localeCompare(y))

function mismosColegios(a, b) {
  const normal = (lista) =>
    (lista ?? [])
      .map((c) => `${c.id_colegio}:${ordenados(c.grados ?? []).join(',')}:${c.inicio_asignacion ?? ''}`)
      .sort((x, y) => x.localeCompare(y))
      .join('|')
  return normal(a) === normal(b)
}

export default function MantenimientoUsuarios() {
  const toast = useToast()
  const idUsuarioActual = Number(useSessionStore((s) => s.usuario?.id_usuario))
  // El Docente cuyo detalle se está viendo, o `null` en el listado.
  const [docenteAbierto, setDocenteAbierto] = useState(null)
  const queryClient = useQueryClient()
  const enLinea = useConexion()
  const [filtros, setFiltros] = useState({ estado: 'activo' })
  const [credencial, setCredencial] = useState(null)

  const { data: colegios = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'colegios'],
    queryFn: async () => (await listarColegiosAdmin()).items,
    staleTime: Infinity,
  })

  const { data: grados = [] } = useQuery({
    queryKey: ['admin', 'catalogo', 'grados'],
    queryFn: listarGradosAdmin,
    staleTime: Infinity,
  })

  /**
   * En qué periodo está HOY cada colegio.
   *
   * Solo se usa para una pregunta del formulario —si el colegio está en receso
   * hay que decir si la asignación es retroactiva o próxima—, pero no se puede
   * deducir de otra cosa: cada colegio tiene su propio calendario desde CU027.
   */
  const { data: estadoCalendario = [] } = useQuery({
    queryKey: ['admin', 'colegios', 'estado-calendario'],
    queryFn: () => listarEstadoCalendario(),
    staleTime: Infinity,
  })

  /** El receso de ese colegio, o `null` si está en un PA o no tiene calendario. */
  const recesoDe = useCallback((idColegio) => recesoDelColegio(estadoCalendario, idColegio), [estadoCalendario])

  const consultaServidor = useQuery({
    queryKey: ['admin', 'usuarios', filtros],
    queryFn: async () => (await listarUsuariosAdmin(filtros)).items,
  })

  /**
   * Dos cosas que el listado del backend no trae y la pantalla necesita:
   *
   *   · El filtro por COLEGIO: `GET /usuarios` no lo admite, así que se aplica
   *     aquí. Docentes de ese colegio + Supervisor y Directivo (globales).
   *   · El `id_colegio` actual de cada Docente, para que "Editar" muestre su
   *     colegio en vez de un desplegable vacío. Llega solo el NOMBRE en
   *     `colegios_asignados`; se traduce con el catálogo de colegios.
   */
  const filas = useMemo(() => {
    const idPorNombre = new Map(colegios.map((c) => [c.nombre, c.id_colegio]))
    const nombreFiltro = colegios.find((c) => String(c.id_colegio) === String(filtros.id_colegio ?? ''))?.nombre
    const conColegio = (consultaServidor.data ?? []).map((u) => {
      const propio = (u.colegios_asignados ?? []).find((n) => n !== 'Global')
      return propio && idPorNombre.has(propio) ? { ...u, id_colegio: String(idPorNombre.get(propio)) } : u
    })
    return filtrarUsuariosPorColegio(conColegio, nombreFiltro)
  }, [consultaServidor.data, colegios, filtros.id_colegio])

  const consulta = { ...consultaServidor, data: consultaServidor.data ? filas : undefined }

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    queryClient.invalidateQueries({ queryKey: ['detalle', 'usuarios'] })
    queryClient.invalidateQueries({ queryKey: ['auditoria', 'usuarios'] })
  }

  const guardado = useMutation({
    mutationFn: ({ valores, popup }) => {
      if (popup.modo === 'editar') {
        // La asignación solo viaja si el Supervisor la CAMBIÓ (otro colegio,
        // grados o año). Si solo corrige el DNI o el correo, mandar el colegio
        // precargado reasignaría al docente sin que lo pidiera. Se compara con
        // lo que precargó el detalle (`GET /usuarios/{id}`), o con la fila.
        const registro = popup.registro
        const inicial = queryClient.getQueryData(['detalle', 'usuarios', registro.id ?? registro.id_usuario]) ?? registro
        const cambioAsignacion =
          Boolean(valores.colegios?.length) &&
          (!mismosColegios(valores.colegios, inicial.colegios) ||
            String(valores.anio_escolar ?? '').trim() !== String(inicial.anio_escolar ?? '').trim())
        const datos = cambioAsignacion ? valores : { ...valores, colegios: [], anio_escolar: '' }
        return actualizarUsuario(registro.id_usuario, datos)
      }
      // Un solo POST para los tres roles: con id_rol de Docente, el backend
      // crea usuario, docente y asignaciones en la misma transacción.
      return crearUsuario(valores)
    },
    onSuccess: (creado, { popup }) => {
      refrescar()
      if (popup.modo === 'editar') {
        toast.success('Cuenta actualizada')
        return
      }
      // Si el correo no salió, la contraseña temporal es la única copia.
      if (creado?.correo_enviado === false && creado?.['contraseña_temporal']) {
        setCredencial({ correo: creado.correo, password: creado['contraseña_temporal'] })
      } else {
        toast.success('Cuenta creada', 'Se le enviaron sus credenciales por correo.')
      }
    },
    onError: (error) => toast.error('No se pudo guardar la cuenta', mensajeDeError(error)),
  })

  const estado = useMutation({
    mutationFn: ({ usuario, activo }) =>
      activo ? activarUsuario(usuario.id_usuario) : desactivarUsuario(usuario.id_usuario),
    onSuccess: (_d, { activo }) => {
      refrescar()
      toast.success(activo ? 'Cuenta activada' : 'Cuenta inactivada')
    },
    onError: (error) => toast.error('No se pudo cambiar el estado', mensajeDeError(error)),
  })

  const campos = useMemo(
    () => [
      { nombre: 'nombres', etiqueta: 'Nombres', requerido: true },
      { nombre: 'apellidos', etiqueta: 'Apellidos', requerido: true },
      // CU016: obligatorio, 8 dígitos y único (409 si se repite). Faltaba en
      // el formulario y el alta respondía 422.
      {
        nombre: 'dni',
        etiqueta: 'DNI',
        requerido: true,
        validar: (v) => (/^\d{8}$/.test(String(v ?? '').trim()) ? null : 'El DNI debe tener 8 dígitos'),
      },
      {
        nombre: 'correo',
        etiqueta: 'Correo institucional',
        tipo: 'email',
        requerido: true,
        ancho: 'completo',
        validar: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? null : 'Correo no válido'),
      },
      {
        nombre: 'id_rol',
        etiqueta: 'Rol',
        tipo: 'select',
        requerido: true,
        ancho: 'completo',
        opciones: ROLES_CREABLES,
        // El rol no se cambia editando: una cuenta no cambia de parcela.
        soloAlCrear: true,
      },
      /**
       * Lo propio del Docente. La SECCIÓN ya no se elige: es un atributo del
       * colegio y el alumno la hereda. Y es UN colegio, no varios: por ahora
       * cada docente atiende un plantel y todos los grados que ese plantel
       * ofrece. Rotarlo es editar este campo; renovarlo, cambiar el año.
       *
       * Los tres solo aparecen con el rol Docente. Supervisor y Directivo son
       * globales: no tienen colegio ni grados que asignar, y mostrárselos en
       * gris con un "Solo para Docente" debajo hacía dudar de si tocaba
       * rellenarlos. Al cambiar de rol se ocultan y su valor se descarta.
       */
      {
        nombre: 'anio_escolar',
        etiqueta: 'Año escolar',
        tipo: 'number',
        ayuda: 'Cambiarlo renueva su asignación',
        visible: esDocente,
      },
      /**
       * D67 — VARIOS COLEGIOS, cada uno con sus grados y su inicio.
       *
       * Antes eran tres campos sueltos —colegio, grados y "Desde qué
       * periodo"— y solo admitían UN colegio. Al editar a un Docente con dos,
       * el segundo no se veía, y al guardar se lo quitaba: en la edición
       * `colegios` es la lista COMPLETA del año, así que lo que no viene se
       * libera.
       *
       * El inicio de asignación es POR COLEGIO porque cada uno tiene su
       * calendario: uno puede estar en un PA y otro en receso.
       */
      {
        nombre: 'colegios',
        etiqueta: 'Colegios asignados',
        requerido: true,
        ancho: 'completo',
        visible: esDocente,
        componente: ColegiosDelDocente,
        opciones: colegios.map((c) => ({ value: String(c.id_colegio), label: c.nombre })),
        // Los grados los ofrece el COLEGIO, no un catálogo global: no todos
        // los colegios dictan los seis.
        gradosDe: (idColegio) => {
          const suyos = colegios.find((c) => String(c.id_colegio) === String(idColegio))?.grados
          const lista = Array.isArray(suyos) && suyos.length ? suyos : grados
          return lista.map((g) => ({ value: String(g.id_grado ?? g), label: g.nombre ?? `${g}.°` }))
        },
        recesoDe,
      },
    ],
    [colegios, grados, recesoDe],
  )

  /**
   * El detalle del Docente reemplaza el listado en el área principal, sin
   * navegar: así "Volver a Usuarios" devuelve con los filtros y la página
   * intactos, que es lo que pide CU016. Si fuera una ruta habría que
   * reconstruirlos al volver.
   */
  if (docenteAbierto) {
    return (
      <DetalleDocente
        docente={docenteAbierto}
        colegios={colegios}
        onVolver={() => setDocenteAbierto(null)}
      />
    )
  }

  return (
    <>
      <Mantenimiento
        seccion="usuarios"
        entidad="cuenta"
        titulo="Usuarios"
        /**
         * Solo en las filas de Docente: Supervisores y Directivos no tienen
         * permisos de corrección ni nada más que enseñar. En sus filas el
         * hueco se reserva, para que la columna de acciones no baile.
         *
         * Dice "Otorgar permisos" y no "Ver detalle" porque es lo que se va a
         * hacer ahí, y porque junto al "Ver" de al lado eran dos ojos seguidos
         * que no se distinguían y llevaban a sitios distintos.
         */
        verDetalle={{
          abrir: setDocenteAbierto,
          aplicaA: esDocente,
          etiqueta: 'Otorgar permisos',
        }}
        /**
         * D68 — Dos cuentas que NO se pueden inactivar, y el botón lo dice.
         *
         * El backend ya las rechaza: `auto_desactivacion` con la propia y la
         * protección del Supervisor original, que CU001 declara que "no puede
         * ser eliminada, no puede ser desactivada". Pero el botón se veía
         * habilitado y había que pulsarlo para enterarse.
         */
        protegida={(fila) => {
          if (fila.es_supervisor_original) return 'La cuenta del Supervisor original no se puede desactivar.'
          if (Number(fila.id_usuario) === idUsuarioActual) return 'No puedes desactivar tu propia cuenta.'
          return undefined
        }}
        consulta={consulta}
        campos={campos}
        guardando={guardado.isPending}
        soloOnline
        sinConexion={!enLinea}
        valoresFiltro={filtros}
        onFiltro={(nombre, valor) => setFiltros((f) => ({ ...f, [nombre]: valor }))}
        cargarAuditoria={(id) => listarAuditoria('usuario', id)}
        // El listado no trae año ni grados del Docente: se piden al abrir.
        cargarDetalle={obtenerUsuario}
        genero="f"
        onGuardar={(valores, popup) => guardado.mutateAsync({ valores, popup })}
        onCambiarEstado={(usuario, activo) => estado.mutate({ usuario, activo })}
        filtros={[
          { nombre: 'q', etiqueta: 'Buscar', tipo: 'busqueda', placeholder: 'Nombre o correo' },
          { nombre: 'rol', etiqueta: 'Rol', opciones: ROLES_CREABLES.map((r) => ({ value: r.label, label: r.label })) },
          { nombre: 'id_colegio', etiqueta: 'Colegio', opciones: colegios.map((c) => ({ value: c.id_colegio, label: c.nombre })) },
        ]}
        columnas={[
          // Las columnas que pide CU016, en su orden.
          { key: 'nombre', header: 'Nombre completo', sortable: true, className: 'font-medium text-ink-900' },
          { key: 'dni', header: 'DNI', align: 'center', render: (u) => etiquetaDe(u.dni) },
          { key: 'correo', header: 'Correo', sortable: true },
          {
            /**
             * CU001/CU016: una cuenta recién creada arrastra una contraseña
             * temporal de 48 horas hasta su primer ingreso. Saberlo le importa
             * al Supervisor: si expira sin usarse, él no puede reenviarla y la
             * persona tiene que pasar por "¿Olvidaste tu contraseña?".
             */
            key: 'debe_cambiar_contrasena',
            header: 'Acceso',
            align: 'center',
            /**
             * Etiqueta CORTA y en una sola línea. "Pendiente de primer
             * ingreso" no cabía en la columna y se partía en dos renglones,
             * creando un óvalo enorme que se comía la fila y desalineaba el
             * "—" de las demás. La frase entera vive en el `title`.
             */
            render: (u) =>
              u.debe_cambiar_contrasena ? (
                <Badge
                  tone="warning"
                  className="whitespace-nowrap"
                  title="Aún no ha usado su contraseña temporal. Caduca a las 48 horas."
                >
                  Primer ingreso
                </Badge>
              ) : (
                <span className="text-xs text-ink-400">—</span>
              ),
          },
          { key: 'rol', header: 'Rol', render: (u) => <Badge tone="info">{etiquetaDe(u.rol)}</Badge> },
          {
            // Llega como LISTA: nombres de colegios para los docentes y
            // ["Global"] para Supervisor y Directivo.
            key: 'colegios_asignados',
            header: 'Colegios asignados',
            render: (u) => (u.colegios_asignados ?? []).map((c) => etiquetaDe(c)).join(', ') || '—',
          },
        ]}
      />

      <ModalCredencialDocente credencial={credencial} onCerrar={() => setCredencial(null)} />
    </>
  )
}
