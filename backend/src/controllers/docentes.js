import { supabase } from '../config/supabase.js';
import { parsearNombreDocente } from '../utils/parsearNombre.js';

// numero_documento/tipo_documento (DNI) se exponen aquí en el listado
// completo a propósito: el tab administrativo "Docentes" (Configuración)
// necesita mostrarlo por card. Sin autenticación todavía en el proyecto
// (mismo riesgo aceptado que ya existía para el perfil individual, ahora
// extendido al listado) — restringir el acceso cuando se agregue auth.
const CAMPOS_FICHA =
  'id, nombre_completo, numero_documento, tipo_documento, condicion, facultad, grado_academico, ' +
  'correo_institucional, tiene_portafolio, registrado_sunedu, activo, cursos_asignados, ' +
  'tipo_documento_id, facultad_id, condicion_docente_id, categoria_docente_id, grado_academico_id, pais_id';

// Campos de `docente` editables desde el panel administrativo (alta/edición).
// nombre_completo/clave_busqueda NO están acá: son columnas GENERATED ALWAYS
// (calculadas por Postgres a partir de apellido_paterno/apellido_materno/
// nombres) — un INSERT/UPDATE que las incluya falla. Por eso el alta/edición
// recibe "nombre_completo" como string ("Apellidos, Nombres") y se parsea
// con parsearNombreDocente antes de tocar la tabla, igual que hace el
// importador de CSV.
const CAMPOS_EDITABLES = [
  'numero_documento', 'tipo_documento_id', 'codigo_docente', 'correo_institucional',
  'facultad_id', 'condicion_docente_id', 'categoria_docente_id', 'grado_academico_id', 'pais_id',
];

function respuestaError(res, error) {
  if (error.code === '23505') {
    return res.status(409).json({ error: `Ya existe un docente con esos datos: ${error.message}` });
  }
  if (error.code === '23514') {
    return res.status(400).json({ error: `Datos inválidos: ${error.message}` });
  }
  return res.status(500).json({ error: error.message });
}

async function obtenerFichaPorId(id) {
  const { data } = await supabase.from('v_docente_ficha').select(CAMPOS_FICHA).eq('id', id).maybeSingle();
  return data;
}

