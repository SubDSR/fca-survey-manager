import { supabase } from '../config/supabase.js';

export async function listarPeriodos(req, res) {
  const { data, error } = await supabase
    .from('periodo_academico')
    .select('id, codigo, anio, semestre, fecha_inicio, fecha_fin, estado')
    .order('anio', { ascending: true })
    .order('semestre', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

export async function crearPeriodo(req, res) {
  const { anio, semestre, fecha_inicio, fecha_fin, activar } = req.body || {};

  const anioNum = Number(anio);
  const semestreNum = Number(semestre);
  if (!anioNum || anioNum < 1990 || anioNum > 2100) {
    return res.status(400).json({ error: 'Año inválido (debe estar entre 1990 y 2100).' });
  }
  if (![1, 2, 3].includes(semestreNum)) {
    return res.status(400).json({ error: 'Semestre inválido (debe ser 1, 2 o 3).' });
  }

  const numeroRomano = semestreNum === 1 ? 'I' : semestreNum === 2 ? 'II' : 'III';
  const codigo = `${anioNum}-${numeroRomano}`;

  if (activar) {
    const { error: errorDesactivar } = await supabase
      .from('periodo_academico')
      .update({ estado: 'CERRADO' })
      .eq('estado', 'EN_CURSO');
    if (errorDesactivar) return res.status(500).json({ error: errorDesactivar.message });
  }

  const { data, error } = await supabase
    .from('periodo_academico')
    .insert({
      codigo,
      anio: anioNum,
      semestre: semestreNum,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      estado: activar ? 'EN_CURSO' : 'PLANIFICADO',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `El período "${codigo}" ya existe.` });
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
}

// Marca un período como EN_CURSO y cierra el que estaba EN_CURSO antes (si había).
export async function activarPeriodo(req, res) {
  const { id } = req.params;

  const { data: periodo, error: errorBusqueda } = await supabase
    .from('periodo_academico')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (errorBusqueda) return res.status(500).json({ error: errorBusqueda.message });
  if (!periodo) return res.status(404).json({ error: 'Período no encontrado' });

  const { error: errorCerrar } = await supabase
    .from('periodo_academico')
    .update({ estado: 'CERRADO' })
    .eq('estado', 'EN_CURSO')
    .neq('id', id);
  if (errorCerrar) return res.status(500).json({ error: errorCerrar.message });

  const { data, error } = await supabase
    .from('periodo_academico')
    .update({ estado: 'EN_CURSO' })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}

// GET /api/periodos/:id/campania-activa — el frontend necesita el campania_id
// para GET /api/cargas (el historial se consulta por campaña, no por período).
export async function campaniaActivaDePeriodo(req, res) {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('campania_evaluacion')
    .select('id, codigo, estado')
    .eq('periodo_academico_id', id)
    .in('estado', ['BORRADOR', 'ABIERTA'])
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) {
    return res.status(404).json({ error: 'No hay campaña abierta/en borrador para este período.' });
  }
  res.json(data);
}
