import { supabase } from '../config/supabase.js';

// GET /api/politica-evaluacion -- expone de solo lectura la política de
// evaluación "activa" (ligada a la campaña con estado = 'ABIERTA', mismo
// concepto de "politica_activa" que ya usa v_seguimiento). Es la fuente
// única de estos umbrales: el frontend ya no los hardcodea (AlertBanner/
// SeguimientoModal, stats.js, CursoHeader.jsx) -- ver migración
// 2026-08-04-unificar-umbral-seguimiento-nota.sql.
//
// Si no hay ninguna campaña abierta (no debería pasar en operación normal,
// pero no es motivo para que el frontend se quede sin poder pintar
// aprobado/desaprobado) cae de vuelta a la primera política registrada:
// hoy solo existe una fila en la tabla de todas formas.
export async function obtenerPoliticaActiva(req, res) {
  const { data: campaniaAbierta, error: errorCampania } = await supabase
    .from('campania_evaluacion')
    .select('politica_evaluacion_id')
    .eq('estado', 'ABIERTA')
    .limit(1)
    .maybeSingle();
  if (errorCampania) return res.status(500).json({ error: errorCampania.message });

  let query = supabase.from('politica_evaluacion').select('*');
  query = campaniaAbierta
    ? query.eq('id', campaniaAbierta.politica_evaluacion_id)
    : query.order('id', { ascending: true }).limit(1);

  const { data, error } = await query.maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'No hay ninguna política de evaluación registrada.' });

  res.json(data);
}