// GET /api/docentes?activo=true|false&search=texto&condicion_id=1
export async function listarDocentes(req, res) {
  const { activo, search, condicion_id } = req.query;
  let query = supabase.from('v_docente_ficha').select(CAMPOS_FICHA);

  if (activo === 'true') query = query.eq('activo', true);
  else if (activo === 'false') query = query.eq('activo', false);

  if (condicion_id) query = query.eq('condicion_docente_id', condicion_id);

  if (search && search.trim()) {
    const term = search.trim().replace(/[%,]/g, ' ').trim();
    if (term) query = query.or(`nombre_completo.ilike.%${term}%,numero_documento.ilike.%${term}%`);
  }

  const { data, error } = await query.order('nombre_completo');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function obtenerDocentePorId(req, res) {
  const { id } = req.params;

  const ficha = await obtenerFichaPorId(id);
  if (!ficha) return res.status(404).json({ error: 'Docente no encontrado' });

  // Carga oficial (curso_grupo_docente.es_carga_oficial = true): la fuente
  // de verdad de qué dicta el docente, independiente de si ya hay encuestas
  // cargadas para ese curso — mismo criterio ya aplicado en "Cursos y
  // Programas" (useCursoFilters.js). Antes esta sección se armaba
  // directamente desde v_docente_seccion_consolidada (dependiente de
  // encuestas), así que un docente con carga oficial pero sin encuestas
  // aún, o con todas sus encuestas excluidas por una revision_asignacion
  // pendiente, aparecía como "sin cursos asignados" pese a sí tener carga.
  const { data: oficiales, error: errorOficiales } = await supabase
    .from('curso_grupo_docente')
    .select(
      'id, curso_grupo_id, curso_grupo:curso_grupo_id(asignatura:asignatura_id(id, nombre), grupo:grupo_id(ciclo, seccion, programa:programa_id(nombre_corto)))'
    )
    .eq('docente_id', id)
    .eq('es_carga_oficial', true);
  if (errorOficiales) return res.status(500).json({ error: errorOficiales.message });

  // Datos de encuesta (nota/cumplimiento) para complementar cada curso
  // oficial cuando existan — ya no como condición para aparecer en la lista.
  const { data: statsEncuesta, error: errorCursos } = await supabase
    .from('v_docente_seccion_consolidada')
    .select('*')
    .eq('docente_id', id);
  if (errorCursos) return res.status(500).json({ error: errorCursos.message });

  const statsPorCursoGrupo = new Map((statsEncuesta || []).map((s) => [s.curso_grupo_id, s]));
  const cursos = (oficiales || []).map((o) => {
    const stats = statsPorCursoGrupo.get(o.curso_grupo_id);
    return {
      curso_grupo_docente_id: o.id,
      curso_grupo_id: o.curso_grupo_id,
      asignatura: o.curso_grupo?.asignatura?.nombre,
      asignatura_id: o.curso_grupo?.asignatura?.id,
      programa: o.curso_grupo?.grupo?.programa?.nombre_corto,
      ciclo: o.curso_grupo?.grupo?.ciclo,
      seccion: o.curso_grupo?.grupo?.seccion,
      n_encuestas: stats?.n_encuestas ?? 0,
      n_encuestas_validas: stats?.n_encuestas_validas ?? 0,
      nota_promedio: stats?.nota_promedio ?? null,
      pct_si: stats?.pct_si ?? null,
    };
  });

  // Obtener datos para el gráfico histórico
  const { data: evaluaciones } = await supabase
    .from('v_docente_promedio_historico')
    .select('periodo, promedio')
    .eq('docente_id', id)
    .order('periodo');

  const promedioHistorico = evaluaciones && evaluaciones.length > 0
    ? (evaluaciones.reduce((acc, curr) => acc + Number(curr.promedio), 0) / evaluaciones.length).toFixed(1)
    : 0;

  const promedioActual = await calcularPromedioActual(id);

  res.json({
    ...ficha,
    cursos,
    promedioHistorico: promedioHistorico,
    promedioActual: promedioActual,
    evaluaciones: evaluaciones || [],
  });
}

// POST /api/docentes — alta manual desde el panel de Configuración.
// Body: { nombre_completo: "Apellidos, Nombres", numero_documento?, tipo_documento_id?, ... }
export async function crearDocente(req, res) {
  const { nombre_completo, ...resto } = req.body || {};
  if (!nombre_completo || !nombre_completo.trim()) {
    return res.status(400).json({ error: 'Falta el nombre completo, formato "Apellidos, Nombres".' });
  }
  const partes = parsearNombreDocente(nombre_completo);
  if (!partes.apellido_paterno || !partes.nombres) {
    return res.status(400).json({ error: 'El nombre completo debe tener el formato "Apellidos, Nombres".' });
  }

  const payload = { ...partes };
  for (const campo of CAMPOS_EDITABLES) {
    if (resto[campo] !== undefined && resto[campo] !== '') payload[campo] = resto[campo];
  }

  const { data: nuevo, error } = await supabase.from('docente').insert(payload).select('id').single();
  if (error) return respuestaError(res, error);

  res.status(201).json(await obtenerFichaPorId(nuevo.id));
}

// PATCH /api/docentes/:id — edición de campos.
export async function actualizarDocente(req, res) {
  const { id } = req.params;
  const { nombre_completo, ...resto } = req.body || {};

  const payload = {};
  if (nombre_completo !== undefined) {
    if (!nombre_completo.trim()) {
      return res.status(400).json({ error: 'El nombre completo no puede quedar vacío.' });
    }
    const partes = parsearNombreDocente(nombre_completo);
    if (!partes.apellido_paterno || !partes.nombres) {
      return res.status(400).json({ error: 'El nombre completo debe tener el formato "Apellidos, Nombres".' });
    }
    Object.assign(payload, partes);
  }
  for (const campo of CAMPOS_EDITABLES) {
    if (resto[campo] !== undefined) payload[campo] = resto[campo] === '' ? null : resto[campo];
  }
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No se recibió ningún campo para actualizar.' });
  }

  const { data: existente, error: errorExistente } = await supabase
    .from('docente').select('id').eq('id', id).maybeSingle();
  if (errorExistente) return res.status(500).json({ error: errorExistente.message });
  if (!existente) return res.status(404).json({ error: 'Docente no encontrado' });

  const { error } = await supabase.from('docente').update(payload).eq('id', id);
  if (error) return respuestaError(res, error);

  res.json(await obtenerFichaPorId(id));
}

