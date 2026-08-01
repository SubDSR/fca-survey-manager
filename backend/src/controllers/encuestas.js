import { fetchAllRows } from '../config/supabase.js';

export async function obtenerConsolidado(req, res) {
  try {
    res.json(await fetchAllRows('v_docente_seccion_consolidada'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function obtenerSeguimiento(req, res) {
  try {
    res.json(await fetchAllRows('v_seguimiento'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function obtenerCriterios(req, res) {
  try {
    res.json(await fetchAllRows('v_promedio_por_criterio'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function obtenerDirectivas(req, res) {
  try {
    res.json(await fetchAllRows('v_encuesta_directivas'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function obtenerRespuestas(req, res) {
  try {
    const { docente_id, asignatura_id, grupo_id } = req.query;
    const filters = {};
    if (docente_id !== undefined) filters.docente_id = docente_id;
    if (asignatura_id !== undefined) filters.asignatura_id = asignatura_id;
    if (grupo_id !== undefined) filters.grupo_id = grupo_id;
    res.json(await fetchAllRows('v_respuesta_detalle', filters));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
