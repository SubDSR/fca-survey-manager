import { supabase } from '../config/supabase.js';

const CAMPOS_INCIDENCIA =
  'curso_grupo_docente_id, docente_id, docente, asignatura_id, curso, programa_id, programa, ciclo, seccion, n_encuestas, encuesta_mas_antigua';

function respuestaError(res, error) {
  if (error.code === '23505') return res.status(409).json({ error: error.message });
  if (error.code === '23514') return res.status(400).json({ error: error.message });
  return res.status(500).json({ error: error.message });
}

// Combina revision_asignacion (tabla de tracking mutable) con
// v_asignaciones_sin_respaldo (foto de la realidad actual en
// curso_grupo_docente + encuesta) por curso_grupo_docente_id. La vista
// deliberadamente no conoce revision_asignacion (ver migración) — se
// combinan acá, igual que obtenerDocentePorId combina v_docente_ficha con
// otras vistas.
async function combinarConDetalle(revisiones) {
  if (revisiones.length === 0) return [];
  const ids = [...new Set(revisiones.map((r) => r.curso_grupo_docente_id))];
  const { data: detalle, error } = await supabase
    .from('v_asignaciones_sin_respaldo')
    .select(CAMPOS_INCIDENCIA)
    .in('curso_grupo_docente_id', ids);
  if (error) throw error;
  const detallePorCgd = new Map((detalle || []).map((d) => [d.curso_grupo_docente_id, d]));
  return revisiones
    .map((r) => ({ ...r, ...(detallePorCgd.get(r.curso_grupo_docente_id) || {}) }))
    // Una incidencia resuelta (reasignada) ya no tiene encuestas bajo su
    // curso_grupo_docente_id original, así que desaparece de la vista de
    // detección — se omite en vez de devolver una fila a medias.
    .filter((r) => r.docente !== undefined);
}

// GET /api/revisiones?estado=pendiente
export async function listarRevisiones(req, res) {
  const { estado } = req.query;
  let query = supabase.from('revision_asignacion').select('*');
  if (estado) query = query.eq('estado', estado);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  try {
    res.json(await combinarConDetalle(data || []));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/revisiones/:id — detalle de una incidencia + cursos que el
// docente sí dicta oficialmente (para el selector "reasignar a").
export async function obtenerRevision(req, res) {
  const { id } = req.params;
  const { data: revision, error } = await supabase
    .from('revision_asignacion').select('*').eq('id', id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!revision) return res.status(404).json({ error: 'Incidencia no encontrada' });

  const { data: detalle, error: errorDetalle } = await supabase
    .from('v_asignaciones_sin_respaldo')
    .select(CAMPOS_INCIDENCIA)
    .eq('curso_grupo_docente_id', revision.curso_grupo_docente_id)
    .maybeSingle();
  if (errorDetalle) return res.status(500).json({ error: errorDetalle.message });

  let opcionesReasignar = [];
  if (detalle) {
    const { data: oficiales, error: errorOficiales } = await supabase
      .from('curso_grupo_docente')
      .select(
        'id, curso_grupo:curso_grupo_id(asignatura:asignatura_id(nombre), grupo:grupo_id(ciclo, seccion, programa:programa_id(nombre_corto)))'
      )
      .eq('docente_id', detalle.docente_id)
      .eq('es_carga_oficial', true);
    if (errorOficiales) return res.status(500).json({ error: errorOficiales.message });
    opcionesReasignar = (oficiales || []).map((o) => ({
      curso_grupo_docente_id: o.id,
      curso: o.curso_grupo?.asignatura?.nombre,
      programa: o.curso_grupo?.grupo?.programa?.nombre_corto,
      ciclo: o.curso_grupo?.grupo?.ciclo,
      seccion: o.curso_grupo?.grupo?.seccion,
    }));
  }

  res.json({ ...revision, ...(detalle || {}), opcionesReasignar });
}

// POST /api/revisiones/:id/resolver
// Body: { accion: 'reasignar'|'confirmar'|'descartar', curso_grupo_docente_destino_id?, notas? }
export async function resolverRevision(req, res) {
  const { id } = req.params;
  const { accion, curso_grupo_docente_destino_id, notas } = req.body || {};

  if (!['reasignar', 'confirmar', 'descartar'].includes(accion)) {
    return res.status(400).json({ error: 'accion debe ser "reasignar", "confirmar" o "descartar"' });
  }

  const { data: revision, error: errorRevision } = await supabase
    .from('revision_asignacion').select('*').eq('id', id).maybeSingle();
  if (errorRevision) return res.status(500).json({ error: errorRevision.message });
  if (!revision) return res.status(404).json({ error: 'Incidencia no encontrada' });
  if (revision.estado !== 'pendiente') {
    return res.status(409).json({ error: `La incidencia ya fue resuelta (estado actual: ${revision.estado})` });
  }

  // resuelto_por queda null a propósito: no hay autenticación todavía, y no
  // corresponde inventar un usuario fijo (ver docs/plans/2026-08-04-modulo-
  // configuracion-design.md, misma decisión ya tomada para audit_log.usuario).
  const payload = { resuelto_en: new Date().toISOString(), resuelto_por: null };

  if (accion === 'reasignar') {
    if (!curso_grupo_docente_destino_id) {
      return res.status(400).json({ error: 'Falta curso_grupo_docente_destino_id' });
    }

    const { data: origenCgd, error: errorOrigen } = await supabase
      .from('curso_grupo_docente').select('docente_id').eq('id', revision.curso_grupo_docente_id).maybeSingle();
    if (errorOrigen) return res.status(500).json({ error: errorOrigen.message });
    if (!origenCgd) return res.status(404).json({ error: 'Asignación de origen no encontrada' });

    const { data: destinoCgd, error: errorDestino } = await supabase
      .from('curso_grupo_docente')
      .select('id, docente_id, es_carga_oficial')
      .eq('id', curso_grupo_docente_destino_id)
      .maybeSingle();
    if (errorDestino) return res.status(500).json({ error: errorDestino.message });
    if (!destinoCgd || destinoCgd.docente_id !== origenCgd.docente_id || !destinoCgd.es_carga_oficial) {
      return res.status(400).json({ error: 'El destino debe ser un dictado oficial del mismo docente' });
    }

    const { error: errorUpdateEncuestas } = await supabase
      .from('encuesta')
      .update({ curso_grupo_docente_id: curso_grupo_docente_destino_id })
      .eq('curso_grupo_docente_id', revision.curso_grupo_docente_id);
    if (errorUpdateEncuestas) return respuestaError(res, errorUpdateEncuestas);

    payload.estado = 'reasignada';
    payload.curso_grupo_docente_destino_id = curso_grupo_docente_destino_id;
  } else if (accion === 'confirmar') {
    payload.estado = 'confirmada_correcta';
  } else {
    if (!notas || !notas.trim()) {
      return res.status(400).json({ error: 'Falta la nota explicando por qué se descarta.' });
    }
    payload.estado = 'descartada';
    payload.notas = notas.trim();
  }

  const { data: actualizada, error: errorUpdate } = await supabase
    .from('revision_asignacion').update(payload).eq('id', id).select('*').maybeSingle();
  if (errorUpdate) return respuestaError(res, errorUpdate);

  res.json(actualizada);
}