// PATCH /api/docentes/:id/activo — suspender/reactivar. Nunca borra: mismo
// patrón que cambiarVisibilidad en controllers/cargas.js.
export async function cambiarActivoDocente(req, res) {
  const { id } = req.params;
  const { activo } = req.body || {};
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo "activo" debe ser true o false' });
  }

  const { data, error } = await supabase
    .from('docente').update({ activo }).eq('id', id).select('id').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Docente no encontrado' });

  res.json(await obtenerFichaPorId(id));
}

// GET /api/docentes/catalogos — opciones para los <select> del formulario de
// alta/edición (tipo de documento, facultad, condición, categoría, grado,
// país). Catálogos chicos (3-21 filas cada uno): se traen completos, sin paginar.
export async function listarCatalogosDocente(req, res) {
  const tablas = ['tipo_documento', 'facultad', 'condicion_docente', 'categoria_docente', 'grado_academico', 'pais'];
  const resultados = await Promise.all(
    tablas.map((t) => supabase.from(t).select('id, nombre').eq('activo', true).order('nombre'))
  );

  const fallo = resultados.find((r) => r.error);
  if (fallo) return res.status(500).json({ error: fallo.error.message });

  const catalogos = {};
  tablas.forEach((t, i) => { catalogos[t] = resultados[i].data; });
  res.json(catalogos);
}

// Promedio de TODAS las respuestas numéricas del docente en el período
// académico EN_CURSO (no la última carga ni el último día — el período
// activo completo). Consulta directa en vez de una vista: es un solo
// número, no hace falta materializarlo como vista de reportes.
async function calcularPromedioActual(docenteId) {
  const { data, error } = await supabase
    .from('respuesta')
    .select(`
      valor_numerico,
      encuesta:encuesta_id!inner(
        carga_id,
        carga_csv:carga_id(visible),
        curso_grupo_docente:curso_grupo_docente_id!inner(
          docente_id,
          curso_grupo:curso_grupo_id!inner(
            grupo:grupo_id!inner(
              periodo_academico:periodo_academico_id!inner(estado)
            )
          )
        )
      )
    `)
    .eq('respondida', true)
    .eq('escala_tipo', 'NUMERICA')
    .eq('encuesta.curso_grupo_docente.docente_id', docenteId)
    .eq('encuesta.curso_grupo_docente.curso_grupo.grupo.periodo_academico.estado', 'EN_CURSO');

  if (error || !data) return 0;

  // Respeta cargas ocultas igual que las vistas de reportes: carga_id NULL
  // (heredada) siempre cuenta; con carga_id, solo si esa carga es visible.
  const respuestas = data.filter((r) => {
    const carga = r.encuesta?.carga_id;
    return carga === null || r.encuesta?.carga_csv?.visible === true;
  });

  if (respuestas.length === 0) return 0;

  const promedio = respuestas.reduce((acc, r) => acc + Number(r.valor_numerico), 0) / respuestas.length;
  return Number((promedio * 2).toFixed(1));
}
