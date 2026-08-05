import { supabase } from '../config/supabase.js';

function respuestaError(res, error) {
  if (error.code === '23505') {
    return res.status(409).json({ error: `Ya existe un curso con esos datos: ${error.message}` });
  }
  if (error.code === '23514') {
    return res.status(400).json({ error: `Datos inválidos: ${error.message}` });
  }
  return res.status(500).json({ error: error.message });
}

// No hay FK directa asignatura->programa (ver docs/db-schema.md): se resuelve
// el plan_estudios_id tomando el plan activo más reciente de ese programa.
// Versión simplificada de resolverPlanEstudios en importarEncuestas.js, sin
// la preferencia por año de período (acá no hay contexto de período).
async function resolverPlanEstudiosActivo(programaId) {
  const { data, error } = await supabase
    .from('plan_estudios')
    .select('id, anio')
    .eq('programa_id', programaId)
    .eq('activo', true)
    .order('anio', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// GET /api/asignaturas?activo=true|false&search=texto&programa_id=1 — catálogo
// completo de cursos (tabla `asignatura`), con el programa resuelto vía
// plan_estudios (asignatura -> plan_estudios -> programa; no hay FK directa
// asignatura->programa, ver docs/db-schema.md). Usado tanto por "Cursos y
// Programas" (useCursoFilters.js) como por el nuevo tab administrativo
// "Catálogo de Cursos" en Configuración.
export async function listarAsignaturas(req, res) {
  const { activo, search, programa_id } = req.query;
  let query = supabase
    .from('asignatura')
    .select(
      'id, nombre, ciclo, creditos, es_electivo, activo, plan_estudios_id, ' +
      'plan_estudios:plan_estudios_id(programa_id, programa:programa_id(id, nombre_corto))'
    );

  if (activo === 'true') query = query.eq('activo', true);
  else if (activo === 'false') query = query.eq('activo', false);

  if (search && search.trim()) {
    const term = search.trim().replace(/[%,]/g, ' ').trim();
    if (term) query = query.ilike('nombre', `%${term}%`);
  }

  const { data, error } = await query.order('nombre');
  if (error) return res.status(500).json({ error: error.message });

  let asignaturas = data.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    ciclo: a.ciclo,
    creditos: a.creditos,
    es_electivo: a.es_electivo,
    activo: a.activo,
    plan_estudios_id: a.plan_estudios_id,
    programa_id: a.plan_estudios?.programa_id ?? null,
    programa: a.plan_estudios?.programa?.nombre_corto ?? null,
  }));

  if (programa_id) {
    const programaIdNum = Number(programa_id);
    asignaturas = asignaturas.filter((a) => a.programa_id === programaIdNum);
  }

  res.json(asignaturas);
}

// POST /api/asignaturas — el formulario pide "programa" (no plan_estudios_id
// directamente); el backend resuelve el plan activo más reciente de ese programa.
export async function crearAsignatura(req, res) {
  const { nombre, programa_id, ciclo, creditos, es_electivo } = req.body || {};
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'Falta el nombre del curso.' });
  if (!programa_id) return res.status(400).json({ error: 'Falta el programa.' });

  let planEstudiosId;
  try {
    planEstudiosId = await resolverPlanEstudiosActivo(programa_id);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
  if (!planEstudiosId) {
    return res.status(400).json({ error: 'El programa seleccionado no tiene un plan de estudios activo.' });
  }

  const payload = { nombre: nombre.trim(), plan_estudios_id: planEstudiosId };
  if (ciclo !== undefined && ciclo !== '') payload.ciclo = ciclo;
  if (creditos !== undefined && creditos !== '') payload.creditos = creditos;
  if (typeof es_electivo === 'boolean') payload.es_electivo = es_electivo;

  const { data: nueva, error } = await supabase.from('asignatura').insert(payload).select('id').single();
  if (error) return respuestaError(res, error);

  const { data: completa, error: errorCompleta } = await supabase
    .from('asignatura')
    .select(
      'id, nombre, ciclo, creditos, es_electivo, activo, plan_estudios_id, ' +
      'plan_estudios:plan_estudios_id(programa_id, programa:programa_id(id, nombre_corto))'
    )
    .eq('id', nueva.id)
    .single();
  if (errorCompleta) return res.status(500).json({ error: errorCompleta.message });

  res.status(201).json({
    id: completa.id,
    nombre: completa.nombre,
    ciclo: completa.ciclo,
    creditos: completa.creditos,
    es_electivo: completa.es_electivo,
    activo: completa.activo,
    plan_estudios_id: completa.plan_estudios_id,
    programa_id: completa.plan_estudios?.programa_id ?? null,
    programa: completa.plan_estudios?.programa?.nombre_corto ?? null,
  });
}

