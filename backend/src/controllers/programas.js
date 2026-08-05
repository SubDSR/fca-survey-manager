import { supabase } from '../config/supabase.js';

const CAMPOS_EDITABLES = ['codigo', 'nivel_programa_id', 'nombre_base', 'mencion', 'nombre_corto'];

function respuestaError(res, error) {
  if (error.code === '23505') {
    return res.status(409).json({ error: `Ya existe un programa con esos datos: ${error.message}` });
  }
  if (error.code === '23514') {
    return res.status(400).json({ error: `Datos inválidos: ${error.message}` });
  }
  return res.status(500).json({ error: error.message });
}

// GET /api/programas?activo=true|false&search=texto
export async function listarProgramas(req, res) {
  const { activo, search } = req.query;
  let query = supabase
    .from('programa')
    .select('*, nivel_programa:nivel_programa_id(id, codigo, nombre)');

  if (activo === 'true') query = query.eq('activo', true);
  else if (activo === 'false') query = query.eq('activo', false);

  if (search && search.trim()) {
    const term = search.trim().replace(/[%,]/g, ' ').trim();
    if (term) query = query.or(`nombre_corto.ilike.%${term}%,nombre_base.ilike.%${term}%,codigo.ilike.%${term}%`);
  }

  const { data, error } = await query.order('nombre_corto');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// POST /api/programas
export async function crearPrograma(req, res) {
  const { codigo, nivel_programa_id, nombre_base, nombre_corto, mencion } = req.body || {};
  if (!codigo || !codigo.trim()) return res.status(400).json({ error: 'Falta el código del programa.' });
  if (!nivel_programa_id) return res.status(400).json({ error: 'Falta el nivel de programa.' });
  if (!nombre_base || !nombre_base.trim()) return res.status(400).json({ error: 'Falta el nombre base.' });
  if (!nombre_corto || !nombre_corto.trim()) return res.status(400).json({ error: 'Falta el nombre corto.' });

  const payload = { codigo: codigo.trim(), nivel_programa_id, nombre_base: nombre_base.trim(), nombre_corto: nombre_corto.trim() };
  if (mencion !== undefined && mencion !== '') payload.mencion = mencion;

  const { data, error } = await supabase
    .from('programa')
    .insert(payload)
    .select('*, nivel_programa:nivel_programa_id(id, codigo, nombre)')
    .single();
  if (error) return respuestaError(res, error);

  res.status(201).json(data);
}

// PATCH /api/programas/:id
export async function actualizarPrograma(req, res) {
  const { id } = req.params;
  const body = req.body || {};

  const payload = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (body[campo] !== undefined) payload[campo] = body[campo] === '' ? null : body[campo];
  }
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No se recibió ningún campo para actualizar.' });
  }

  const { data: existente, error: errorExistente } = await supabase
    .from('programa').select('id').eq('id', id).maybeSingle();
  if (errorExistente) return res.status(500).json({ error: errorExistente.message });
  if (!existente) return res.status(404).json({ error: 'Programa no encontrado' });

  const { data, error } = await supabase
    .from('programa')
    .update(payload)
    .eq('id', id)
    .select('*, nivel_programa:nivel_programa_id(id, codigo, nombre)')
    .single();
  if (error) return respuestaError(res, error);

  res.json(data);
}

// PATCH /api/programas/:id/activo — suspender/reactivar. Nunca borra la fila.
export async function cambiarActivoPrograma(req, res) {
  const { id } = req.params;
  const { activo } = req.body || {};
  if (typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo "activo" debe ser true o false' });
  }

  const { data, error } = await supabase
    .from('programa')
    .update({ activo })
    .eq('id', id)
    .select('*, nivel_programa:nivel_programa_id(id, codigo, nombre)')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Programa no encontrado' });

  res.json(data);
}

// GET /api/programas/catalogos — opciones para el <select> de nivel de programa.
export async function listarCatalogosPrograma(req, res) {
  const { data, error } = await supabase.from('nivel_programa').select('id, codigo, nombre').order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ nivel_programa: data });
}