// PATCH /api/asignaturas/:id
export async function actualizarAsignatura(req, res) {
  const { id } = req.params;
  const { nombre, programa_id, ciclo, creditos, es_electivo } = req.body || {};

  const payload = {};
  if (nombre !== undefined) {
    if (!nombre.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío.' });
    payload.nombre = nombre.trim();
  }
  if (ciclo !== undefined) payload.ciclo = ciclo === '' ? null : ciclo;
  if (creditos !== undefined) payload.creditos = creditos === '' ? null : creditos;
  if (typeof es_electivo === 'boolean') payload.es_electivo = es_electivo;

  if (programa_id !== undefined) {
    let planEstudiosId;
    try {
      planEstudiosId = await resolverPlanEstudiosActivo(programa_id);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!planEstudiosId) {
      return res.status(400).json({ error: 'El programa seleccionado no tiene un plan de estudios activo.' });
    }
    payload.plan_estudios_id = planEstudiosId;
  }

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No se recibió ningún campo para actualizar.' });
  }

  const { data: existente, error: errorExistente } = await supabase
    .from('asignatura').select('id').eq('id', id).maybeSingle();
  if (errorExistente) return res.status(500).json({ error: errorExistente.message });
  if (!existente) return res.status(404).json({ error: 'Curso no encontrado' });

  const { error } = await supabase.from('asignatura').update(payload).eq('id', id);
  if (error) return respuestaError(res, error);

  const { data: completa, error: errorCompleta } = await supabase
    .from('asignatura')
    .select(
      'id, nombre, ciclo, creditos, es_electivo, activo, plan_estudios_id, ' +
      'plan_estudios:plan_estudios_id(programa_id, programa:programa_id(id, nombre_corto))'
    )
    .eq('id', id)
    .single();
  if (errorCompleta) return res.status(500).json({ error: errorCompleta.message });

  res.json({
    id: completa.id,
    nombre: completa.nombre,
    ciclo: completa.ciclo,
    creditos: completa.creditos,
    es_electivo: completa.es_electivo,
    activo: completa.activo,
    plan_estudios_id: completa.plan_estudios_id,
    programa_id: completa.plan_estudios?.programa_id ?? null,
    programa: completa.plan_estudios?.programa?.nombre_corto ?? null,
  });
}

// PATCH /api/asignaturas/:id/activo — suspender/reactivar. Nunca borra la fila.
export async function cambiarActivoAsignatura(req, res) {
  const { id } = req.params;
  const { activo } = req.body || {};
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo "activo" debe ser true o false' });
  }

  const { data, error } = await supabase
    .from('asignatura').update({ activo }).eq('id', id).select('id').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Curso no encontrado' });

  const { data: completa, error: errorCompleta } = await supabase
    .from('asignatura')
    .select(
      'id, nombre, ciclo, creditos, es_electivo, activo, plan_estudios_id, ' +
      'plan_estudios:plan_estudios_id(programa_id, programa:programa_id(id, nombre_corto))'
    )
    .eq('id', id)
    .single();
  if (errorCompleta) return res.status(500).json({ error: errorCompleta.message });

  res.json({
    id: completa.id,
    nombre: completa.nombre,
    ciclo: completa.ciclo,
    creditos: completa.creditos,
    es_electivo: completa.es_electivo,
    activo: completa.activo,
    plan_estudios_id: completa.plan_estudios_id,
    programa_id: completa.plan_estudios?.programa_id ?? null,
    programa: completa.plan_estudios?.programa?.nombre_corto ?? null,
  });
}
